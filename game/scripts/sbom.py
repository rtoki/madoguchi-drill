# SPDX-FileCopyrightText: 2026 rtoki
# SPDX-License-Identifier: MIT
"""Export lockfile dependency inventories without installing or running packages."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess


GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parent


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def command(*args):
    return subprocess.check_output(args, cwd=GAME, text=True).strip()


def generate(output):
    package = read_json(GAME / "package.json")
    lock = read_json(GAME / "package-lock.json")
    scenario = read_json(GAME / "scenarios/komorebi/manifest.json")
    if package["version"] != scenario["version"] or any(
        lock["packages"][""][key] != package[key] for key in ("name", "version")
    ):
        raise ValueError("Package, lockfile and scenario versions must agree")

    # Explicit --include prevents NODE_ENV/npm configuration from silently
    # removing development or optional dependencies from the full inventory.
    documents = {}
    for scope, flags in (
        ("build", ["--include=dev", "--include=optional", "--include=peer"]),
        ("runtime", ["--omit=dev", "--include=optional", "--include=peer"]),
    ):
        document = json.loads(command(
            "npm", "sbom", "--package-lock-only", "--sbom-format=spdx",
            "--sbom-type=application", *flags,
        ))
        if document.get("spdxVersion") != "SPDX-2.3" or not document.get("packages"):
            raise ValueError("Unexpected npm SPDX output")
        documents[f"sbom-{scope}.spdx.json"] = document

    metadata = {
        "schemaVersion": 1,
        "commit": command("git", "rev-parse", "HEAD"),
        "gameVersion": scenario["version"],
        "engineVersion": read_json(GAME / "engine/version.json")["version"],
        "npmVersion": command("npm", "--version"),
        "scope": {
            "sbom-build.spdx.json": "All npm lockfile dependencies, including development and optional packages; not an installed-platform inventory.",
            "sbom-runtime.spdx.json": "npm lockfile dependencies with development dependencies omitted; not an inventory of bundled game files.",
        },
        "licensing": "The npm root package license applies to code only. Story, teaching materials, images and music have separate terms.",
        "assetNotices": ["LICENSING.md", "docs/THIRD-PARTY-NOTICES.md"],
        "sha256": {},
    }
    output.mkdir(parents=True, exist_ok=True)
    for name, document in documents.items():
        data = (json.dumps(document, ensure_ascii=False, indent=2) + "\n").encode()
        (output / name).write_bytes(data)
        metadata["sha256"][name] = hashlib.sha256(data).hexdigest()
    for name in ("game/package.json", "game/package-lock.json"):
        metadata["sha256"][name] = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
    (output / "sbom-metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    print(f"Generated SBOMs for game {scenario['version']} in {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=GAME / "build/sbom")
    generate(parser.parse_args().output.resolve())

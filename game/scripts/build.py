#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 rtoki
# SPDX-License-Identifier: MIT

"""Build standalone HTML, a static website, or the original manuscript."""
import argparse
import base64
import hashlib
from html import escape
import json
from pathlib import Path
import re
import runpy
import shutil
import struct
import subprocess
import sys
import zlib
from scenario_pack import ROOT, load_manifest, local_file, browser_data, build_info

# TypeScript compilation
def compile_engine():
    compiler = ROOT / 'node_modules/typescript/bin/tsc'
    node = shutil.which('node')
    if not node or not compiler.is_file():
        raise SystemExit('TypeScriptの準備が必要です。game/ で npm ci を実行してください（Node.js 20以上）。')
    result = subprocess.run([node, str(compiler), '--project', str(ROOT / 'tsconfig.json')], cwd=ROOT)
    if result.returncode:
        raise SystemExit('TypeScriptの型チェックに失敗したため、ゲームの生成を中止しました。')
    return ROOT / 'build/typescript'


def engine_source(name, compiled):
    original = ROOT / 'engine' / name
    return (compiled / name if original.with_suffix('.ts').is_file() else original).read_text()

# Original app icons
def icon_png(size):
    # A counter window and a sheet of paper, inside the maskable safe circle.
    shapes = [
        (22, 25, 78, 68, (244, 215, 95)),
        (26, 29, 74, 64, (21, 27, 18)),
        (26, 37, 74, 41, (244, 215, 95)),
        (44, 44, 64, 72, (244, 215, 95)),
        (48, 49, 60, 52, (21, 27, 18)),
        (48, 56, 60, 59, (21, 27, 18)),
        (48, 63, 57, 66, (21, 27, 18)),
        (22, 73, 78, 77, (244, 215, 95)),
    ]
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            color = (21, 27, 18)
            for left, top, right, bottom, fill in shapes:
                if left * size <= x * 100 < right * size and top * size <= y * 100 < bottom * size:
                    color = fill
            rows.extend(color)
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b''))


def build_icons(root):
    folder = root / 'engine/icons'
    folder.mkdir(exist_ok=True)
    for size in (180, 192, 512):
        (folder / f'app-{size}.png').write_bytes(icon_png(size))

# Static site security policy
def security_headers(html):
    # Hash the final HTML, after media externalization. Never enable arbitrary
    # inline scripts to accommodate the single-file game's embedded runtime.
    scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
    if not scripts or len(re.findall(r'<script\b', html, re.I)) != len(scripts):
        raise ValueError('Review CSP before adding external or attributed script tags')
    hashes = sorted({
        "'sha256-" + base64.b64encode(hashlib.sha256(script.encode()).digest()).decode() + "'"
        for script in scripts
    })
    policy = '; '.join([
        "default-src 'none'",
        'script-src ' + ' '.join(hashes),
        "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        'font-src https://fonts.gstatic.com',
        "img-src 'self' data:",
        "media-src 'self' data:",
        "connect-src 'self'",
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
    ])
    return {
        'Content-Security-Policy': policy,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()',
    }

# Asset inventory and notices
LICENSES = ROOT / 'licenses'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def declared_assets():
    """Keep contributor credits from package manifests, including unused media."""
    from scenario_pack import local_file
    declarations = {}
    for manifest_path in sorted((ROOT / 'scenarios').glob('*/manifest.json')):
        manifest = json.loads(manifest_path.read_text())
        assets_path = local_file(manifest_path.parent, manifest['assets'])
        for asset in json.loads(assets_path.read_text()).values():
            path = local_file(manifest_path.parent, asset['file'])
            if sha(path) != asset.get('sha256'):
                raise ValueError('Asset no longer matches credit record: ' + str(path.relative_to(ROOT)))
            if not all(isinstance(asset.get(key), str) and asset[key].strip() for key in ('creator', 'license')):
                raise ValueError('Asset creator and license are required: ' + str(path.relative_to(ROOT)))
            record = {key: asset[key] for key in ('creator', 'license', 'source', 'title', 'changes', 'provenance', 'rights_scope') if key in asset}
            record['records'] = assets_path.relative_to(ROOT).as_posix()
            previous = declarations.get(path)
            if previous and any(previous.get(key) != record.get(key) for key in ('creator', 'license', 'source')):
                raise ValueError('Conflicting asset credits: ' + str(path.relative_to(ROOT)))
            declarations[path] = record
    return declarations


def build_licenses(html_path=None):
    policy = json.loads((LICENSES / 'policy.json').read_text())
    sources = json.loads((LICENSES / 'sources.json').read_text())
    for source in sources:
        if sha(LICENSES / source['file']) != source['sha256']:
            raise SystemExit('License source changed: ' + source['file'])
    (LICENSES / 'project-MIT.txt').write_bytes((ROOT.parent / 'LICENSE').read_bytes())
    tracks = json.loads((ROOT / 'audio/manifest.json').read_text())['tracks']
    audio = {track['file']: track for track in tracks}
    motion_records = {entry['file']: entry['render'] for entry in json.loads((ROOT / 'motion/manifest.json').read_text())}
    declarations = declared_assets()
    assets = []
    for folder in ('images', 'motion', 'audio', 'scenarios', 'engine/icons'):
        for path in sorted((ROOT / folder).rglob('*')):
            if path.suffix.lower() not in ('.png', '.webp', '.jpg', '.jpeg', '.mp4', '.mp3'):
                continue
            record = {'file': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
            if folder == 'engine/icons':
                record.update(license='MIT', creator=policy['creator'], source=policy['project_url'],
                              provenance='Original geometric interface icon rendered by project code.', records='scripts/build.py')
            elif folder == 'audio':
                track = audio[path.name]
                if record['sha256'] != track['sha256']:
                    raise SystemExit('Audio no longer matches credit record: ' + path.name)
                record.update(license=track['license'], creator=track['artistName'], title=track['title'], source=track['url'], changes=track['changes'])
            else:
                declaration = declarations.get(path.resolve())
                video = path.suffix == '.mp4'
                method = motion_records.get(record['file'], {}).get('method', '')
                if declaration:
                    record.update(declaration)
                    record.setdefault('provenance', 'Media supplied through a scenario asset manifest.')
                    if record['creator'] == policy['creator']:
                        record.setdefault('source', policy['project_url'])
                else:
                    record.update(license='CC-BY-4.0', creator=policy['creator'], source=policy['project_url'],
                                  rights_scope='Rights held by the creator only; no guarantee of copyright or exclusivity for AI-generated material.',
                                  provenance=(method if method.startswith('Masked procedural') else 'LivePortrait animation of original AI-generated art; no InsightFace models.') if video else 'Original AI-generated fictional art.',
                                  records='motion/README.md' if video else 'licenses/policy.json')
            assets.append(record)
    if {record['file'] for record in assets if record['file'].startswith('audio/')} != {'audio/' + track['file'] for track in tracks}:
        raise SystemExit('Audio inventory incomplete')
    write_json(LICENSES / 'assets.json', {'schema': 1, 'policy': 'policy.json', 'assets': assets})

    creator = escape(policy.get('creator_display_name', policy['creator']))
    if policy.get('creator_url'):
        creator = '<a href="' + escape(policy['creator_url'], quote=True) + '" target="_blank" rel="noopener noreferrer">' + creator + '</a>'
    paragraphs = '<h4>個人開発：' + creator + '</h4><p>' + escape(policy['personal_notice']) + '</p>'
    paragraphs += ''.join(f'<h4>{escape(scope["title"])} · {escape(scope["license"])}</h4><p>{escape(scope["text"])}</p>' for scope in policy['scopes'])
    paragraphs += '<h4>独自コンテンツのクレジット例</h4><blockquote>' + escape(policy['attribution']) + '</blockquote>'
    paragraphs += '<p>変更していない場合は変更欄を省けます。第三者の音楽等は、それぞれの作者・出典も引き継いでください。</p>'
    paragraphs += '<h4>参照元・制作</h4>' + ''.join('<p>' + escape(policy[key]) + '</p>' for key in ('upstream', 'motion', 'fonts', 'notice'))
    documents = []
    for item in policy['documents']:
        content = (LICENSES / item['file']).read_text()
        source = ('<p><a href="' + escape(item['source'], quote=True) + '" target="_blank" rel="noopener">原文の出典</a></p>') if item.get('source') else ''
        documents.append('<details class="license-document"><summary>' + escape(item['title']) + '</summary>' + source + '<pre>' + escape(content) + '</pre></details>')
    notices = '<div class="license-copy">' + paragraphs + '<h4>ライセンス全文</h4>' + ''.join(documents) + '</div>'
    # Escape '<' so legal text cannot terminate the surrounding script element.
    encoded = json.dumps(notices, ensure_ascii=False).replace('<', '\\u003c')
    block = '/* BEGIN LICENSE NOTICES */\nfunction licenseNoticesHTML(){return ' + encoded + ';}\n/* END LICENSE NOTICES */'
    index = Path(html_path) if html_path else ROOT / 'index.html'
    html = index.read_text()
    if '/* BEGIN LICENSE NOTICES */' in html:
        html, count = re.subn(r'/\* BEGIN LICENSE NOTICES \*/.*?/\* END LICENSE NOTICES \*/', lambda _: block, html, flags=re.S)
        assert count == 1
    else:
        assert html.count('function panelHTML(){') == 1
        html = html.replace('function panelHTML(){', block + '\n\nfunction panelHTML(){', 1)
    hook = '<details class="console-options license-notices"><summary>利用条件・クレジット</summary>${licenseNoticesHTML()}</details>'
    if hook not in html:
        anchor = '    ${madoLinksHTML()}\n    <h4>注意</h4>'
        assert html.count(anchor) == 1
        html = html.replace(anchor, '    ${madoLinksHTML()}\n    ' + hook + '\n    <h4>注意</h4>', 1)
    index.write_text(html)

    credits = ''.join('<li><a href="' + escape(track['url'], quote=True) + '">' + escape(track['title']) + '</a> — ' + escape(track['artistName']) + ' / <a href="' + escape(track['license_url'], quote=True) + '">' + escape(track['license']) + '</a><p>変更：' + escape(track['changes']) + '</p></li>' for track in tracks)
    body = '<p><a href="index.html">ゲームへ戻る</a></p><h1>利用条件・クレジット</h1><p>証明書窓口ドリル / ' + creator + '</p>' + notices
    body += '<h2>音楽</h2><ul>' + credits + '</ul><h2>素材の一覧・詳細</h2><p><a href="licenses/assets.json">制作素材の一覧</a> / <a href="https://madoguchi-drill.pages.dev/licenses/published-assets.json">公開版の配信ファイル一覧</a> / <a href="licenses/sources.json">ライセンス原文の出典</a> / <a href="licenses/policy.json">適用範囲のデータ</a></p>'
    page = '<!doctype html>\n<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>利用条件・クレジット — 証明書窓口ドリル</title><style>html{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#10160f;color:#f6edcd;font:16px/1.8 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:28px 20px 64px}h1{font-size:clamp(1.45rem,5vw,2rem)}h2,h4{color:#f3d954}h4{margin:1.5em 0 .4em;font-size:1.05rem}a{color:#f3d954;overflow-wrap:anywhere}blockquote{margin:1em 0;padding:1em;border-left:3px solid #f3d954;overflow-wrap:anywhere}summary{cursor:pointer;padding:.8em 0;color:#f3d954}details{border-bottom:1px solid #4d5032}pre{font:13px/1.6 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;padding:1em;background:#080e08;border-radius:4px}li{margin:1em 0}li p{margin:.3em 0;font-size:.9em}</style><main>' + body + '</main></html>\n'
    (ROOT / 'licenses.html').write_text(page)
    print(f'Licenses: {len(sources)} original notices, {len(assets)} media records, offline notices embedded.')

# Standalone assembly
def js_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')


def build_game(selection='komorebi', output=None):
    pack = load_manifest(selection)
    output = Path(output or (ROOT / 'index.html' if pack['id'] == 'komorebi' else ROOT / 'build' / pack['id'] / 'index.html')).resolve()
    compiled = compile_engine()
    engine = ROOT / 'engine'
    data = browser_data(pack)
    def media(key):
        asset = pack['assets'][key]
        return 'data:' + asset['mime'] + ';base64,' + base64.b64encode(local_file(pack['_dir'], asset['file']).read_bytes()).decode()
    tracks = {key: {**track, 'source': media(track['asset'])} for key, track in pack['music'].items()}
    motion = {key: {size: media(asset) for size, asset in sizes.items()} for key, sizes in pack['motion'].items()}
    # Asset metadata is available to build tools, not duplicated in the running game.
    for key in ['assets', 'styles', 'music', 'motion']:
        data.pop(key, None)
    runtime = 'const ENGINE=Object.freeze(' + js_json(pack['_engine']) + ');\nconst SCENARIO=' + js_json(data) + ';\n' + (engine / 'app.js').read_text()
    sound = engine_source('sound.js', compiled).replace('__JAZZ_TRACKS__', js_json(tracks)).replace('__STORY_SOUND_DIRECTION__', js_json(pack['sound']))
    runtime = runtime.replace('/* BUNDLE_SOUND */', sound)
    runtime = runtime.replace('/* BUNDLE_MOTION */', '/* BEGIN PORTRAIT MOTION */\nconst MOTION_ASSETS=' + js_json(motion) + ';\n' + engine_source('portrait-motion.js', compiled) + '\n/* END PORTRAIT MOTION */')
    reader = '\n'.join(engine_source(name, compiled) for name in ['counter-script.js', 'game-reader.js', 'family-reader.js', 'story-moments.js', 'console-ui.js', 'screen-mode.js'])
    reader += '\n' + '\n'.join(source.read_text() for source in pack['_extensions'])
    runtime = runtime.replace('/* BUNDLE_READER */', '/* BEGIN FAMILY READER */\n' + reader + '\n/* END FAMILY READER */')
    shell = (engine / 'shell.html').read_text()
    shell = shell.replace('<head>', '<head>\n<meta name="madoguchi-engine-version" content="' + pack['_engine']['version'] + '">\n<meta name="madoguchi-scenario-version" content="' + pack['version'] + '">')
    shell = re.sub(r'<!-- ENGINE_STYLE:(.*?) -->', lambda m: '<style id="' + ('portrait-motion-styles' if m[1] == 'portrait-motion.css' else 'family-reader-styles') + '">\n' + '\n'.join((engine / name).read_text() for name in m[1].split(',')) + '\n</style>', shell)
    styles = dict(pack['styles'])
    def replace_style(match):
        css = styles.pop(match[1], '')
        return '<style id="' + match[1] + '">' + css + '</style>' if css else ''
    shell = re.sub(r'<!-- PACK_STYLE:(.*?) -->', replace_style, shell)
    shell = shell.replace('<script>__APP_SCRIPT__</script>', ''.join('<style>'+css+'</style>' for css in styles.values())+'<script>__APP_SCRIPT__</script>')
    shell = re.sub(r'asset:([a-zA-Z0-9_-]+)', lambda m: media(m[1]), shell)
    html = shell.replace('__APP_SCRIPT__', runtime)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html)
    build_icons(ROOT)
    build_licenses(output)
    if pack['id'] == 'komorebi' and output == ROOT / 'index.html':
        (ROOT / 'story-family.json').write_text(json.dumps(pack['story'], ensure_ascii=False, indent=2)+'\n')
    print(f'Engine v{pack["_engine"]["version"]} / {pack["id"]} v{pack["version"]}: '
          f'{len(pack["story"]["blocks"])} chapters, {len(pack["story"]["nodes"])} scenes → {output}')
    return output

# Static web export
def build_web(selection="komorebi", output=None):
    root = ROOT
    pack = load_manifest(selection)
    out = (output or (root / 'web-dist' if pack['id'] == 'komorebi' else root / 'build' / pack['id'] / 'web')).resolve()
    source_html = root / 'index.html' if pack['id'] == 'komorebi' else root / 'build' / pack['id'] / 'index.html'
    build_game(selection, source_html)
    (out / 'assets').mkdir(parents=True, exist_ok=True)
    html = source_html.read_text()
    assets = set()
    source_assets = json.loads((root / 'licenses/assets.json').read_text())['assets']
    by_hash = {}
    for record in source_assets:
        by_hash.setdefault(record['sha256'], []).append(record)
    published = {}

    def record_asset(name, data, kind):
        digest = hashlib.sha256(data).hexdigest()
        originals = by_hash.get(digest, [])
        if not originals and kind != 'image':
            raise ValueError('Published media has no provenance: ' + name)
        if len({item['license'] for item in originals}) > 1:
            raise ValueError('Conflicting media licenses: ' + name)
        record = dict(originals[0]) if originals else {
            'license': 'CC-BY-4.0', 'creator': 'rtoki',
            'source': 'https://madoguchi-drill.pages.dev/',
            'rights_scope': 'Rights held by the creator only; no guarantee of copyright or exclusivity for AI-generated material.',
            'provenance': 'Optimized original AI-generated fictional art embedded in index.html.'
        }
        record.update(file='assets/' + name, sha256=digest, bytes=len(data), kind=kind,
                      original_files=[item['file'] for item in originals] or ['index.html (embedded optimized image)'])
        published[name] = record

    def externalize(match):
        data = base64.b64decode(match[2], validate=True)
        suffix = {'image/png':'.png', 'image/jpeg':'.jpg', 'image/webp':'.webp'}[match[1]]
        name = hashlib.sha256(data).hexdigest()[:16] + suffix
        (out / 'assets' / name).write_bytes(data)
        assets.add(name)
        record_asset(name, data, 'image')
        return 'url("assets/' + name + '")'

    html, count = re.subn(r'url\("data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)"\)', externalize, html)
    if not count:
        raise SystemExit('No embedded images found; input must be the standalone index.html.')

    def externalize_video(match):
        data = base64.b64decode(match[1], validate=True)
        name = hashlib.sha256(data).hexdigest()[:16] + '.mp4'
        (out / 'assets' / name).write_bytes(data)
        assets.add(name)
        record_asset(name, data, 'video')
        return '"assets/' + name + '"'

    html, video_count = re.subn(r'"data:video/mp4;base64,([A-Za-z0-9+/=]+)"', externalize_video, html)
    def externalize_audio(match):
        data = base64.b64decode(match[1], validate=True)
        name = hashlib.sha256(data).hexdigest()[:16] + '.mp3'
        (out / 'assets' / name).write_bytes(data)
        assets.add(name)
        record_asset(name, data, 'audio')
        return '"assets/' + name + '"'

    html, audio_count = re.subn(r'"data:audio/mpeg;base64,([A-Za-z0-9+/=]+)"', externalize_audio, html)
    # Web-only metadata keeps the standalone file free of missing manifest requests.
    icon_urls = {}
    for size in (180, 192, 512):
        data = (root / f'engine/icons/app-{size}.png').read_bytes()
        name = hashlib.sha256(data).hexdigest()[:16] + '.png'
        (out / 'assets' / name).write_bytes(data)
        assets.add(name)
        record_asset(name, data, 'image')
        icon_urls[size] = 'assets/' + name
    app_name = '証明書窓口ドリル' if pack['id'] == 'komorebi' else pack['name']
    manifest = {
        'id': './', 'name': app_name, 'short_name': app_name, 'lang': 'ja',
        'start_url': './', 'scope': './', 'display': 'standalone',
        'background_color': '#151b12', 'theme_color': '#151b12',
        'icons': [{'src': icon_urls[size], 'sizes': f'{size}x{size}', 'type': 'image/png', 'purpose': 'any maskable'} for size in (192, 512)]
    }
    (out / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    html = html.replace('</head>', '<link rel="manifest" href="manifest.webmanifest">\n'
        + '<meta name="theme-color" content="#151b12">\n'
        + '<meta name="apple-mobile-web-app-capable" content="yes">\n'
        + '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
        + '<meta name="apple-mobile-web-app-title" content="' + escape(app_name, quote=True) + '">\n'
        + '<link rel="apple-touch-icon" sizes="180x180" href="' + icon_urls[180] + '">\n</head>', 1)
    (out / 'audio').mkdir(exist_ok=True)
    for name in ['README.md', 'manifest.json', 'CC0-1.0.txt', 'CC-BY-4.0.txt']:
        (out / 'audio' / name).write_bytes((root / 'audio' / name).read_bytes())
    shutil.copytree(root / 'licenses', out / 'licenses', dirs_exist_ok=True)
    (out / 'licenses' / 'published-assets.json').write_text(json.dumps({
        'schema': 1, 'policy': 'policy.json', 'assets': [published[name] for name in sorted(published)]
    }, ensure_ascii=False, indent=2) + '\n')
    (out / 'licenses.html').write_bytes((root / 'licenses.html').read_bytes())
    # Remove only obsolete content-addressed files produced by this exporter.
    for path in (out / 'assets').iterdir():
        if re.fullmatch(r'[0-9a-f]{16}\.(png|jpg|webp|mp4|mp3)', path.name) and path.name not in assets:
            path.unlink()
    (out / 'index.html').write_text(html)
    (out / 'build-info.json').write_text(json.dumps(build_info(pack), ensure_ascii=False, indent=2) + '\n')
    (out / 'komorebi-17.html').write_bytes((root / 'komorebi-17.html').read_bytes())
    protection = '/*\n' + ''.join(f'  {name}: {value}\n' for name, value in security_headers(html).items())
    (out / '_headers').write_text(protection + '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n/manifest.webmanifest\n  Cache-Control: no-cache\n  Content-Type: application/manifest+json\n/build-info.json\n  Cache-Control: no-cache\n/komorebi-17.html\n  Cache-Control: no-cache\n/komorebi-17\n  Cache-Control: no-cache\n')
    files = [p for p in out.rglob('*') if p.is_file()]
    too_large = [str(p) for p in files if p.stat().st_size >= 25 * 1024 * 1024]
    if too_large:
        raise SystemExit('Files exceed the Pages 25 MiB asset limit: ' + ', '.join(too_large))
    print(f'{out}: {count} images, {video_count} optional videos, {audio_count} audio tracks, {len(html.encode()) / 1024:.0f} KiB HTML, {len(files)} files')
    return out


def build_manuscript():
    pack = ROOT / 'scenarios/komorebi'
    runpy.run_path(str(pack / 'compile-manuscript.py'), run_name='__main__')
    shutil.copyfile(pack / 'story.json', ROOT / 'story-family.json')
    shutil.copyfile(pack / 'authoring/STORY-FAMILY.md', ROOT / 'STORY-FAMILY.md')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    for name in ('web', 'standalone'):
        command = commands.add_parser(name)
        command.add_argument('--scenario', default='komorebi')
        command.add_argument('--out', type=Path)
    commands.add_parser('manuscript')
    notices = commands.add_parser('licenses')
    notices.add_argument('--html', type=Path)
    args = parser.parse_args(argv)
    if args.command == 'web':
        build_web(args.scenario, args.out)
    elif args.command == 'standalone':
        build_game(args.scenario, args.out)
    elif args.command == 'manuscript':
        build_manuscript()
    else:
        build_licenses(args.html)


if __name__ == '__main__':
    main()

// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

#!/usr/bin/env node
// Encode copies for distribution. The original PNG files are never modified.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [sourceArg, outputArg, sharpModule = 'sharp'] = process.argv.slice(2);
if (!sourceArg || !outputArg) throw new Error('Usage: node optimize-images.cjs images output [sharp-module-path]');
const sharp = require(sharpModule);
const source = path.resolve(sourceArg), output = path.resolve(outputArg);
fs.mkdirSync(output, {recursive:true});
const manifestPath = path.join(output, 'manifest.json');
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : {};
const digest = data => crypto.createHash('sha256').update(data).digest('hex');

(async () => {
  const manifest = {};
  for (const name of fs.readdirSync(source).filter(n => n.endsWith('.png')).sort()) {
    const id = path.basename(name, '.png'), original = fs.readFileSync(path.join(source, name));
    const document = /^(license|seal|mynumber|health-insurance|care-insurance)-jp$/.test(id);
    const settings = {quality:document ? 92 : 86, alphaQuality:100, effort:5};
    const resize = /^(health-insurance|care-insurance)-jp$/.test(id) ? 1024 : null;
    const key = digest(Buffer.concat([original, Buffer.from(JSON.stringify({settings, resize, sharp:sharp.versions.sharp, webp:sharp.versions.webp}))]));
    const file = id+'.webp', destination = path.join(output, file);
    if (previous[id]?.key === key && fs.existsSync(destination) && digest(fs.readFileSync(destination)) === previous[id].sha256) {
      manifest[id] = previous[id];
      continue;
    }
    let input = sharp(original);
    if (resize) input = input.resize({width:resize,height:resize,fit:'inside',withoutEnlargement:true});
    const encoded = await input.clone().webp(settings).toBuffer();
    const meta = await sharp(encoded).metadata();
    const originalMeta = await sharp(original).metadata();
    if (originalMeta.hasAlpha) {
      const before = await input.clone().ensureAlpha().extractChannel('alpha').raw().toBuffer();
      const after = await sharp(encoded).ensureAlpha().extractChannel('alpha').raw().toBuffer();
      if (!before.equals(after)) throw new Error('Transparency changed: '+id);
    }
    fs.writeFileSync(destination, encoded);
    manifest[id] = {file, key, sha256:digest(encoded), width:meta.width, height:meta.height, hasAlpha:meta.hasAlpha, bytes:encoded.length, originalBytes:original.length, quality:settings.quality};
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest,null,2)+'\n');
  const bytes = Object.values(manifest).reduce((n,a)=>n+a.bytes,0);
  console.log(`Optimized ${Object.keys(manifest).length} images: ${(bytes/1048576).toFixed(2)} MiB; original PNGs retained; transparency verified.`);
})().catch(error=>{console.error(error);process.exitCode=1;});

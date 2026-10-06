#!/usr/bin/env node
// Focus Canvas: renders layers.json to a picture, pixel for pixel what the editor page shows.
//   node compose.mjs <project> [--out renders/current.png] [--bump] [--jpg] [--scale 1]
// --bump writes a numbered final next to the project (<name>-vN.png) and raises the version in layers.json.
import fs from 'node:fs';
import path from 'node:path';
import { out, fail, parseArgs, resolveProject, loadLayers, saveLayers, SKILL } from './lib/common.mjs';
import { pageHtml, fileUrl } from './lib/render.mjs';

export async function compose(project, opts = {}) {
  const { chromium } = await import('playwright');
  const doc = loadLayers(project);
  const c = doc.canvas; const scale = +(opts.scale || 1);
  const html = pageHtml(doc, { assetUrl: (src) => fileUrl(path.resolve(project, src)), fontUrl: (f) => fileUrl(path.join(SKILL, 'assets', 'fonts', f)) });
  const tmp = path.join(project, 'renders', '.stage.html'); fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, html);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: scale });
    await page.goto(fileUrl(tmp));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))));
    await page.waitForTimeout(80);
    const missing = await page.evaluate(() => [...document.images].filter((im) => !im.naturalWidth).map((im) => im.getAttribute('src')));
    let outFile;
    if (opts.bump) { doc.version = (doc.version || 0) + 1; outFile = path.join(project, `${doc.name}-v${doc.version}.png`); saveLayers(project, doc, { version: false }); }
    else outFile = path.resolve(project, opts.out || 'renders/current.png');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const stage = await page.$('#stage');
    await stage.screenshot({ path: outFile, type: opts.jpg ? 'jpeg' : 'png', quality: opts.jpg ? 92 : undefined, omitBackground: false });
    if (opts.jpg && !outFile.endsWith('.jpg')) { fs.renameSync(outFile, outFile.replace(/\.png$/, '.jpg')); outFile = outFile.replace(/\.png$/, '.jpg'); }
    return { ok: missing.length === 0, file: outFile.replace(/\\/g, '/'), width: c.w * scale, height: c.h * scale, version: doc.version || 0, missingImages: missing };
  } finally { await browser.close(); }
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args._[0]) { console.log('node compose.mjs <project> [--out renders/current.png] [--bump] [--jpg] [--scale 1]'); process.exit(args.help ? 0 : 2); }
  const project = resolveProject(args._[0]);
  compose(project, { out: args.out, bump: !!args.bump, jpg: !!args.jpg, scale: args.scale }).then((r) => { out(r); if (!r.ok) process.exit(1); }).catch((e) => fail(String(e.message || e)));
}

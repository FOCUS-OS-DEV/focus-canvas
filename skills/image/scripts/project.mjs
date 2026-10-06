#!/usr/bin/env node
// Focus Canvas: the project folder.
//   node project.mjs init <name> [--platform ig-post | --size 1080x1440] [--title "..."] [--background "#0a0810"]
//   node project.mjs ingest <project> <file or folder>... [--as photos|brand|other]
//   node project.mjs status <project>
import fs from 'node:fs';
import path from 'node:path';
import { out, fail, parseArgs, PLATFORMS, SKILL, resolveProject, loadLayers, imageAspect } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (!cmd || args.help) {
  console.log(`project.mjs: the project folder of a Focus Canvas picture.

Usage:
  node project.mjs init <name> [--platform ig-post] [--size WxH] [--title "..."] [--background "#0a0810"]
  node project.mjs ingest <project> <file or folder>... [--as photos|brand|other]
  node project.mjs status <project>

Platforms: ${Object.keys(PLATFORMS).join(', ')}`);
  process.exit(args.help ? 0 : 2);
}

if (cmd === 'init') {
  const name = args._[1]; if (!name) fail('name the project');
  const dir = path.resolve(name);
  if (fs.existsSync(path.join(dir, 'layers.json'))) fail('the project already exists: ' + dir);
  let w, h, platform = args.platform || 'ig-post';
  if (args.size) { [w, h] = String(args.size).split('x').map(Number); platform = 'custom'; } else { const p = PLATFORMS[platform]; if (!p) fail('unknown platform: ' + platform); w = p.w; h = p.h; }
  for (const d of ['source/photos', 'source/brand', 'source/other', 'work/gen', 'work/cut', 'renders', 'exports', '_versions']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  const doc = JSON.parse(fs.readFileSync(path.join(SKILL, 'assets', 'template', 'layers.json'), 'utf8'));
  doc.name = path.basename(dir); doc.title = args.title || path.basename(dir); doc.canvas = { w, h, platform, background: args.background || doc.canvas.background || '#0a0810' };
  doc.version = 0; doc.created = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(dir, 'layers.json'), JSON.stringify(doc, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'costs.json'), '[]\n');
  out({ ok: true, project: dir.replace(/\\/g, '/'), name: doc.name, canvas: doc.canvas, folders: ['source/photos', 'source/brand', 'source/other', 'work/gen', 'work/cut', 'renders', 'exports', '_versions'], layers: 'layers.json' });
}

if (cmd === 'ingest') {
  const project = resolveProject(args._[1]);
  const items = args._.slice(2); if (!items.length) fail('name the files or folders to ingest');
  const kind = args.as || null; const IMG = /\.(png|jpe?g|webp|gif|svg|avif|tiff?)$/i;
  const copied = [], skipped = [];
  const safe = (n) => n.replace(/[^\w.֐-׿-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const take = (file) => {
    if (!IMG.test(file)) { skipped.push({ file, why: 'not an image' }); return; }
    const to = kind || (/logo|brand|לוגו/i.test(path.basename(file)) || /\.svg$/i.test(file) ? 'brand' : 'photos');
    const dest = path.join(project, 'source', to, safe(path.basename(file)));
    if (fs.existsSync(dest)) { skipped.push({ file, why: 'already there' }); return; }
    fs.copyFileSync(file, dest); copied.push({ file: path.relative(project, dest).replace(/\\/g, '/'), aspect: imageAspect(dest) });
  };
  for (const it of items) {
    const p = path.resolve(it);
    if (!fs.existsSync(p)) { skipped.push({ file: it, why: 'missing' }); continue; }
    if (fs.statSync(p).isDirectory()) { for (const f of fs.readdirSync(p)) { const fp = path.join(p, f); if (fs.statSync(fp).isFile()) take(fp); } }
    else take(p);
  }
  out({ ok: true, project: project.replace(/\\/g, '/'), copied, skipped });
}

if (cmd === 'status') {
  const project = resolveProject(args._[1]); const doc = loadLayers(project);
  const renders = fs.existsSync(path.join(project, 'renders')) ? fs.readdirSync(path.join(project, 'renders')).filter((f) => /\.(png|jpg)$/i.test(f)) : [];
  const costs = JSON.parse(fs.readFileSync(path.join(project, 'costs.json'), 'utf8') || '[]');
  const spent = costs.reduce((s, c) => s + (+c.cost_usd || 0), 0);
  out({ ok: true, project: project.replace(/\\/g, '/'), name: doc.name, canvas: doc.canvas, version: doc.version || 0, layers: (doc.layers || []).map((l) => ({ id: l.id, type: l.type, name: l.name, locked: !!l.locked, protect: !!l.protect, hidden: !!l.hidden })), renders, spentUsd: +spent.toFixed(3) });
}

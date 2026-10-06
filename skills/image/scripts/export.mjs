#!/usr/bin/env node
// Focus Canvas: the same picture in other sizes, and lighter copies.
//   node export.mjs <project> --to ig-story,square,linkedin [--jpg]     other platforms, from the same layers
//   node export.mjs <project> --jpg [--quality 90]                        a JPG of the current size
// A new size keeps every layer's relative centre and scales it by the smaller of the two ratios; full-canvas layers
// (a background or a wall that covers the whole picture) stretch to cover the new canvas. Results go to exports/.
import fs from 'node:fs';
import path from 'node:path';
import { out, fail, parseArgs, resolveProject, loadLayers, PLATFORMS } from './lib/common.mjs';
import { compose } from './compose.mjs';

const args = parseArgs(process.argv.slice(2));
if (args.help || !args._[0]) { console.log('node export.mjs <project> [--to ig-story,square,linkedin] [--jpg] [--quality 90]\nPlatforms: ' + Object.keys(PLATFORMS).join(', ')); process.exit(args.help ? 0 : 2); }
const project = resolveProject(args._[0]);
const doc = loadLayers(project); const c = doc.canvas; const results = [];
fs.mkdirSync(path.join(project, 'exports'), { recursive: true });

function retarget(doc, W, H) {
  const d = JSON.parse(JSON.stringify(doc)); const kx = W / c.w, ky = H / c.h, k = Math.min(kx, ky);
  d.canvas = { ...d.canvas, w: W, h: H };
  for (const l of d.layers) {
    const full = (l.x || 0) <= 0 && (l.y || 0) <= 0 && (l.w || 0) >= c.w - 1 && ((l.h == null && l.type === 'wall') || (l.h || 0) >= c.h - 1);
    if (full) { l.x = 0; l.y = 0; l.w = W; if (l.h != null || l.type === 'wall') l.h = H; if (l.type === 'image') l.fit = 'cover'; if (l.type === 'wall') { l.slotH = Math.round((l.slotH || 330) * k); l.gap = Math.round((l.gap ?? 8) * k); l.offsets = (l.offsets || []).map((o) => Math.round(o * k)); } continue; }
    const cx = (l.x || 0) + (l.w || 0) / 2, cy = (l.y || 0) + (l.h || (l.type === 'text' ? (l.size || 64) : 0)) / 2;
    const ncx = cx * kx, ncy = cy * ky;
    if (l.w) l.w = Math.round(l.w * k); if (l.h != null) l.h = Math.round(l.h * k);
    if (l.type === 'text') l.size = Math.round((l.size || 64) * k);
    l.x = Math.round(ncx - (l.w || 0) / 2); l.y = Math.round(ncy - (l.h || (l.type === 'text' ? (l.size || 64) : 0)) / 2);
  }
  return d;
}

try {
  const tos = args.to ? String(args.to).split(',').map((s) => s.trim()).filter(Boolean) : [];
  for (const to of tos) {
    const p = PLATFORMS[to]; if (!p) { results.push({ to, ok: false, error: 'unknown platform' }); continue; }
    const d = retarget(doc, p.w, p.h);
    const tmpDir = path.join(project, 'exports', '.tmp-' + to); fs.mkdirSync(path.join(tmpDir, 'renders'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'layers.json'), JSON.stringify(d));
    // the temporary project shares the sources of the real one
    for (const dir of ['source', 'work']) { const link = path.join(tmpDir, dir); if (!fs.existsSync(link)) { try { fs.symlinkSync(path.join(project, dir), link, 'junction'); } catch { fs.cpSync(path.join(project, dir), link, { recursive: true }); } } }
    const outFile = path.join(project, 'exports', `${doc.name}-${to}.${args.jpg ? 'jpg' : 'png'}`);
    const r = await compose(tmpDir, { out: outFile, jpg: !!args.jpg });
    results.push({ to, ok: r.ok, file: r.file, width: p.w, height: p.h });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  if (!tos.length && args.jpg) {
    const outFile = path.join(project, 'exports', `${doc.name}.jpg`);
    const r = await compose(project, { out: outFile, jpg: true });
    results.push({ to: 'jpg', ok: r.ok, file: r.file, width: c.w, height: c.h });
  }
  if (!results.length) fail('say what to export: --to ig-story,square or --jpg');
  out({ ok: results.every((r) => r.ok), results });
} catch (e) { fail(String(e.message || e)); }

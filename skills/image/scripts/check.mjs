#!/usr/bin/env node
// Focus Canvas: the gate. Run it before the user sees a picture. It reads layers.json and the current render.
//   node check.mjs <project> [--render renders/current.png]
// FAIL stops the picture; WARN is said to the user in one line.
import fs from 'node:fs';
import path from 'node:path';
import { out, fail, parseArgs, resolveProject, loadLayers, PLATFORMS, hasHebrew } from './lib/common.mjs';
import { wallLayout } from './lib/render.mjs';

const args = parseArgs(process.argv.slice(2));
if (args.help || !args._[0]) { console.log('node check.mjs <project> [--render renders/current.png]'); process.exit(args.help ? 0 : 2); }
const project = resolveProject(args._[0]);
const doc = loadLayers(project); const c = doc.canvas; const findings = [];
const add = (level, check, message, layer) => findings.push({ level, check, message, ...(layer ? { layer } : {}) });
const safe = (PLATFORMS[c.platform] || {}).safe || { top: 40, bottom: 40, left: 40, right: 40 };
const safeBox = { x: safe.left, y: safe.top, x2: c.w - safe.right, y2: c.h - safe.bottom };
const lum = (hex) => { const m = String(hex || '').replace('#', ''); if (m.length < 6) return null; const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// 1. the render exists and has the right size
const renderFile = path.resolve(project, args.render || 'renders/current.png');
let sharp = null; let img = null;
try { sharp = (await import('sharp')).default; } catch {}
if (!fs.existsSync(renderFile)) add('FAIL', 'render', 'no render yet: run compose.mjs first');
else if (sharp) { img = sharp(renderFile); const m = await img.metadata(); if (m.width !== c.w || m.height !== c.h) add('FAIL', 'size', `the render is ${m.width}x${m.height}, the canvas is ${c.w}x${c.h}`); }

for (const l of doc.layers || []) {
  if (l.hidden) continue;
  const w = +l.w || 0, h = l.h == null ? null : +l.h;
  // 2. nothing important falls off the canvas
  if (l.type !== 'wall' && l.type !== 'image') {
    if ((l.x || 0) < 0 || (l.y || 0) < 0 || (l.x || 0) + w > c.w + 1 || (h != null && (l.y || 0) + h > c.h + 1)) add('WARN', 'off-canvas', `"${l.name || l.id}" reaches outside the picture`, l.id);
  }
  if (l.type === 'text') {
    // 3. text inside the safe zone of the platform
    const x = l.x || 0, y = l.y || 0, tw = l.w || 0;
    if (x < safeBox.x || y < safeBox.y || (tw && x + tw > safeBox.x2)) add('WARN', 'safe-zone', `the text "${String(l.text).slice(0, 24)}" sits outside the safe zone of ${c.platform} (${safe.left}/${safe.top}/${safe.right}/${safe.bottom} px from the edges)`, l.id);
    // 4. readable size
    const min = Math.round(c.w * 0.026);
    if ((l.size || 64) < min) add('FAIL', 'text-size', `the text "${String(l.text).slice(0, 24)}" is ${l.size}px; at this width the smallest readable size is ${min}px`, l.id);
    // 5. Hebrew copy rules: no hyphen between Hebrew words, no double spaces
    if (hasHebrew(l.text) && /[֐-׿]\s*[-–—]\s*[֐-׿]/.test(l.text)) add('WARN', 'hebrew-hyphen', `a hyphen between Hebrew words in "${String(l.text).slice(0, 30)}": use a comma, a period or a line break`, l.id);
    if (/\s{2,}/.test(l.text)) add('WARN', 'spaces', `double spaces in "${String(l.text).slice(0, 30)}"`, l.id);
    // 6. contrast: the text colour against what the render shows behind it
    if (img && l.color) {
      try {
        const bw = Math.max(8, Math.min(c.w - x, tw || Math.round((l.size || 64) * 0.6 * String(l.text).length))), bh = Math.max(8, Math.min(c.h - y, Math.round((l.size || 64) * (l.lineHeight || 1.2) * (String(l.text).split('\n').length))));
        const { data, info } = await sharp(renderFile).extract({ left: Math.max(0, Math.round(x)), top: Math.max(0, Math.round(y)), width: Math.round(bw), height: Math.round(bh) }).resize(8, 8, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        let s = 0; for (let i = 0; i < info.width * info.height; i++) { const r = data[i * 3] / 255, g = data[i * 3 + 1] / 255, b = data[i * 3 + 2] / 255; const f = (v) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); s += 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
        const bg = s / (info.width * info.height); const tl = lum(l.color);
        if (tl != null) { const ratio = (Math.max(bg, tl) + 0.05) / (Math.min(bg, tl) + 0.05); if (ratio < 2.5 && !(l.background && l.background.color) && !(l.stroke && l.stroke.width)) add('WARN', 'contrast', `the text "${String(l.text).slice(0, 24)}" has a contrast of ${ratio.toFixed(1)} against what is behind it (3 or more reads well): add a box, a stroke or a darker patch`, l.id); }
      } catch {}
    }
  }
  if (l.type === 'image') {
    const f = path.resolve(project, l.src || '');
    if (!l.src || !fs.existsSync(f)) add('FAIL', 'missing-file', `the picture of "${l.name || l.id}" is missing: ${l.src}`, l.id);
    else if (l.protect && !/^source\//.test(String(l.src).replace(/\\/g, '/'))) add('WARN', 'protect', `"${l.name || l.id}" is marked protected but does not come from source/ (the originals folder)`, l.id);
    if (l.w && l.w > c.w * 1.6) add('WARN', 'oversize', `"${l.name || l.id}" is much wider than the picture`, l.id);
  }
  if (l.type === 'wall') {
    const slots = wallLayout({ ...l, w: l.w || c.w, h: l.h || c.h });
    const seen = {}; let empty = 0; const dup = [];
    for (const s of slots) { const it = (l.slots || {})[s.id]; if (!it || !it.photo) { if (s.y < c.h - 40) empty++; continue; } if (seen[it.photo]) dup.push(it.photo); seen[it.photo] = 1; const f = path.resolve(project, (l.pool || 'source/photos'), it.photo); if (!fs.existsSync(f)) add('FAIL', 'missing-file', `a wall photo is missing: ${it.photo}`, l.id); }
    if (dup.length) add('WARN', 'wall-repeat', `the same photo appears twice on the wall: ${[...new Set(dup)].join(', ')}`, l.id);
    if (empty) add('WARN', 'wall-empty', `${empty} empty slots on the wall`, l.id);
  }
}
const failN = findings.filter((f) => f.level === 'FAIL').length, warnN = findings.filter((f) => f.level === 'WARN').length;
out({ ok: failN === 0, fail: failN, warn: warnN, platform: c.platform, canvas: { w: c.w, h: c.h }, findings });
process.exit(failN ? 1 : 0);

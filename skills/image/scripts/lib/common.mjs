// Shared helpers of the Focus Canvas tools: paths, JSON output, the layers file, platforms and fonts.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FONTS_DIR = path.join(SKILL, 'assets', 'fonts');
export const HOME = path.join(os.homedir(), '.focus-canvas');

export function out(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }
export function fail(message, extra = {}, code = 1) { out({ ok: false, error: message, ...extra }); process.exit(code); }
export function note(s) { process.stderr.write(s + '\n'); }

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2); const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[k] = true; else { args[k] = next; i++; }
    } else if (a.includes('=') && !a.startsWith('-') && !/^[A-Za-z]:[\\/]/.test(a)) { const [k, ...v] = a.split('='); args[k] = v.join('='); }
    else args._.push(a);
  }
  return args;
}

export function resolveProject(p) {
  if (!p) fail('name the project folder');
  const abs = path.resolve(p);
  if (!fs.existsSync(path.join(abs, 'layers.json'))) fail('not a Focus Canvas project (no layers.json): ' + abs);
  return abs;
}

export function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (fallback !== undefined) return fallback; throw e; } }
export function writeJson(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n'); }

export function loadLayers(project) { return readJson(path.join(project, 'layers.json')); }
export function saveLayers(project, doc, { version = true } = {}) {
  const file = path.join(project, 'layers.json');
  if (version && fs.existsSync(file)) {
    const vdir = path.join(project, '_versions'); fs.mkdirSync(vdir, { recursive: true });
    fs.copyFileSync(file, path.join(vdir, 'layers-' + stamp() + '.json'));
  }
  writeJson(file, doc);
  return file;
}
export function stamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }

// Platforms: the canvas size and the safe zone (how far text stays from each edge, in px of that canvas).
export const PLATFORMS = {
  'ig-post': { w: 1080, h: 1440, safe: { top: 60, bottom: 60, left: 60, right: 60 }, note: 'Instagram feed post, 3:4' },
  'ig-post-45': { w: 1080, h: 1350, safe: { top: 60, bottom: 60, left: 60, right: 60 }, note: 'Instagram feed post, 4:5' },
  'square': { w: 1080, h: 1080, safe: { top: 60, bottom: 60, left: 60, right: 60 }, note: 'square, Instagram and WhatsApp' },
  'ig-story': { w: 1080, h: 1920, safe: { top: 250, bottom: 360, left: 80, right: 80 }, note: 'Instagram story or reel cover, 9:16' },
  'linkedin': { w: 1200, h: 627, safe: { top: 40, bottom: 40, left: 60, right: 60 }, note: 'LinkedIn link image' },
  'facebook': { w: 1200, h: 630, safe: { top: 40, bottom: 40, left: 60, right: 60 }, note: 'Facebook link image' },
  'a4-poster': { w: 1240, h: 1754, safe: { top: 80, bottom: 80, left: 80, right: 80 }, note: 'A4 at 150 dpi' },
};

export function fontFaces() {
  const list = readJson(path.join(FONTS_DIR, 'fonts.json'), { fonts: [] }).fonts;
  return list.map((f) => ({ family: f.family, dir: f.dir, files: f.files, weights: f.weights || null, variable: !!f.variable }));
}

export function hasHebrew(s) { return /[֐-׿]/.test(s || ''); }

export function layerBox(l, imgAspect) {
  // the box of a layer in canvas px: x, y, w, h (h of an image with no h comes from its aspect)
  const w = +l.w || 0;
  let h = l.h == null ? null : +l.h;
  if (h == null && l.type === 'image' && imgAspect) h = w / imgAspect;
  return { x: +l.x || 0, y: +l.y || 0, w, h: h == null ? 0 : h };
}

export function imageAspect(file) {
  try {
    const buf = fs.readFileSync(file);
    // png
    if (buf[0] === 0x89 && buf[1] === 0x50) return buf.readUInt32BE(16) / buf.readUInt32BE(20);
    // jpeg: walk the markers for SOF0/SOF2
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length) { if (buf[i] !== 0xff) { i++; continue; } const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) { const h = buf.readUInt16BE(i + 5), w = buf.readUInt16BE(i + 7); return w / h; } i += 2 + len; }
    }
    // webp (VP8X) and others: let sharp answer when available
  } catch {}
  return null;
}

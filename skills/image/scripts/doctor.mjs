#!/usr/bin/env node
// Focus Canvas: checks the computer once. Node 20+, the two packages, the browser, the fonts, and which keys exist.
//   node doctor.mjs [--selftest]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { out, parseArgs, SKILL, FONTS_DIR, HOME } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2));
const r = { ok: true, node: process.version, missing: [], notes: [] };
const major = +process.version.slice(1).split('.')[0];
if (major < 20) { r.ok = false; r.missing.push({ what: 'Node.js 20 or newer', install: 'https://nodejs.org' }); }
const root = path.resolve(SKILL, '..', '..');
const nm = path.join(root, 'node_modules');
for (const pkg of ['playwright', 'sharp']) {
  if (!fs.existsSync(path.join(nm, pkg))) { r.ok = false; r.missing.push({ what: pkg, install: `cd "${root}" && npm install` }); }
}
r.packages = fs.existsSync(nm) ? 'installed' : 'missing';
let browser = 'unknown';
if (fs.existsSync(path.join(nm, 'playwright'))) {
  try {
    const { chromium } = await import('playwright');
    const b = await chromium.launch({ headless: true }); const v = b.version(); await b.close(); browser = 'chromium ' + v;
  } catch (e) {
    browser = 'missing';
    if (args.install) { try { execSync('npx playwright install chromium', { cwd: root, stdio: 'inherit' }); browser = 'installed now'; } catch { r.ok = false; } }
    else { r.ok = false; r.missing.push({ what: 'the browser of playwright', install: `cd "${root}" && npx playwright install chromium` }); }
  }
}
r.browser = browser;
r.fonts = fs.existsSync(path.join(FONTS_DIR, 'fonts.json')) ? JSON.parse(fs.readFileSync(path.join(FONTS_DIR, 'fonts.json'), 'utf8')).fonts.map((f) => f.family) : [];
const envFile = path.join(HOME, '.env');
const envText = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
r.keys = { OPENAI_API_KEY: !!(process.env.OPENAI_API_KEY || /OPENAI_API_KEY=\S/.test(envText)), FAL_KEY: !!(process.env.FAL_KEY || process.env.FALAI_API_KEY || /FAL(AI_API)?_KEY=\S/.test(envText)), file: envFile };
if (!r.keys.OPENAI_API_KEY) r.notes.push('no OpenAI key: pictures cannot be generated or edited until one is put in ' + envFile);
if (!r.keys.FAL_KEY) r.notes.push('no fal key: cut and expand are off until one is put in ' + envFile);
fs.mkdirSync(HOME, { recursive: true });
if (args.selftest && r.ok) {
  try {
    const { compose } = await import('./compose.mjs');
    const ex = path.join(SKILL, 'assets', 'examples', 'hello');
    const res = await compose(ex, { out: 'renders/current.png' });
    r.selftest = res;
  } catch (e) { r.selftest = { ok: false, error: String(e.message || e) }; r.ok = false; }
}
if (args.write) fs.writeFileSync(path.join(HOME, 'state.json'), JSON.stringify({ checked: new Date().toISOString(), node: r.node, browser: r.browser }, null, 2));
out(r);
process.exit(r.ok ? 0 : 1);

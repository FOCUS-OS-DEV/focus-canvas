#!/usr/bin/env node
// Focus Canvas: checks the computer once. Node 20+, the two packages, the browser, the fonts, and which MCP servers
// can make pictures (pictures are generated through an MCP connection only; this skill holds no API key).
//   node doctor.mjs [--selftest] [--write] [--probe] [--tools "mcp__x__a,..."] [--cwd <dir>]
// --probe asks `claude mcp list` whether each server connects (a few seconds). --tools passes the tool names of the
// running session, so a server is confirmed by its tools. Never prints a key.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { out, parseArgs, SKILL, FONTS_DIR, HOME } from './lib/common.mjs';
import { detect, UNVERIFIED } from './mcp.mjs';

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

// Picture generation: an MCP connection, or nothing. Composing, the editor, the gate and the exports need none.
const mcp = detect({ cwd: args.cwd || process.cwd(), probe: !!args.probe, tools: args.tools === true ? '' : args.tools });
r.mcp = {
  verifiedBySession: mcp.verifiedBySession,
  imageCapable: mcp.imageCapable,
  notConnected: mcp.notConnected,
  maybeImageCapable: mcp.maybeImageCapable,
  providersFound: mcp.providersFound,
  recommended: mcp.recommended,
  configsRead: [...mcp.clients.claudeCode.files, ...mcp.clients.codex.files],
  probe: mcp.probe,
  offer: mcp.offer,
  rule: mcp.rule,
};
if (!mcp.imageCapable.length) {
  r.notes.push('no MCP server that makes pictures is usable in this session: composing, editing, the gate and exports work; generating, cutting and expanding wait until the user chooses and installs one (see mcp.offer). Nothing is installed without the user\'s yes.');
} else {
  const needsAuth = mcp.imageCapable.filter((s) => s.status && s.status !== 'connected' && s.status !== UNVERIFIED);
  if (needsAuth.length) r.notes.push('these picture servers exist but do not connect yet: ' + needsAuth.map((s) => `${s.name} (${s.status})`).join(', ') + '. In Claude Code: /mcp, choose the server, Authenticate. In Codex: codex mcp login <name>.');
  if (!mcp.verifiedBySession) r.notes.push('the picture servers above are configured, not verified: run again with --tools "<the mcp__ tool names of this session>" to confirm them.');
  if (!mcp.providersFound.includes('fal') && !mcp.providersFound.includes('replicate')) r.notes.push('cutouts and expanding are verified on fal and Replicate only; with Higgsfield alone, list its tools before promising a cutout.');
}
if (mcp.notConnected.length) r.notes.push('configured, but not connected in this session: ' + mcp.notConnected.map((s) => `${s.name} (${s.status})`).join(', ') + '. In Claude Code: /mcp, choose the server, Authenticate, then a fresh session. In Codex: codex mcp login <name>. The offer stands until one connects.');
if (mcp.maybeImageCapable.length) r.notes.push('servers that may make pictures, to confirm by their tool names (--tools): ' + mcp.maybeImageCapable.map((s) => s.name).join(', '));

fs.mkdirSync(HOME, { recursive: true });
if (args.selftest && r.ok) {
  try {
    const { compose } = await import('./compose.mjs');
    const ex = path.join(SKILL, 'assets', 'examples', 'hello');
    const res = await compose(ex, { out: 'renders/current.png' });
    r.selftest = res;
  } catch (e) { r.selftest = { ok: false, error: String(e.message || e) }; r.ok = false; }
}
if (args.write) fs.writeFileSync(path.join(HOME, 'state.json'), JSON.stringify({ checked: new Date().toISOString(), node: r.node, browser: r.browser, mcp: { providersFound: mcp.providersFound, imageCapable: mcp.imageCapable.map((s) => s.name) } }, null, 2));
out(r);
process.exit(r.ok ? 0 : 1);

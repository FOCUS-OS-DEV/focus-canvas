#!/usr/bin/env node
// Focus Canvas: which MCP servers exist on this computer, and which of them can make pictures. Never prints a key.
//   node mcp.mjs                      read the MCP configs of Claude Code and Codex and print what exists
//   node mcp.mjs --probe              also ask `claude mcp list` whether each server connects (slow, a few seconds)
//   node mcp.mjs --tools "a,b,c"      the tool names of the running session (mcp__<server>__<tool>), to confirm a
//                                     server by its tools and to find image tools on servers this file does not know
//   node mcp.mjs --offer              print the three providers to offer when nothing exists: install lines, prices, terms
//   node mcp.mjs --cwd <dir>          the project folder whose .mcp.json and .codex/config.toml are read (default: cwd)
// Pictures are generated through an MCP connection only. This tool never reads, prints or stores an API key:
// URLs lose their query, header values and env values are never shown, long tokens in arguments are redacted.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { out, parseArgs } from './lib/common.mjs';

export const READ_ON = '2026-10-09';

// The three providers the skill knows, with what was read from their official pages on READ_ON.
export const PROVIDERS = {
  fal: {
    label: 'fal',
    host: /(^|\.)mcp\.fal\.ai$/i,
    name: /^(fal|fal-ai|falai|fal_ai)$/i,
    claude: 'claude mcp add --transport http --scope user fal https://mcp.fal.ai/mcp-relay',
    claudeAuth: 'then inside Claude Code: /mcp, choose fal, Authenticate (browser sign-in). Start a fresh session.',
    codex: 'codex mcp add fal --url https://mcp.fal.ai/mcp-relay',
    codexAuth: 'then: codex mcp login fal (browser sign-in). Start a fresh session.',
    auth: 'OAuth in the browser. No API key anywhere.',
    payment: 'prepaid credits, pay as you go, no subscription. You load money first and every picture is deducted.',
    prices: 'Nano Banana Pro $0.15 a picture, Nano Banana 2 $0.08 a picture, FLUX 3 $0.024 per megapixel (fal.ai/pricing, read 2026-10-09). Cutouts and expanding: ask get_pricing for fal-ai/birefnet/v2 and fal-ai/bria/expand before quoting.',
    load: 'load a few dollars at a time (5 to 10). Credits buy only what you asked for; there is no monthly fee.',
    covers: 'new pictures, edits from references, cutouts, expanding: the whole pipeline of this skill.',
    sources: ['https://fal.ai/docs/documentation/setting-up/mcp', 'https://fal.ai/docs/documentation/setting-up/mcp/claude-code', 'https://fal.ai/docs/documentation/setting-up/mcp/codex-cli', 'https://fal.ai/pricing', 'https://fal.ai/docs/documentation/model-apis/pricing'],
  },
  replicate: {
    label: 'Replicate',
    host: /(^|\.)mcp\.replicate\.com$/i,
    command: /replicate-mcp|mcp-replicate/i,
    name: /^replicate/i,
    claude: 'claude mcp add replicate https://mcp.replicate.com/sse --transport sse --scope user',
    claudeAuth: 'then inside Claude Code: /mcp, choose replicate, Authenticate (browser: sign in to Replicate and approve). Start a fresh session.',
    codex: 'codex mcp add replicate --env REPLICATE_API_TOKEN=<your token> -- npx -y replicate-mcp@latest',
    codexAuth: 'the official Codex route keeps your Replicate token inside the Codex connection (not in this skill, which never sees it). If you prefer no token in a file, choose fal or Higgsfield for Codex.',
    auth: 'Claude Code: OAuth in the browser. Codex: the token inside the Codex connection.',
    payment: 'pay as you go, no subscription. Two ways on replicate.com: prepaid credit (you buy first, usage deducts), or a card charged at the start of each month for the previous month (it may charge early the first time usage crosses a limit).',
    prices: 'flux-1.1-pro $0.04 a picture, flux-dev $0.025, flux-schnell $3 per 1,000, ideogram-v3-quality $0.09, recraft-v3 $0.04 (replicate.com/pricing, read 2026-10-09). Nano Banana Pro and background removers: read the price on the model page before quoting.',
    load: 'choose prepaid credit and load a few dollars at a time, so nothing is charged beyond what you put in.',
    covers: 'new pictures, edits, background removal and expanding through models found with search_models.',
    sources: ['https://mcp.replicate.com/', 'https://replicate.com/docs/reference/mcp', 'https://replicate.com/pricing', 'https://replicate.com/docs/topics/billing'],
  },
  higgsfield: {
    label: 'Higgsfield',
    host: /(^|\.)mcp\.higgsfield\.ai$/i,
    name: /^higgsfield/i,
    claude: 'claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp',
    claudeAuth: 'then inside Claude Code: /mcp, choose higgsfield, Authenticate (browser sign-in to your Higgsfield account). Start a fresh session.',
    codex: 'codex mcp add higgsfield --url https://mcp.higgsfield.ai/mcp',
    codexAuth: 'then: codex mcp login higgsfield (browser). This is the Codex pattern for an OAuth server; it was not verified against Higgsfield on 2026-10-09.',
    auth: 'OAuth in the browser. No API key anywhere.',
    payment: 'a recurring monthly subscription with a fixed bag of credits. Via MCP every picture costs credits: the "unlimited" and "free generations" of the plans work only on higgsfield.ai, not on MCP or CLI (their pricing page says so).',
    prices: 'Starter $19 a month for 270 credits (about 135 Nano Banana Pro pictures at 2 credits each), Plus $59 a month or $47 a month billed annually for 1,200 credits, Ultra $129 a month or $99 billed annually for 3,000 credits. Subscription credits reset every month and do not roll over (higgsfield.ai/pricing, read 2026-10-09; roll-over per krea.ai guide of 2026-09-05).',
    load: 'there is no small prepaid entry: the smallest plan is $19 a month. Cancel the plan when you do not need it.',
    covers: 'new pictures and edits with references (GPT Image, Nano Banana Pro, FLUX, Seedream, Soul). Cutouts and expanding via MCP were not verified: list the tools at runtime.',
    sources: ['https://higgsfield.ai/mcp', 'https://higgsfield.ai/pricing', 'https://mcp.higgsfield.ai/.well-known/oauth-protected-resource'],
  },
};
export const RESPONSIBILITY = 'Usage and spend are yours: the account, the plan, the credits and every picture generated with them. The skill quotes before and reports after, and never runs a paid step you did not say yes to.';

// Tool names that generate or change pictures, for servers this file does not know.
const IMAGE_TOOL = /(generate|create|make|render|edit|inpaint|outpaint|upscale|expand|remove|cut|txt2img|text_to_image|img2img|image_to_image|run_model|create_predictions|invoke)/i;
const IMAGE_WORD = /(image|picture|photo|img|background|flux|banana|diffusion|predictions|run_model|generate_image)/i;
const IMAGE_HINT = /(image|imagegen|picture|photo|flux|stability|stable-?diffusion|dall|gpt-?image|ideogram|recraft|leonardo|midjourney|comfy|nano-?banana|imagen|higgsfield|fal|replicate)/i;

const sanitizeUrl = (u) => { try { const x = new URL(String(u)); return x.protocol + '//' + x.host + x.pathname; } catch { return '<url>'; } };
const SECRET_ARG = /^--?(api[-_]?key|token|key|secret|auth|password|bearer)/i;
function sanitizeArgs(args) {
  const outArgs = []; let hide = false;
  for (const a of args || []) {
    const s = String(a);
    if (hide) { outArgs.push('<redacted>'); hide = false; continue; }
    if (SECRET_ARG.test(s)) { if (s.includes('=')) outArgs.push(s.split('=')[0] + '=<redacted>'); else { outArgs.push(s); hide = true; } continue; }
    if (/^[A-Za-z0-9_\-]{24,}$/.test(s) && !/^[a-z@][a-z0-9@/._-]*$/i.test(s)) { outArgs.push('<redacted>'); continue; }
    outArgs.push(s.replace(/(key|token|secret)=[^&\s]+/gi, '$1=<redacted>'));
  }
  return outArgs;
}

function providerOf({ name, url, command, args }) {
  let host = ''; try { host = new URL(String(url || '')).host; } catch {}
  const cmd = [command || '', ...(args || [])].join(' ');
  for (const [key, p] of Object.entries(PROVIDERS)) {
    if (host && p.host.test(host)) return key;
    if (p.command && p.command.test(cmd)) return key;
    if (p.name.test(String(name || ''))) return key;
  }
  return null;
}

function entry(client, scope, name, cfg, where) {
  const url = cfg.url ? sanitizeUrl(cfg.url) : null;
  const transport = cfg.type || cfg.transport || (cfg.url ? (/\/sse$/i.test(cfg.url) ? 'sse' : 'http') : 'stdio');
  const provider = providerOf({ name, url: cfg.url, command: cfg.command, args: cfg.args });
  const text = [name, url || '', cfg.command || '', ...(cfg.args || [])].join(' ');
  return {
    name, client, scope, transport, where,
    url, command: cfg.command ? [cfg.command, ...sanitizeArgs(cfg.args)].join(' ') : null,
    headers: cfg.headers ? Object.keys(cfg.headers) : undefined,
    env: cfg.env ? Object.keys(cfg.env) : undefined,
    provider,
    imageCapable: provider ? true : (IMAGE_HINT.test(text) ? 'maybe' : false),
  };
}

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

// Claude Code: ~/.claude.json (user scope under mcpServers, local scope under projects[<path>].mcpServers) and .mcp.json (project scope)
function claudeServers(cwd) {
  const list = []; const files = [];
  const home = path.join(os.homedir(), '.claude.json');
  const j = readJson(home);
  if (j) {
    files.push(home);
    for (const [n, c] of Object.entries(j.mcpServers || {})) list.push(entry('claude-code', 'user', n, c, home));
    for (const [proj, v] of Object.entries(j.projects || {})) {
      for (const [n, c] of Object.entries((v && v.mcpServers) || {})) list.push(entry('claude-code', 'local', n, c, home + ' (project ' + proj + ')'));
    }
  }
  let dir = path.resolve(cwd);
  for (let i = 0; i < 6; i++) {
    const f = path.join(dir, '.mcp.json'); const pj = readJson(f);
    if (pj) { files.push(f); for (const [n, c] of Object.entries(pj.mcpServers || {})) list.push(entry('claude-code', 'project', n, c, f)); break; }
    const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  return { list, files };
}

// Codex: ~/.codex/config.toml and .codex/config.toml, tables [mcp_servers.<name>] with url or command/args.
function parseCodexToml(text) {
  const servers = {}; let cur = null; let sub = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim(); if (!line) continue;
    const sec = line.match(/^\[\s*mcp_servers\.("?)([^\]"]+)\1(?:\.([a-z_]+))?\s*\]$/i);
    if (sec) { cur = sec[2]; sub = sec[3] || null; servers[cur] = servers[cur] || {}; if (sub) servers[cur][sub] = servers[cur][sub] || {}; continue; }
    if (/^\[/.test(line)) { cur = null; sub = null; continue; }
    if (!cur) continue;
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/); if (!kv) continue;
    const key = kv[1]; let val = kv[2].trim();
    if (sub) { servers[cur][sub][key] = '<hidden>'; continue; }
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
    else if (/^\[.*\]$/.test(val)) val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else if (/^\{.*\}$/.test(val)) { const o = {}; for (const m of val.slice(1, -1).matchAll(/"([^"]+)"\s*=/g)) o[m[1]] = '<hidden>'; val = o; }
    servers[cur][key] = val;
  }
  return servers;
}
function codexServers(cwd) {
  const list = []; const files = [];
  for (const f of [path.join(os.homedir(), '.codex', 'config.toml'), path.join(path.resolve(cwd), '.codex', 'config.toml')]) {
    if (!fs.existsSync(f)) continue; files.push(f);
    let servers = {}; try { servers = parseCodexToml(fs.readFileSync(f, 'utf8')); } catch {}
    for (const [n, c] of Object.entries(servers)) {
      if (c.enabled === 'false' || c.enabled === false) continue;
      const cfg = { url: c.url, command: c.command, args: Array.isArray(c.args) ? c.args : (c.args ? [c.args] : []), env: c.env, headers: c.http_headers };
      if (c.bearer_token_env_var) cfg.env = { ...(cfg.env || {}), [c.bearer_token_env_var]: '<hidden>' };
      list.push(entry('codex', f.startsWith(os.homedir()) ? 'user' : 'project', n, cfg, f));
    }
  }
  return { list, files };
}

// `claude mcp list` says whether each server connects. Slow (it starts every server), so only with --probe.
function probeClaude() {
  // on Windows `claude` is a .cmd shim, so the whole line goes through the shell as one string (no args to escape)
  const res = process.platform === 'win32'
    ? spawnSync('claude mcp list', { encoding: 'utf8', timeout: 90000, shell: true, windowsHide: true })
    : spawnSync('claude', ['mcp', 'list'], { encoding: 'utf8', timeout: 90000 });
  if (res.error || res.status == null) return { ok: false, error: res.error ? String(res.error.message || res.error) : 'timeout' };
  const status = {};
  for (const line of String(res.stdout || '').split(/\r?\n/)) {
    const m = line.match(/^([^:\s][^:]*):\s.*?-\s*(.+)$/); if (!m) continue;
    const s = m[2];
    status[m[1].trim()] = /Connected/i.test(s) ? 'connected' : /auth/i.test(s) ? 'needs-auth' : /Failed/i.test(s) ? 'failed' : s.replace(/[^\w\s-]/g, '').trim();
  }
  return { ok: true, status };
}

// Tool names of the running session, mcp__<server>__<tool>: which servers expose image tools.
function toolsByServer(spec) {
  const names = String(spec || '').split(/[,\s]+/).filter(Boolean);
  const by = {};
  for (const t of names) {
    const m = t.match(/^mcp__(.+?)__(.+)$/); if (!m) continue;
    (by[m[1]] = by[m[1]] || []).push(m[2]);
  }
  const result = {};
  for (const [server, tools] of Object.entries(by)) {
    const image = tools.filter((t) => IMAGE_TOOL.test(t) && IMAGE_WORD.test(t) || /^(generate_image|run_model|create_predictions|create_models_predictions|invoke_api_endpoint)$/i.test(t));
    result[server] = { tools, imageTools: image, imageCapable: image.length > 0 };
  }
  return result;
}

export function detect({ cwd = process.cwd(), probe = false, tools = '' } = {}) {
  const c = claudeServers(cwd); const x = codexServers(cwd);
  const servers = [...c.list, ...x.list];
  let probeResult = null;
  if (probe) {
    probeResult = probeClaude();
    if (probeResult.ok) for (const s of servers) if (s.client === 'claude-code' && probeResult.status[s.name]) s.status = probeResult.status[s.name];
  }
  const session = tools ? toolsByServer(tools) : null;
  if (session) {
    for (const s of servers) {
      const key = Object.keys(session).find((k) => k.toLowerCase() === s.name.toLowerCase() || k.toLowerCase().endsWith('_' + s.name.toLowerCase()) || k.toLowerCase().replace(/[^a-z0-9]/g, '') === s.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
      if (key) { s.sessionTools = session[key].imageTools; if (session[key].imageCapable) s.imageCapable = true; else if (s.imageCapable === 'maybe') s.imageCapable = false; }
    }
    for (const [k, v] of Object.entries(session)) {
      if (v.imageCapable && !servers.some((s) => s.sessionTools === v.imageTools)) servers.push({ name: k, client: 'session', scope: 'session', transport: null, where: 'the running session', provider: providerOf({ name: k }), imageCapable: true, sessionTools: v.imageTools });
    }
  }
  const imageCapable = servers.filter((s) => s.imageCapable === true);
  const maybe = servers.filter((s) => s.imageCapable === 'maybe');
  const order = ['fal', 'replicate', 'higgsfield'];
  const providersFound = [...new Set(imageCapable.map((s) => s.provider).filter(Boolean))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return {
    ok: true,
    readOn: READ_ON,
    clients: {
      claudeCode: { files: c.files, servers: c.list.length },
      codex: { files: x.files, servers: x.list.length },
    },
    servers,
    imageCapable: imageCapable.map((s) => ({ name: s.name, client: s.client, provider: s.provider, status: s.status, tools: s.sessionTools })),
    maybeImageCapable: maybe.map((s) => ({ name: s.name, client: s.client, hint: 'confirm by its tool names: run again with --tools' })),
    providersFound,
    recommended: providersFound[0] || null,
    probe: probeResult,
    offer: imageCapable.length ? null : offer(),
    rule: 'Pictures are generated through an MCP connection only. Nothing is installed and nothing is paid without the user\'s explicit yes; the user runs the install line or approves it.',
  };
}

export function offer() {
  return {
    readOn: READ_ON,
    responsibility: RESPONSIBILITY,
    advice: 'Pick one. fal is the one that covers every step of this skill with prepaid credits you top up a few dollars at a time; Replicate is pay as you go too; Higgsfield is a monthly subscription. Prices change: the numbers carry the day they were read.',
    providers: Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, { label: p.label, claudeCode: p.claude, claudeCodeAuth: p.claudeAuth, codex: p.codex, codexAuth: p.codexAuth, auth: p.auth, payment: p.payment, prices: p.prices, load: p.load, covers: p.covers, sources: p.sources }])),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`mcp.mjs: which MCP servers exist here, and which can make pictures. Never prints a key.

Usage:
  node mcp.mjs [--cwd <dir>] [--probe] [--tools "mcp__x__a,mcp__y__b"]
  node mcp.mjs --offer`);
    process.exit(0);
  }
  if (args.offer) { out({ ok: true, offer: offer() }); process.exit(0); }
  out(detect({ cwd: args.cwd || process.cwd(), probe: !!args.probe, tools: args.tools === true ? '' : args.tools }));
}

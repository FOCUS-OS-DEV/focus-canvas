#!/usr/bin/env node
// Focus Canvas: opens a picture, a folder or a page on the user's screen.
//   node open.mjs <file | folder | url> [--select]   (--select shows the file inside its folder, Windows)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { out, fail, parseArgs } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2));
const target = args._[0]; if (!target || args.help) { console.log('node open.mjs <file | folder | url> [--select]'); process.exit(args.help ? 0 : 2); }
const isUrl = /^https?:\/\//i.test(target);
const abs = isUrl ? target : path.resolve(target);
if (!isUrl && !fs.existsSync(abs)) fail('not found: ' + abs);
let cmd, cargs;
if (process.platform === 'win32') { cmd = 'explorer.exe'; cargs = args.select && !isUrl ? ['/select,', abs] : [abs]; }
else if (process.platform === 'darwin') { cmd = 'open'; cargs = args.select && !isUrl ? ['-R', abs] : [abs]; }
else { cmd = 'xdg-open'; cargs = [abs]; }
try { spawn(cmd, cargs, { detached: true, stdio: 'ignore' }).unref(); out({ ok: true, opened: abs }); } catch (e) { fail(String(e.message || e)); }

#!/usr/bin/env node
// Focus Canvas: the editor page. A local page where the user clicks a layer, drags it, resizes and rotates it, changes
// its text, colour, shadow and opacity, fills a photo wall slot by slot, and saves. Saving writes layers.json (the old
// one goes to _versions/), "רינדור" writes the picture. The page watches layers.json, so when Claude changes it the page
// updates in place (unless the user has unsaved changes).
//   node editor.mjs serve <project> [--port 8790] [--open] [--fresh]
//   node editor.mjs stop <project>
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { out, fail, parseArgs, resolveProject, loadLayers, saveLayers, FONTS_DIR } from './lib/common.mjs';
import { fontCss, stageHtml } from './lib/render.mjs';
import { compose } from './compose.mjs';

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (!cmd || args.help) { console.log('node editor.mjs serve <project> [--port 8790] [--open] [--fresh]\nnode editor.mjs stop <project>'); process.exit(args.help ? 0 : 2); }
const project = resolveProject(args._[1]);
const PID_FILE = path.join(project, 'renders', '.editor.json');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ttf': 'font/ttf', '.otf': 'font/otf', '.json': 'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8' };
const IMG = /\.(png|jpe?g|webp|gif|avif)$/i;

if (cmd === 'stop') {
  const st = fs.existsSync(PID_FILE) ? JSON.parse(fs.readFileSync(PID_FILE, 'utf8')) : null;
  if (st) { try { process.kill(st.pid); } catch {} fs.unlinkSync(PID_FILE); }
  out({ ok: true, stopped: !!st }); process.exit(0);
}

const alive = (p) => { try { process.kill(p, 0); return true; } catch { return false; } };
const prev = fs.existsSync(PID_FILE) ? JSON.parse(fs.readFileSync(PID_FILE, 'utf8')) : null;
if (prev && prev.pid !== process.pid && alive(prev.pid) && !args.fresh) {
  if (args.open) openUrl(prev.url);
  out({ ok: true, url: prev.url, port: prev.port, pid: prev.pid, reused: true }); process.exit(0);
}
const freePort = (p) => new Promise((res) => { const s = net.createServer(); s.once('error', () => res(freePort(p + 1))); s.listen(p, '127.0.0.1', () => s.close(() => res(p))); });
const port = await freePort(+(args.port || 8790));

const stampOf = () => String(fs.statSync(path.join(project, 'layers.json')).mtimeMs);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function poolOf(dir) { const d = path.resolve(project, dir || 'source/photos'); if (!d.startsWith(path.resolve(project)) || !fs.existsSync(d)) return []; return fs.readdirSync(d).filter((f) => IMG.test(f)).sort(); }

function page(doc) {
  const c = doc.canvas;
  const fonts = JSON.parse(fs.readFileSync(path.join(FONTS_DIR, 'fonts.json'), 'utf8')).fonts.map((f) => f.family);
  const pools = {}; for (const l of doc.layers || []) if (l.type === 'wall') pools[l.id] = poolOf(l.pool);
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(doc.title || doc.name)}</title>
<style>${fontCss((f) => '/font/' + f)}
:root{--ink:#16121f;--cream:#f3eee4;--violet:#7c3aed;--pink:#e879f9;--line:#2a2435;--panel:#1b1626;--muted:#9a90b0;}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:#0d0a14;color:var(--cream);font-family:Rubik,system-ui,sans-serif;overflow:hidden}
#app{display:grid;grid-template-columns:1fr 380px;height:100vh}
#view{position:relative;display:flex;align-items:center;justify-content:center;padding:28px;overflow:hidden}
#fit{position:relative;transform-origin:0 0}
#stage{box-shadow:0 30px 80px rgba(0,0,0,.6)}
.layer{cursor:grab}.layer.locked{cursor:default;pointer-events:none}.layer.sel{outline:2px solid var(--pink);outline-offset:-2px}
.layer.wall{cursor:default}.layer.wall .slot{cursor:pointer}.layer.wall .slot.sel{outline:6px solid #a78bfa;outline-offset:-6px}
#box{position:absolute;pointer-events:none;border:2px solid var(--pink);display:none}
.hd{position:absolute;width:14px;height:14px;background:#fff;border:2px solid var(--pink);border-radius:3px;pointer-events:auto;transform:translate(-50%,-50%)}
.hd.nw{left:0;top:0;cursor:nwse-resize}.hd.ne{left:100%;top:0;cursor:nesw-resize}.hd.sw{left:0;top:100%;cursor:nesw-resize}.hd.se{left:100%;top:100%;cursor:nwse-resize}
.hd.rot{left:50%;top:-36px;border-radius:50%;cursor:grab;background:var(--pink)}
#side{background:var(--panel);border-inline-start:1px solid var(--line);display:flex;flex-direction:column;overflow:hidden}
#side header{padding:18px 20px 12px;border-bottom:1px solid var(--line)}#side h1{margin:0;font-size:18px;font-weight:900}#side .sub{font-size:12px;color:var(--muted);letter-spacing:2px;direction:ltr;text-align:right;margin-top:4px}
#layers{padding:10px 12px;border-bottom:1px solid var(--line);max-height:30vh;overflow:auto}
.row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;cursor:pointer;font-size:15px}.row:hover{background:#241d33}.row.sel{background:var(--violet);color:#fff}
.row .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row .ic{opacity:.7;font-size:13px;cursor:pointer;padding:2px 4px}.row .ic:hover{opacity:1}
#props{padding:14px 16px;overflow:auto;flex:1;font-size:14px}
#props h2{font-size:15px;margin:6px 0 10px;color:var(--pink)}
.f{display:grid;grid-template-columns:72px 1fr 56px;align-items:center;gap:8px;margin:8px 0}.f label{color:var(--muted)}
.f input[type=range]{width:100%;accent-color:var(--violet)}.f input[type=number],.f input[type=text],.f select,#props textarea{width:100%;background:#0d0a14;border:1px solid var(--line);color:var(--cream);border-radius:8px;padding:6px 8px;font:inherit}
.f input[type=color]{width:100%;height:32px;background:none;border:1px solid var(--line);border-radius:8px}
#props textarea{min-height:80px;resize:vertical;direction:rtl}
.hint{color:var(--muted);font-size:13px;line-height:1.6;margin:6px 0 10px}
.pool{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:6px;margin-top:8px}
.pool div{position:relative;border-radius:6px;overflow:hidden;cursor:pointer;outline:2px solid transparent}.pool img{width:100%;height:64px;object-fit:cover;display:block}
.pool div.used{opacity:.35}.pool div.used::after{content:'בשימוש';position:absolute;inset:auto 0 0 0;background:#000a;font-size:11px;text-align:center}.pool div:hover{outline-color:var(--pink)}
.btns{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.btns button{padding:8px 10px;font-size:13px}
#actions{padding:14px 16px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:8px}
button{font:700 14px Rubik,sans-serif;padding:11px 16px;border:0;border-radius:10px;background:#2a2435;color:var(--cream);cursor:pointer}button.p{background:var(--violet);color:#fff;flex:1}button:active{transform:scale(.98)}
#status{font-size:12px;color:var(--muted);width:100%;min-height:16px}
</style></head><body>
<div id="app">
  <div id="view"><div id="fit">${stageHtml(doc, (src) => '/asset/' + src)}<div id="box"><div class="hd nw" data-h="nw"></div><div class="hd ne" data-h="ne"></div><div class="hd sw" data-h="sw"></div><div class="hd se" data-h="se"></div><div class="hd rot" data-h="rot"></div></div></div></div>
  <div id="side">
    <header><h1 id="ttl">${esc(doc.title || doc.name)}</h1><div class="sub">FOCUS CANVAS &middot; ${c.w}&times;${c.h}</div></header>
    <div id="layers"></div>
    <div id="props"><div class="hint">לוחצים על רכיב בתמונה או ברשימה. גוררים כדי להזיז, הפינות משנות גודל, העיגול מסובב, חיצים במקלדת (עם Shift קפיצה גדולה). Ctrl+Z מבטל.</div></div>
    <div id="actions"><button class="p" id="save">שמירה</button><button id="render">רינדור</button><button id="preview">בפרופיל</button><button id="undo">ביטול</button><div id="status"></div></div>
  </div>
</div>
<div id="pv" style="position:fixed;inset:0;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;z-index:9">
  <div style="width:420px;background:#000;border-radius:28px;padding:18px 0 24px;box-shadow:0 40px 120px #000;font-family:Rubik,sans-serif;color:#fff;direction:rtl">
    <div style="display:flex;align-items:center;gap:14px;padding:6px 18px 14px"><div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#f58529,#dd2a7b,#8134af);padding:3px"><div style="width:100%;height:100%;border-radius:50%;background:#1b1626;display:flex;align-items:center;justify-content:center;font-size:12px;color:#9a90b0">לוגו</div></div>
      <div><div style="font-weight:700;font-size:16px" id="pv-name">${esc(doc.profile && doc.profile.name || doc.name)}</div><div style="font-size:13px;color:#9a90b0" id="pv-sub">${esc(doc.profile && doc.profile.line || 'כך הפוסט ייראה ברשת הפרופיל')}</div></div></div>
    <div style="display:flex;gap:28px;padding:0 18px 12px;font-size:13px;color:#ddd"><span><b>${esc(String(doc.profile && doc.profile.posts || ''))}</b> פוסטים</span><span><b>${esc(String(doc.profile && doc.profile.followers || ''))}</b> עוקבים</span></div>
    <div id="pv-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;direction:rtl"></div>
    <div style="text-align:center;padding-top:14px"><button id="pv-close">סגירה</button></div>
  </div>
</div>
<script>
const FONTS=${JSON.stringify(fonts)}, POOLS=${JSON.stringify(pools)};
let doc=${JSON.stringify(doc)}, stamp=${JSON.stringify(stampOf())}, sel=null, slotSel=null, dirty=false, hist=[];
const $=(s)=>document.querySelector(s), stage=$('#stage'), fit=$('#fit'), box=$('#box');
let scale=1;
function layout(){const v=$('#view').getBoundingClientRect();scale=Math.min((v.width-56)/doc.canvas.w,(v.height-56)/doc.canvas.h);fit.style.transform='scale('+scale+')';fit.style.width=doc.canvas.w+'px';fit.style.height=doc.canvas.h+'px';}
window.addEventListener('resize',()=>{layout();drawBox();});
function L(id){return doc.layers.find((l)=>l.id===id);}
function el(id){return stage.querySelector('.layer[data-id="'+CSS.escape(id)+'"]');}
function push(){hist.push(JSON.stringify(doc));if(hist.length>80)hist.shift();dirty=true;}
const escH=(s)=>String(s||'').replace(/[&<>]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function textInner(l){let html=escH(l.text).replace(/\\n/g,'<br>');const wrap=(words,open)=>{if(!words)return;const w=escH(words);if(html.includes(w))html=html.replace(w,open+w+'</span>');};
 if(l.marker&&l.marker.words)wrap(l.marker.words,'<span style="background:linear-gradient(transparent '+(l.marker.top??58)+'%, '+(l.marker.color||'rgba(168,85,247,0.85)')+' '+(l.marker.top??58)+'%, '+(l.marker.color||'rgba(168,85,247,0.85)')+' '+(l.marker.bottom??96)+'%, transparent '+(l.marker.bottom??96)+'%);padding:0 0.08em;">');
 if(l.highlight&&l.highlight.words)wrap(l.highlight.words,'<span style="color:'+(l.highlight.color||'#c084fc')+';">');return html;}
const PRESETS={plain:'רגיל',accent:'מילים בסגול',pill:'בתוך כפתור סגול',gold:'זהב',mark:'מרקר סגול מתחת'};
function applyPreset(l,k,words){delete l.highlight;delete l.marker;delete l.gradient;delete l.background;if(!l.color||l.color==='transparent')l.color='#ffffff';
 if(k==='accent')l.highlight={words:words,color:'#c084fc'};if(k==='pill')l.background={color:'rgba(124,58,237,0.92)',padding:Math.round((l.size||64)*0.3),radius:999,border:'rgba(216,180,254,0.9)'};
 if(k==='gold')l.gradient=['#fde68a','#d4a017'];if(k==='mark')l.marker={words:words,color:'rgba(168,85,247,0.85)'};l.preset=k;}
// ---- the wall: slots from the same rule as the renderer
function wallLayout(l){const cols=+l.cols||4,gap=+(l.gap??8),x0=+l.x||0,y0=+l.y||0,W=+l.w||doc.canvas.w,H=+l.h||doc.canvas.h;const sw=(W-(cols+1)*gap)/cols,sh=+l.slotH||Math.round(sw*4/3);const offs=l.offsets||[];const o=[];
 for(let c=0;c<cols;c++){const left=x0+gap+c*(sw+gap);const off=offs[c]||0;let r=0;for(let top=y0+off;top<y0+H;top+=sh+gap,r++){if(top+sh<y0)continue;o.push({id:c+'-'+r,col:c,row:r,x:left,y:top,w:sw,h:sh});}}return o;}
function wallHtml(l){const slots=wallLayout(l);const radius=l.radius??14;const pool=l.pool||'source/photos';
 return slots.map((s)=>{const it=(l.slots||{})[s.id];const pan=it&&it.pan!=null?it.pan:0.35;const img=it&&it.photo?'<img src="/asset/'+pool+'/'+encodeURIComponent(it.photo)+'" draggable="false" style="display:block;width:100%;height:100%;object-fit:cover;object-position:50% '+(pan*100).toFixed(1)+'%;">':'';
  return '<div class="slot'+(slotSel===s.id&&sel===l.id?' sel':'')+'" data-slot="'+s.id+'" data-col="'+s.col+'" style="position:absolute;left:'+(s.x-(l.x||0)).toFixed(2)+'px;top:'+(s.y-(l.y||0)).toFixed(2)+'px;width:'+s.w.toFixed(2)+'px;height:'+s.h+'px;border-radius:'+radius+'px;overflow:hidden;background:'+(l.empty||'#1d1640')+';">'+img+'</div>';}).join('');}
function applyStyle(l){const e=el(l.id);if(!e)return;e.style.left=(l.x||0)+'px';e.style.top=(l.y||0)+'px';e.style.opacity=l.opacity==null?1:l.opacity;e.style.visibility=l.hidden?'hidden':'visible';
 if(l.type==='wall'){e.style.width=(l.w||doc.canvas.w)+'px';e.style.height=(l.h||doc.canvas.h)+'px';e.style.filter='saturate('+(l.saturation==null?1:l.saturation)+')';e.innerHTML=wallHtml(l);e.classList.toggle('locked',!!l.locked);return;}
 e.style.transform=l.rotation?'rotate('+l.rotation+'deg)':'none';
 const sh=l.shadow;e.style.filter=sh&&(sh.blur||sh.x||sh.y)?'drop-shadow('+(sh.x||0)+'px '+(sh.y||0)+'px '+(sh.blur||0)+'px rgba(0,0,0,'+(sh.alpha==null?0.5:sh.alpha)+'))':'none';
 if(l.type==='image'){e.style.width=l.w+'px';const im=e.querySelector('img');im.style.width=l.w+'px';if(l.h!=null){e.style.height=l.h+'px';im.style.height=l.h+'px';}else{e.style.height='';im.style.height='auto';}}
 if(l.type==='shape'){e.style.width=l.w+'px';e.style.height=l.h+'px';e.style.background=l.fill||'transparent';e.style.borderRadius=l.shape==='ellipse'?'50%':(l.radius||0)+'px';}
 if(l.type==='text'){if(l.w){e.style.width=l.w+'px';e.style.whiteSpace='';}else{e.style.width='';e.style.whiteSpace='nowrap';}e.style.fontSize=(l.size||64)+'px';e.style.fontFamily='"'+(l.font||'Rubik')+'",sans-serif';e.style.fontWeight=l.weight||700;e.style.color=l.color||'#fff';e.style.textAlign=l.align||'center';e.style.lineHeight=l.lineHeight||1.2;e.style.letterSpacing=(l.letterSpacing||0)+'px';e.innerHTML=l.gradient&&l.gradient.length?'<span style="background:linear-gradient(180deg,'+l.gradient.join(',')+');-webkit-background-clip:text;background-clip:text;color:transparent;">'+textInner(l)+'</span>':textInner(l);
  if(l.background&&l.background.color){e.style.background=l.background.color;e.style.padding=(l.background.padding??16)+'px '+((l.background.padding??16)*1.4)+'px';e.style.borderRadius=(l.background.radius??12)+'px';e.style.border=l.background.border?'3px solid '+l.background.border:'';}else{e.style.background='';e.style.padding='';e.style.borderRadius='';e.style.border='';}
  e.style.webkitTextStroke=l.stroke&&l.stroke.width?l.stroke.width+'px '+(l.stroke.color||'#000'):'';}
 e.classList.toggle('locked',!!l.locked);}
function drawBox(){const l=sel&&L(sel);const e=sel&&el(sel);if(!l||!e||l.type==='wall'){box.style.display='none';return;}box.style.display='block';box.style.left=(l.x||0)+'px';box.style.top=(l.y||0)+'px';box.style.width=e.offsetWidth+'px';box.style.height=e.offsetHeight+'px';box.style.transform=l.rotation?'rotate('+l.rotation+'deg)':'none';box.style.transformOrigin='50% 50%';
 box.querySelectorAll('.hd').forEach((h)=>{h.style.transform='translate(-50%,-50%) scale('+(1/scale)+')';});box.style.borderWidth=(2/scale)+'px';}
function select(id){if(sel!==id)slotSel=null;sel=id;stage.querySelectorAll('.layer').forEach((e)=>e.classList.toggle('sel',e.dataset.id===id&&L(id).type!=='wall'));const l=L(id);if(l&&l.type==='wall')applyStyle(l);renderList();renderProps();drawBox();}
function renderList(){const b=$('#layers');b.innerHTML='';[...doc.layers].reverse().forEach((l)=>{const r=document.createElement('div');r.className='row'+(l.id===sel?' sel':'');
 r.innerHTML='<span class="ic" data-a="eye" title="הצגה">'+(l.hidden?'◌':'●')+'</span><span class="nm">'+escH(l.name||l.id)+'</span><span class="ic" data-a="lock" title="נעילה">'+(l.locked?'🔒':'🔓')+'</span><span class="ic" data-a="up" title="למעלה">▲</span><span class="ic" data-a="down" title="למטה">▼</span>';
 r.onclick=(e)=>{const a=e.target.dataset.a;if(!a){select(l.id);return;}push();if(a==='eye')l.hidden=!l.hidden;if(a==='lock')l.locked=!l.locked;if(a==='up'||a==='down'){const i=doc.layers.indexOf(l);const j=a==='up'?i+1:i-1;if(j>=0&&j<doc.layers.length){doc.layers.splice(i,1);doc.layers.splice(j,0,l);reorder();}}applyStyle(l);renderList();drawBox();};
 b.appendChild(r);});}
function reorder(){doc.layers.forEach((l)=>{const e=el(l.id);if(e)stage.appendChild(e);});}
function field(label,html){return '<div class="f"><label>'+label+'</label>'+html+'</div>';}
function range(id,min,max,step,val){return '<input type="range" id="'+id+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'"><span>'+val+'</span>';}
function renderProps(){const p=$('#props');if(!sel){p.innerHTML='<div class="hint">לוחצים על רכיב בתמונה או ברשימה.</div>';return;}const l=L(sel);
 let h='<h2>'+escH(l.name||l.id)+'</h2>';
 if(l.type==='wall'){h+='<div class="hint">לוחצים על משבצת בתמונה, ואז על תמונה מהמאגר כדי לשים אותה שם. גלגלת העכבר על משבצת מזיזה את התמונה בתוכה. גרירה למעלה או למטה מזיזה את כל העמודה. לחיצה ימנית מרוקנת משבצת.</div>';
  h+=field('עמודות',range('w-cols',2,6,1,l.cols||4))+field('גובה',range('w-sh',120,700,2,l.slotH||330))+field('רווח',range('w-gap',0,40,1,l.gap??8))+field('פינות',range('w-rad',0,60,1,l.radius??14))+field('שקיפות',range('w-op',0.1,1,0.02,l.opacity==null?1:l.opacity))+field('רוויה',range('w-sat',0,1.4,0.02,l.saturation==null?1:l.saturation));
  h+='<div class="btns"><button id="w-auto">מילוי של המשבצות הריקות</button><button id="w-clear">ריקון הקיר</button></div><div id="w-warn" class="hint"></div><div class="pool" id="w-pool"></div>';
  p.innerHTML=h;
  const bindW=(id,fn)=>{const e=p.querySelector('#'+id);e.addEventListener('input',()=>{push();fn(+e.value);e.parentElement.querySelector('span').textContent=e.value;applyStyle(l);});};
  bindW('w-cols',(v)=>{l.cols=v;});bindW('w-sh',(v)=>{l.slotH=v;});bindW('w-gap',(v)=>{l.gap=v;});bindW('w-rad',(v)=>{l.radius=v;});bindW('w-op',(v)=>{l.opacity=v;});bindW('w-sat',(v)=>{l.saturation=v;});
  p.querySelector('#w-auto').onclick=()=>{push();const used=new Set(Object.values(l.slots||{}).map((s)=>s.photo));const free=(POOLS[l.id]||[]).filter((n)=>!used.has(n));l.slots=l.slots||{};for(const s of wallLayout(l)){if(l.slots[s.id]&&l.slots[s.id].photo)continue;if(s.y>doc.canvas.h-40)continue;const n=free.shift();if(!n)break;l.slots[s.id]={photo:n,pan:0.35};}applyStyle(l);renderPool(l);};
  p.querySelector('#w-clear').onclick=()=>{push();l.slots={};applyStyle(l);renderPool(l);};
  renderPool(l);return;}
 if(l.type==='text'){h+='<textarea id="p-text">'+escH(l.text)+'</textarea>';
  h+=field('עיצוב','<select id="p-preset">'+Object.entries(PRESETS).map(([k,v])=>'<option value="'+k+'"'+((l.preset||'plain')===k?' selected':'')+'>'+v+'</option>').join('')+'</select><span></span>');
  h+=field('מילים','<input type="text" id="p-words" value="'+escH((l.highlight&&l.highlight.words)||(l.marker&&l.marker.words)||'')+'" placeholder="המילים להדגשה או למרקר"><span></span>');
  h+=field('פונט','<select id="p-font">'+FONTS.map((f)=>'<option'+(f===(l.font||'Rubik')?' selected':'')+'>'+f+'</option>').join('')+'</select><span></span>');
  h+=field('גודל','<input type="range" id="p-size" min="16" max="400" value="'+(l.size||64)+'"><input type="number" id="p-size-n" value="'+(l.size||64)+'">');
  h+=field('משקל',range('p-weight',300,900,100,l.weight||700));
  h+=field('צבע','<input type="color" id="p-color" value="'+(l.color||'#ffffff')+'"><span></span>');
  h+=field('רוחב','<input type="range" id="p-w" min="100" max="'+doc.canvas.w+'" value="'+(l.w||600)+'"><input type="number" id="p-w-n" value="'+(l.w||'')+'">');}
 if(l.type==='image'){h+=field('רוחב','<input type="range" id="p-w" min="40" max="'+Math.round(doc.canvas.w*1.5)+'" value="'+l.w+'"><input type="number" id="p-w-n" value="'+l.w+'">');}
 if(l.type==='shape'){h+=field('רוחב','<input type="range" id="p-w" min="10" max="'+doc.canvas.w+'" value="'+l.w+'"><input type="number" id="p-w-n" value="'+l.w+'">');h+=field('גובה','<input type="range" id="p-h" min="10" max="'+doc.canvas.h+'" value="'+l.h+'"><input type="number" id="p-h-n" value="'+l.h+'">');h+=field('מילוי','<input type="color" id="p-fill" value="'+(l.fill||'#7c3aed')+'"><span></span>');}
 h+=field('זווית','<input type="range" id="p-rot" min="-45" max="45" step="0.5" value="'+(l.rotation||0)+'"><input type="number" id="p-rot-n" step="0.5" value="'+(l.rotation||0)+'">');
 h+=field('שקיפות',range('p-op',0,1,0.02,l.opacity==null?1:l.opacity));
 const sh=l.shadow||{};h+='<h2>צל</h2>'+field('טשטוש',range('p-sb',0,80,1,sh.blur||0))+field('גובה',range('p-sy',-40,60,1,sh.y||0))+field('עוצמה',range('p-sa',0,1,0.05,sh.alpha==null?0.5:sh.alpha));
 h+='<h2>מיקום</h2>'+field('x','<input type="number" id="p-x" value="'+Math.round(l.x||0)+'"><span></span>')+field('y','<input type="number" id="p-y" value="'+Math.round(l.y||0)+'"><span></span>');
 h+='<div class="btns"><button id="p-center">למרכז לרוחב</button>'+(l.home?'<button id="p-home">למקום המקורי</button>':'')+'</div>';
 p.innerHTML=h;
 p.querySelector('#p-center').onclick=()=>{push();const e=el(l.id);l.x=Math.round((doc.canvas.w-e.offsetWidth)/2);applyStyle(l);drawBox();syncProps(l);};
 const hm=p.querySelector('#p-home');if(hm)hm.onclick=()=>{push();Object.assign(l,l.home);applyStyle(l);drawBox();syncProps(l);};
 const ps=p.querySelector('#p-preset'),pw=p.querySelector('#p-words');if(ps){const ap=()=>{push();let words=pw.value.trim();if(!words){words=String(l.text||'').trim().split(/\\s+/).slice(-2).join(' ');pw.value=words;}applyPreset(l,ps.value,words);applyStyle(l);drawBox();};ps.onchange=ap;pw.oninput=()=>{if(l.highlight)l.highlight.words=pw.value;if(l.marker)l.marker.words=pw.value;applyStyle(l);};}
 const bind=(id,fn)=>{const e=p.querySelector('#'+id);if(!e)return;e.addEventListener('input',()=>{push();fn(e.value);applyStyle(l);drawBox();const n=p.querySelector('#'+id+'-n');if(n&&n!==e)n.value=e.value;const sp=e.parentElement.querySelector('span');if(sp)sp.textContent=e.value;});};
 bind('p-text',(v)=>{l.text=v;});bind('p-font',(v)=>{l.font=v;});bind('p-size',(v)=>{l.size=+v;});bind('p-size-n',(v)=>{l.size=+v;p.querySelector('#p-size').value=v;});bind('p-weight',(v)=>{l.weight=+v;});bind('p-color',(v)=>{l.color=v;});
 bind('p-w',(v)=>{setW(l,+v);});bind('p-w-n',(v)=>{setW(l,+v);const r=p.querySelector('#p-w');if(r)r.value=v;});bind('p-h',(v)=>{l.h=+v;});bind('p-h-n',(v)=>{l.h=+v;});bind('p-fill',(v)=>{l.fill=v;});
 bind('p-rot',(v)=>{l.rotation=+v;});bind('p-rot-n',(v)=>{l.rotation=+v;p.querySelector('#p-rot').value=v;});bind('p-op',(v)=>{l.opacity=+v;});
 bind('p-sb',(v)=>{l.shadow=l.shadow||{};l.shadow.blur=+v;});bind('p-sy',(v)=>{l.shadow=l.shadow||{};l.shadow.y=+v;});bind('p-sa',(v)=>{l.shadow=l.shadow||{};l.shadow.alpha=+v;});
 bind('p-x',(v)=>{l.x=+v;});bind('p-y',(v)=>{l.y=+v;});}
function renderPool(l){const b=$('#w-pool');if(!b)return;const used=new Set(Object.values(l.slots||{}).map((s)=>s.photo));b.innerHTML='';(POOLS[l.id]||[]).forEach((n)=>{const d=document.createElement('div');d.className=used.has(n)?'used':'';d.title=n;d.innerHTML='<img src="/asset/'+(l.pool||'source/photos')+'/'+encodeURIComponent(n)+'">';
 d.onclick=()=>{if(!slotSel){$('#w-warn').textContent='קודם לוחצים על משבצת בתמונה';return;}push();l.slots=l.slots||{};for(const k in l.slots)if(l.slots[k].photo===n)delete l.slots[k];l.slots[slotSel]={photo:n,pan:0.35};applyStyle(l);renderPool(l);$('#w-warn').textContent='';};b.appendChild(d);});
 const empty=wallLayout(l).filter((s)=>s.y<doc.canvas.h-40&&!(l.slots&&l.slots[s.id]&&l.slots[s.id].photo)).length;const w=$('#w-warn');if(w&&!w.textContent)w.textContent=empty?empty+' משבצות ריקות':'';}
function setW(l,w){if(l.type==='image'&&l.h!=null){const a=l.w/l.h;l.h=Math.round(w/a);}l.w=Math.max(4,Math.round(w));}
// ---- pointer work on the stage
let drag=null;
stage.addEventListener('pointerdown',(e)=>{const t=e.target.closest('.layer');if(!t)return;const l=L(t.dataset.id);if(!l)return;
 if(l.type==='wall'){select(l.id);const s=e.target.closest('.slot');if(!s||e.button===2)return;drag={kind:'col',l,col:+s.dataset.col,y:e.clientY,o:(l.offsets||[])[+s.dataset.col]||0,moved:false,slot:s.dataset.slot};stage.setPointerCapture(e.pointerId);e.preventDefault();return;}
 if(l.locked){select(l.id);return;}select(l.id);push();drag={kind:'move',x:e.clientX,y:e.clientY,lx:l.x||0,ly:l.y||0,l};stage.setPointerCapture(e.pointerId);e.preventDefault();});
stage.addEventListener('contextmenu',(e)=>{const s=e.target.closest('.slot');const t=e.target.closest('.layer');if(!s||!t)return;e.preventDefault();const l=L(t.dataset.id);push();if(l.slots)delete l.slots[s.dataset.slot];applyStyle(l);renderPool(l);});
stage.addEventListener('wheel',(e)=>{const s=e.target.closest('.slot');const t=e.target.closest('.layer');if(!s||!t)return;const l=L(t.dataset.id);const it=l.slots&&l.slots[s.dataset.slot];if(!it||!it.photo)return;e.preventDefault();it.pan=Math.max(0,Math.min(1,(it.pan??0.35)+(e.deltaY>0?0.04:-0.04)));dirty=true;const im=s.querySelector('img');if(im)im.style.objectPosition='50% '+(it.pan*100).toFixed(1)+'%';},{passive:false});
box.addEventListener('pointerdown',(e)=>{const h=e.target.dataset.h;if(!h||!sel)return;const l=L(sel);push();const el0=el(sel);const r=el0.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;
 drag=h==='rot'?{kind:'rot',l,cx,cy,start:Math.atan2(e.clientY-cy,e.clientX-cx)*180/Math.PI,rot0:l.rotation||0}:{kind:'size',l,h,x:e.clientX,y:e.clientY,x0:l.x||0,y0:l.y||0,ow:el0.offsetWidth,oh:el0.offsetHeight,size0:l.size||64,hasH:l.h!=null};box.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation();});
window.addEventListener('pointermove',(e)=>{if(!drag)return;const l=drag.l;
 if(drag.kind==='col'){const dy=(e.clientY-drag.y)/scale;if(Math.abs(dy)>4&&!drag.moved){drag.moved=true;push();}if(drag.moved){l.offsets=l.offsets||[];while(l.offsets.length<(l.cols||4))l.offsets.push(0);l.offsets[drag.col]=Math.round(drag.o+dy);applyStyle(l);}return;}
 if(drag.kind==='move'){l.x=Math.round(drag.lx+(e.clientX-drag.x)/scale);l.y=Math.round(drag.ly+(e.clientY-drag.y)/scale);}
 else if(drag.kind==='rot'){const a=Math.atan2(e.clientY-drag.cy,e.clientX-drag.cx)*180/Math.PI;let r=drag.rot0+(a-drag.start);if(e.shiftKey)r=Math.round(r/5)*5;l.rotation=Math.round(r*2)/2;}
 else{const dx=(e.clientX-drag.x)/scale,dy=(e.clientY-drag.y)/scale;const sx=drag.h.includes('e')?1:-1,sy=drag.h.includes('s')?1:-1;const k=Math.max(0.05,(drag.ow+dx*sx)/drag.ow);
  if(l.type==='shape'&&!e.shiftKey){l.w=Math.round(Math.max(8,drag.ow+dx*sx));l.h=Math.round(Math.max(8,drag.oh+dy*sy));}
  else if(l.type==='text'){l.size=Math.max(8,Math.round(drag.size0*k));if(l.w)l.w=Math.round(drag.ow*k);}
  else{l.w=Math.round(drag.ow*k);if(drag.hasH)l.h=Math.round(drag.oh*k);}
  const nw=l.type==='text'?drag.ow*k:l.w,nh=l.type==='text'?drag.oh*k:(l.h||drag.oh*k);if(sx<0)l.x=Math.round(drag.x0+drag.ow-nw);if(sy<0)l.y=Math.round(drag.y0+drag.oh-nh);}
 applyStyle(l);drawBox();syncProps(l);});
window.addEventListener('pointerup',(e)=>{if(drag&&drag.kind==='col'&&!drag.moved){slotSel=drag.slot;applyStyle(drag.l);const w=$('#w-warn');if(w)w.textContent='';}drag=null;});
function syncProps(l){const p=$('#props');const set=(id,v)=>{const e=p.querySelector('#'+id);if(e)e.value=v;};set('p-x',Math.round(l.x||0));set('p-y',Math.round(l.y||0));set('p-rot',l.rotation||0);set('p-rot-n',l.rotation||0);set('p-w',l.w);set('p-w-n',l.w);set('p-h',l.h);set('p-h-n',l.h);set('p-size',l.size);set('p-size-n',l.size);}
document.addEventListener('keydown',(e)=>{if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();return;}if(!sel)return;const l=L(sel);if(l.locked||l.type==='wall')return;const d=e.shiftKey?10:1;let moved=true;
 if(e.key==='ArrowLeft')l.x=(l.x||0)-d;else if(e.key==='ArrowRight')l.x=(l.x||0)+d;else if(e.key==='ArrowUp')l.y=(l.y||0)-d;else if(e.key==='ArrowDown')l.y=(l.y||0)+d;else moved=false;if(!moved)return;e.preventDefault();dirty=true;applyStyle(l);drawBox();syncProps(l);});
function undo(){const s=hist.pop();if(!s)return;const keep=sel;doc=JSON.parse(s);rebuild();select(keep);}
function rebuild(){doc.layers.forEach(applyStyle);reorder();renderList();}
async function save(){const r=await fetch('/api/save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(doc)});const j=await r.json();stamp=j.stamp;dirty=false;$('#status').textContent='נשמר '+new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});return j;}
$('#save').onclick=save;$('#undo').onclick=undo;
$('#render').onclick=async()=>{await save();$('#status').textContent='מרנדר...';const r=await fetch('/api/compose',{method:'POST'});const j=await r.json();$('#status').textContent=j.ok?'נכתב '+j.file.split('/').pop():'שגיאה: '+(j.error||'');};
// how the picture will look in the profile grid: the fresh render first, then the user's feed (source/feed), then grey
$('#preview').onclick=async()=>{await save();$('#status').textContent='מרנדר...';const r=await fetch('/api/compose',{method:'POST'});const j=await r.json();if(!j.ok){$('#status').textContent='שגיאה: '+(j.error||'');return;}$('#status').textContent='';
 const feed=await (await fetch('/api/feed')).json();const g=$('#pv-grid');g.innerHTML='';const tiles=['/asset/renders/current.png?ts='+Date.now(),...feed.map((f)=>'/asset/source/feed/'+encodeURIComponent(f))];
 for(let i=0;i<Math.max(9,tiles.length);i++){const d=document.createElement('div');d.style.cssText='aspect-ratio:3/4;background:#2a2435;overflow:hidden'+(i===0?';outline:3px solid #e879f9;outline-offset:-3px':'');if(tiles[i])d.innerHTML='<img src="'+tiles[i]+'" style="width:100%;height:100%;object-fit:cover;display:block">';g.appendChild(d);}
 $('#pv').style.display='flex';};
$('#pv-close').onclick=()=>{$('#pv').style.display='none';};
async function poll(){try{const r=await fetch('/api/layers?ts='+Date.now());const j=await r.json();if(j.stamp!==stamp){stamp=j.stamp;if(dirty)return;location.reload();}}catch(e){}}
setInterval(poll,1500);
layout();renderList();
</script></body></html>`;
}

function openUrl(url) { const cmd = process.platform === 'win32' ? ['explorer.exe', [url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]; try { spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref(); } catch {} }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  try {
    if (url.pathname === '/') return send(200, MIME['.html'], page(loadLayers(project)));
    if (url.pathname === '/api/layers') return send(200, MIME['.json'], JSON.stringify({ stamp: stampOf(), data: loadLayers(project) }));
    if (url.pathname === '/api/save' && req.method === 'POST') {
      let body = ''; for await (const c of req) body += c;
      const doc = JSON.parse(body); saveLayers(project, doc); return send(200, MIME['.json'], JSON.stringify({ ok: true, stamp: stampOf() }));
    }
    if (url.pathname === '/api/compose' && req.method === 'POST') { const r = await compose(project, {}); return send(200, MIME['.json'], JSON.stringify(r)); }
    if (url.pathname === '/api/feed') { const d = path.join(project, 'source', 'feed'); const list = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => IMG.test(f)).sort() : []; return send(200, MIME['.json'], JSON.stringify(list)); }
    if (url.pathname.startsWith('/asset/')) { const rel = decodeURIComponent(url.pathname.slice(7)); const f = path.resolve(project, rel); if (!f.startsWith(path.resolve(project)) || !fs.existsSync(f)) return send(404, 'text/plain', 'missing'); return send(200, MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', fs.readFileSync(f)); }
    if (url.pathname.startsWith('/font/')) { const f = path.join(FONTS_DIR, decodeURIComponent(url.pathname.slice(6))); if (!f.startsWith(FONTS_DIR) || !fs.existsSync(f)) return send(404, 'text/plain', 'missing'); return send(200, MIME[path.extname(f).toLowerCase()] || 'font/ttf', fs.readFileSync(f)); }
    send(404, 'text/plain', 'not found');
  } catch (e) { send(500, MIME['.json'], JSON.stringify({ ok: false, error: String(e.message || e) })); }
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}/`;
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true }); fs.writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, port, url, project }));
  if (args.open) openUrl(url);
  out({ ok: true, url, port, pid: process.pid, project: project.replace(/\\/g, '/'), reused: false });
});

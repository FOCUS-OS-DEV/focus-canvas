// One renderer for the editor page and for the final picture: layers.json becomes HTML. The editor shows this HTML
// and lets the user move things; compose.mjs screenshots the same HTML, so what the user sees is what is written.
import path from 'node:path';
import { fontFaces, hasHebrew } from './common.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function fontCss(fontUrl) {
  return fontFaces().map((f) => f.files.map((file) => `@font-face { font-family: "${f.family}"; src: url("${fontUrl(f.dir + '/' + file.file)}") format("truetype"); font-weight: ${file.weight || '400'}; font-style: ${file.style || 'normal'}; }`).join('\n')).join('\n');
}

// the words of a text layer as HTML: line breaks, highlighted words in another colour, a marker under words
export function textInner(l) {
  let html = esc(l.text).replace(/\n/g, '<br>');
  const wrap = (words, open) => { if (!words) return; const w = esc(words); if (html.includes(w)) html = html.replace(w, open + w + '</span>'); };
  if (l.marker && l.marker.words) wrap(l.marker.words, `<span style="background:linear-gradient(transparent ${l.marker.top ?? 58}%, ${l.marker.color || 'rgba(168,85,247,0.85)'} ${l.marker.top ?? 58}%, ${l.marker.color || 'rgba(168,85,247,0.85)'} ${l.marker.bottom ?? 96}%, transparent ${l.marker.bottom ?? 96}%);padding:0 0.08em;">`);
  if (l.highlight && l.highlight.words) wrap(l.highlight.words, `<span style="color:${l.highlight.color || '#c084fc'};">`);
  return html;
}

function shadowCss(sh) {
  if (!sh || (!sh.blur && !sh.x && !sh.y)) return '';
  const a = sh.alpha == null ? 0.5 : sh.alpha;
  return `drop-shadow(${sh.x || 0}px ${sh.y || 0}px ${sh.blur || 0}px rgba(0,0,0,${a}))`;
}

export function layerHtml(l, assetUrl) {
  const rot = l.rotation ? `rotate(${l.rotation}deg)` : '';
  const op = l.opacity == null ? 1 : l.opacity;
  const common = `position:absolute;left:${l.x || 0}px;top:${l.y || 0}px;transform:${rot || 'none'};transform-origin:50% 50%;opacity:${op};${l.hidden ? 'visibility:hidden;' : ''}`;
  const filt = shadowCss(l.shadow); const filter = filt ? `filter:${filt};` : '';
  const blend = l.blend ? `mix-blend-mode:${l.blend};` : '';
  if (l.type === 'image') {
    const h = l.h == null ? 'height:auto;' : `height:${l.h}px;`;
    const fit = l.fit ? `object-fit:${l.fit};` : '';
    const radius = l.radius ? `border-radius:${l.radius}px;` : '';
    return `<div class="layer${l.locked ? ' locked' : ''}" data-id="${esc(l.id)}" style="${common}width:${l.w}px;${l.h == null ? '' : `height:${l.h}px;`}${filter}${blend}"><img src="${assetUrl(l.src)}" draggable="false" style="display:block;width:${l.w}px;${h}${fit}${radius}" /></div>`;
  }
  if (l.type === 'text') {
    const dir = l.dir || (hasHebrew(l.text) ? 'rtl' : 'ltr');
    const bg = l.background && l.background.color ? `background:${l.background.color};padding:${l.background.padding ?? 16}px ${(l.background.padding ?? 16) * 1.4}px;border-radius:${l.background.radius ?? 12}px;${l.background.border ? `border:3px solid ${l.background.border};` : ''}` : '';
    const stroke = l.stroke && l.stroke.width ? `-webkit-text-stroke:${l.stroke.width}px ${l.stroke.color || '#000'};` : '';
    const ts = l.textShadow ? `text-shadow:${l.textShadow};` : '';
    const w = l.w ? `width:${l.w}px;` : 'white-space:nowrap;';
    const grad = l.gradient && l.gradient.length ? `background:linear-gradient(180deg,${l.gradient.join(',')});-webkit-background-clip:text;background-clip:text;color:transparent;` : '';
    const style = `${common}${w}font-family:'${esc(l.font || 'Rubik')}',sans-serif;font-weight:${l.weight || 700};font-size:${l.size || 64}px;line-height:${l.lineHeight || 1.2};letter-spacing:${l.letterSpacing || 0}px;color:${l.color || '#fff'};text-align:${l.align || 'center'};direction:${dir};${bg}${stroke}${ts}${filter}${blend}${l.italic ? 'font-style:italic;' : ''}${l.uppercase ? 'text-transform:uppercase;' : ''}`;
    const inner = grad ? `<span style="${grad}">${textInner(l)}</span>` : textInner(l);
    return `<div class="layer text${l.locked ? ' locked' : ''}" data-id="${esc(l.id)}" style="${style}">${inner}</div>`;
  }
  if (l.type === 'wall') return wallHtml(l, assetUrl);
  if (l.type === 'shape') {
    const r = l.shape === 'ellipse' ? 'border-radius:50%;' : `border-radius:${l.radius || 0}px;`;
    const border = l.border && l.border.width ? `border:${l.border.width}px solid ${l.border.color || '#fff'};` : '';
    const fill = l.fill || 'transparent';
    return `<div class="layer${l.locked ? ' locked' : ''}" data-id="${esc(l.id)}" style="${common}width:${l.w}px;height:${l.h}px;background:${fill};${r}${border}${filter}${blend}box-sizing:border-box;"></div>`;
  }
  return '';
}

// A wall: columns of photo slots behind the picture. Each column is shifted by its own offset, each slot holds one
// photo from the pool, panned up or down inside the slot. Returns the slots in canvas px.
export function wallLayout(l) {
  const cols = +l.cols || 4, gap = +(l.gap ?? 8), x0 = +l.x || 0, y0 = +l.y || 0, W = +l.w || 1080, H = +l.h || 1440;
  const sw = (W - (cols + 1) * gap) / cols, sh = +l.slotH || Math.round(sw * 4 / 3);
  const offs = l.offsets || []; const out = [];
  for (let c = 0; c < cols; c++) {
    const left = x0 + gap + c * (sw + gap); const off = offs[c] || 0;
    let r = 0;
    for (let top = y0 + off; top < y0 + H; top += sh + gap, r++) { if (top + sh < y0) continue; out.push({ id: c + '-' + r, col: c, row: r, x: left, y: top, w: sw, h: sh }); }
  }
  return out;
}

export function wallHtml(l, assetUrl) {
  const slots = wallLayout(l); const radius = l.radius ?? 14; const pool = l.pool || 'source/photos';
  const op = l.opacity == null ? 1 : l.opacity; const sat = l.saturation == null ? 1 : l.saturation;
  const inner = slots.map((s) => {
    const it = (l.slots || {})[s.id]; const pan = it && it.pan != null ? it.pan : 0.35;
    const img = it && it.photo ? `<img src="${assetUrl(pool + '/' + it.photo)}" draggable="false" style="display:block;width:100%;height:100%;object-fit:cover;object-position:50% ${(pan * 100).toFixed(1)}%;" />` : '';
    return `<div class="slot" data-slot="${s.id}" data-col="${s.col}" style="position:absolute;left:${(s.x - (l.x || 0)).toFixed(2)}px;top:${(s.y - (l.y || 0)).toFixed(2)}px;width:${s.w.toFixed(2)}px;height:${s.h}px;border-radius:${radius}px;overflow:hidden;background:${l.empty || '#1d1640'};">${img}</div>`;
  }).join('');
  return `<div class="layer wall${l.locked ? ' locked' : ''}" data-id="${esc(l.id)}" style="position:absolute;left:${l.x || 0}px;top:${l.y || 0}px;width:${l.w || 1080}px;height:${l.h || 1440}px;overflow:hidden;opacity:${op};filter:saturate(${sat});${l.hidden ? 'visibility:hidden;' : ''}">${inner}</div>`;
}

export function stageHtml(doc, assetUrl) {
  const c = doc.canvas || { w: 1080, h: 1080 };
  const bg = c.background || '#000';
  return `<div id="stage" style="position:relative;width:${c.w}px;height:${c.h}px;background:${bg};overflow:hidden;">${(doc.layers || []).map((l) => layerHtml(l, assetUrl)).join('\n')}</div>`;
}

export function pageHtml(doc, { assetUrl, fontUrl, extraHead = '', extraBody = '' }) {
  return `<!doctype html><html lang="he"><head><meta charset="utf-8"><title>${esc(doc.title || doc.name || 'Focus Canvas')}</title>
<style>${fontCss(fontUrl)}
html,body{margin:0;background:#111;}
.layer{box-sizing:border-box;}
.layer.text{overflow-wrap:break-word;}
</style>${extraHead}</head><body>${stageHtml(doc, assetUrl)}${extraBody}</body></html>`;
}

export function fileUrl(p) { return 'file:///' + path.resolve(p).replace(/\\/g, '/').replace(/^\//, '').split('/').map(encodeURIComponent).join('/').replace(/%3A/, ':'); }

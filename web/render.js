// Sections -> 1-bit bitmap, 384 px wide. 1 = black. No page DOM is used.
import { Marked } from './lib/marked.esm.js';
import { WIDTH } from './printer.js';

const GAP = 8; // px between sections

// ->text<- on its own line = one centered line (not GFM).
const center = {
  name: 'center',
  level: 'block',
  start: src => src.match(/^->/m)?.index,
  tokenizer(src) {
    const m = /^->(.*?)<-[ \t]*(?:\n|$)/.exec(src);
    if (m) return {type: 'center', raw: m[0], tokens: this.lexer.inlineTokens(m[1].trim())};
  },
};
const md = new Marked({gfm: true, extensions: [center]});

export const pageSections = (template, content) =>
  template ? [...template.top, ...content, ...template.bottom] : content;

const measure = new OffscreenCanvas(1, 1).getContext('2d');
const fontOf = (s, size) => `${s.italic ? 'italic ' : ''}${s.bold ? 'bold ' : ''}${size}px ${s.mono ? 'monospace' : 'sans-serif'}`;
const unescape = t => t.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'"})[e]);

// Inline tokens -> runs [{text, bold, italic, mono}]
function runs(tokens, style = {}) {
  const out = [];
  for (const t of tokens ?? []) {
    if (t.type === 'strong') out.push(...runs(t.tokens, {...style, bold: true}));
    else if (t.type === 'em') out.push(...runs(t.tokens, {...style, italic: true}));
    else if (t.type === 'codespan') out.push({...style, mono: true, text: unescape(t.text)});
    else if (t.type === 'br') out.push({...style, text: '\n'});
    else if (t.type === 'checkbox') continue;
    else if (t.tokens) out.push(...runs(t.tokens, style));
    else out.push({...style, text: unescape(t.text ?? t.raw ?? '')});
  }
  return out;
}

// Layout makes a list of draw operations. raster() draws them on a canvas of the final height.
class Layout {
  ops = [];
  y = 0;

  // Wrap runs inside [x, x + w). Align each line.
  text(rs, x, w, size, align) {
    const lh = Math.round(size * 1.25);
    let line = [];
    let lineW = 0;
    const flush = () => {
      while (line.length && /^\s+$/.test(line.at(-1).text) && !line.at(-1).mono) lineW -= line.pop().w;
      let lx = x + (align === 'center' ? (w - lineW) / 2 : align === 'right' ? w - lineW : 0);
      for (const p of line) {
        this.ops.push({t: 'text', text: p.text, font: p.font, x: Math.round(lx), y: this.y + size});
        lx += p.w;
      }
      this.y += lh;
      line = [];
      lineW = 0;
    };
    for (const r of rs) {
      const font = fontOf(r, size);
      measure.font = font;
      for (const piece of r.text.split(/(\n|[ \t]+)/)) {
        if (!piece) continue;
        if (piece === '\n') { flush(); continue; }
        const pw = measure.measureText(piece).width;
        const space = /^\s+$/.test(piece);
        if (space && !line.length && !r.mono) continue;
        if (!space && line.length && lineW + pw > w) flush();
        line.push({text: piece, font, w: pw, mono: r.mono});
        lineW += pw;
      }
    }
    if (line.length) flush();
  }

  block(t, x, w, size, align) {
    switch (t.type) {
      case 'heading':
        this.text(runs(t.tokens, {bold: true}), x, w, Math.round(size * ([0, 1.6, 1.35, 1.15][t.depth] ?? 1)), align);
        break;
      case 'paragraph':
      case 'text':
        this.text(t.tokens ? runs(t.tokens) : [{text: unescape(t.text)}], x, w, size, align);
        break;
      case 'center':
        this.text(runs(t.tokens), x, w, size, 'center');
        break;
      case 'code':
        this.text([{mono: true, text: t.text}], x, w, Math.round(size * 0.85), 'left');
        break;
      case 'hr':
        this.ops.push({t: 'rect', x, y: this.y + Math.round(size / 2) - 1, w, h: 2});
        this.y += size;
        break;
      case 'blockquote': {
        const y0 = this.y;
        for (const c of t.tokens) this.block(c, x + 16, w - 16, size, align);
        this.ops.push({t: 'rect', x, y: y0, w: 4, h: this.y - y0});
        break;
      }
      case 'list': {
        const ind = Math.round(size * 1.5);
        t.items.forEach((it, i) => {
          const y0 = this.y;
          if (it.task) this.ops.push({t: 'box', x: x + 2, y: y0 + Math.round(size * 0.2), s: Math.round(size * 0.9), checked: it.checked});
          else this.ops.push({t: 'text', text: t.ordered ? `${(t.start || 1) + i}.` : '•', font: fontOf({}, size), x, y: y0 + size});
          for (const c of it.tokens) this.block(c, x + ind, w - ind, size, 'left');
        });
        break;
      }
      case 'table': {
        const n = t.header.length;
        const cw = Math.floor(w / n);
        const pad = 4;
        const y0 = this.y;
        const row = (cells, bold) => {
          const top = this.y;
          let bottom = top;
          cells.forEach((cell, i) => {
            this.y = top + pad;
            this.text(runs(cell.tokens, {bold}), x + i * cw + pad, cw - 2 * pad, size, t.align[i] || 'left');
            bottom = Math.max(bottom, this.y + pad);
          });
          this.y = bottom;
          this.ops.push({t: 'rect', x, y: bottom - 1, w: cw * n, h: 1});
        };
        this.ops.push({t: 'rect', x, y: y0, w: cw * n, h: 1});
        row(t.header, true);
        t.rows.forEach(r => row(r, false));
        for (let i = 0; i <= n; i++) this.ops.push({t: 'rect', x: Math.min(x + i * cw, x + cw * n - 1), y: y0, w: 1, h: this.y - y0});
        break;
      }
      case 'space':
      case 'checkbox':
        break;
      default:
        if (t.tokens) for (const c of t.tokens) this.block(c, x, w, size, align);
        else if (t.text) this.text([{text: t.text}], x, w, size, align);
    }
  }
}

function raster(ops, height) {
  const c = new OffscreenCanvas(WIDTH, height);
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, WIDTH, height);
  x.fillStyle = x.strokeStyle = '#000';
  x.lineWidth = 2;
  for (const o of ops) {
    if (o.t === 'text') {
      x.font = o.font;
      x.fillText(o.text, o.x, o.y);
    } else if (o.t === 'rect') x.fillRect(o.x, o.y, o.w, o.h);
    else if (o.t === 'box') {
      x.strokeRect(o.x + 1, o.y + 1, o.s - 2, o.s - 2);
      if (o.checked) {
        x.beginPath();
        x.moveTo(o.x + 4, o.y + o.s / 2);
        x.lineTo(o.x + o.s / 2.5, o.y + o.s - 4);
        x.lineTo(o.x + o.s - 4, o.y + 4);
        x.stroke();
      }
    }
  }
  return c;
}

function renderText(s) {
  const l = new Layout();
  const gap = Math.round(s.size * 0.4);
  for (const t of md.lexer(s.md)) {
    if (t.type === 'space') continue;
    l.block(t, 0, WIDTH, s.size, s.align);
    l.y += gap;
  }
  return l.ops.length ? raster(l.ops, Math.max(1, l.y - gap)) : null;
}

// Canvas -> 1-bit data. Threshold 128, or Floyd-Steinberg dither.
function toBits(canvas, dither) {
  const {width: w, height: h} = canvas;
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = g[i] < 128 ? 0 : 255;
      out[i] = v ? 0 : 1;
      if (!dither) continue;
      const e = g[i] - v;
      if (x + 1 < w) g[i + 1] += (e * 7) / 16;
      if (y + 1 < h) {
        if (x) g[i + w - 1] += (e * 3) / 16;
        g[i + w] += (e * 5) / 16;
        if (x + 1 < w) g[i + w + 1] += e / 16;
      }
    }
  }
  return out;
}

async function renderSection(s) {
  return s.type === 'image' ? renderImage(s) : renderText(s);
}

async function renderImage(s) {
  if (!s.src?.startsWith('data:image/')) return null; // only data URLs, never the network
  const [head, b64] = s.src.split(',');
  const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
  const img = await createImageBitmap(new Blob([bytes], {type: head.slice(5, head.indexOf(';'))}));
  const rot = s.rotate % 180 !== 0;
  const iw = rot ? img.height : img.width;
  const ih = rot ? img.width : img.height;
  const w = Math.max(1, Math.round((WIDTH * s.width) / 100));
  const h = Math.max(1, Math.round((ih * w) / iw));
  const left = s.align === 'center' ? (WIDTH - w) >> 1 : s.align === 'right' ? WIDTH - w : 0;
  const c = new OffscreenCanvas(WIDTH, h);
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, WIDTH, h);
  x.filter = `brightness(${100 + s.brightness}%) contrast(${100 + s.contrast}%)`;
  x.translate(left + w / 2, h / 2);
  x.rotate((s.rotate * Math.PI) / 180);
  const dw = rot ? h : w;
  const dh = rot ? w : h;
  x.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  return c;
}

export async function renderPage(sections) {
  const parts = [];
  for (const s of sections) {
    const c = await renderSection(s);
    if (c) parts.push({h: c.height, bits: toBits(c, s.type === 'image' && s.mode === 'dither')});
  }
  const height = parts.reduce((h, p) => h + p.h, 0) + GAP * Math.max(0, parts.length - 1);
  const data = new Uint8Array(WIDTH * height);
  let y = 0;
  for (const p of parts) {
    data.set(p.bits, y * WIDTH);
    y += p.h + GAP;
  }
  return {width: WIDTH, height, data};
}

export function drawBitmap(bitmap, canvas) {
  canvas.width = WIDTH;
  canvas.height = Math.max(1, bitmap.height);
  const x = canvas.getContext('2d');
  const img = x.createImageData(WIDTH, canvas.height);
  img.data.fill(255);
  bitmap.data.forEach((b, i) => { if (b) img.data.set([0, 0, 0], i * 4); });
  x.putImageData(img, 0, 0);
}

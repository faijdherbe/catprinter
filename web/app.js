import * as printer from './printer.js';
import { renderPage, drawBitmap, pageSections } from './render.js';

const $ = s => document.querySelector(s);
const load = (k, d) => {
  try { return JSON.parse(localStorage.getItem('catprinter.' + k)) ?? d; } catch { return d; }
};
const id = () => crypto.randomUUID();
const newText = () => ({id: id(), type: 'text', md: '', align: 'left', size: 24});
const newImage = () => ({id: id(), type: 'image', src: '', width: 100, align: 'center', mode: 'dither', brightness: 0, contrast: 0, rotate: 0});

let templates = load('templates', []);
let draft = load('draft', {templateId: null, content: [newText()]});
let settings = load('settings', {energy: 12000, speed: 32, feed: 150, printer: null});
let editing = null; // the template that #template shows

function flash(text, isError = false) {
  document.querySelectorAll('.saved').forEach(p => {
    p.textContent = text;
    p.classList.toggle('error-text', isError);
  });
}

function save() {
  try {
    for (const [k, v] of Object.entries({templates, draft, settings})) localStorage.setItem('catprinter.' + k, JSON.stringify(v));
    flash('✓ Saved');
  } catch {
    flash('Storage is full. Delete a template or an image and try again.', true);
  }
  schedulePreview();
}

const MARKER = {id: 'marker', type: 'text', md: '->*CONTENT goes here*<-', align: 'center', size: 20};
const selectedTemplate = () => templates.find(t => t.id === draft.templateId) ?? null;
let current = null; // the last bitmap of the compose page
let timer = null;

function schedulePreview() {
  clearTimeout(timer);
  timer = setTimeout(preview, 150);
}

async function preview() {
  try {
    if (document.body.dataset.screen === 'template' && editing) {
      drawBitmap(await renderPage(pageSections(editing, [MARKER])), $('#template-preview'));
    } else {
      current = await renderPage(pageSections(selectedTemplate(), draft.content));
      drawBitmap(current, $('#preview-canvas'));
    }
  } catch {
    flash('Cannot show the preview. Delete the last image and try again.', true);
  }
}

function confirmDelete(text) {
  const d = $('#confirm');
  d.querySelector('h5').textContent = text;
  d.showPopover();
  d.querySelector('[data-v="keep"]').focus();
  return new Promise(resolve => {
    d.onclick = e => {
      const v = e.target.closest('button')?.dataset.v;
      if (!v) return;
      d.hidePopover();
      resolve(v === 'delete');
    };
    d.ontoggle = e => { if (e.newState === 'closed') resolve(false); };
  });
}

async function loadImage(file) {
  const img = await createImageBitmap(file);
  const w = Math.min(768, img.width);
  const h = Math.round((img.height * w) / img.width);
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  const blob = await c.convertToBlob({type: 'image/png'});
  return new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
}

const TEXT_FIELDS = s => `
  <div class="field label border textarea">
    <textarea id="md-${s.id}" data-k="md" placeholder=" " rows="4"></textarea>
    <label for="md-${s.id}">Markdown</label>
  </div>
  <nav class="wrap">
    <div class="field label border">
      <select id="align-${s.id}" data-k="align"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
      <label for="align-${s.id}">Alignment</label>
    </div>
    <div class="field label border">
      <select id="size-${s.id}" data-k="size" data-num><option value="16">Small</option><option value="24">Normal</option><option value="32">Large</option><option value="48">Extra large</option></select>
      <label for="size-${s.id}">Font size</label>
    </div>
  </nav>`;

const slider = (s, k, label, min, max, unit) => `
  <label for="${k}-${s.id}">${label}: <span data-out="${k}"></span>${unit}</label>
  <div class="slider"><input type="range" id="${k}-${s.id}" data-k="${k}" min="${min}" max="${max}"><span></span></div>`;

const IMAGE_FIELDS = s => `
  <nav>
    <button class="border" data-pick><i>image</i><span>${s.src ? 'Change image' : 'Select image'}</span></button>
    <input type="file" accept="image/*" data-k="src" hidden>
  </nav>
  ${slider(s, 'width', 'Width', 10, 100, '%')}
  ${slider(s, 'brightness', 'Brightness', -100, 100, '')}
  ${slider(s, 'contrast', 'Contrast', -100, 100, '')}
  <nav class="wrap">
    <div class="field label border">
      <select id="align-${s.id}" data-k="align"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
      <label for="align-${s.id}">Alignment</label>
    </div>
    <div class="field label border">
      <select id="rotate-${s.id}" data-k="rotate" data-num><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select>
      <label for="rotate-${s.id}">Rotation</label>
    </div>
  </nav>
  <nav class="wrap">
    <label class="radio"><input type="radio" name="mode-${s.id}" value="dither" data-k="mode"><span>Dither (photos)</span></label>
    <label class="radio"><input type="radio" name="mode-${s.id}" value="threshold" data-k="mode"><span>Threshold (line art)</span></label>
  </nav>`;

function card(s, list, redraw) {
  const a = document.createElement('article');
  a.className = 'border';
  a.dataset.id = s.id;
  a.innerHTML = `
    <nav>
      <i class="grip" tabindex="0" role="button" aria-label="Move section. Drag, or press Alt and an arrow key.">drag_indicator</i>
      <h6 class="max small">${s.type === 'text' ? 'Text' : 'Image'}</h6>
      <button class="circle transparent" data-del aria-label="Delete section"><i>close</i></button>
    </nav>` + (s.type === 'text' ? TEXT_FIELDS(s) : IMAGE_FIELDS(s));

  a.querySelectorAll('[data-k]').forEach(f => {
    const k = f.dataset.k;
    const out = a.querySelector(`[data-out="${k}"]`);
    if (f.type === 'radio') f.checked = s[k] === f.value;
    else if (f.type !== 'file') f.value = s[k];
    if (out) out.textContent = s[k];
    f.addEventListener(f.type === 'file' ? 'change' : 'input', async () => {
      if (f.type === 'file') {
        if (!f.files[0]) return;
        s.src = await loadImage(f.files[0]);
        a.querySelector('[data-pick] span').textContent = 'Change image';
      } else s[k] = f.type === 'range' || 'num' in f.dataset ? +f.value : f.value;
      if (out) out.textContent = s[k];
      save();
    });
  });
  a.querySelector('[data-pick]')?.addEventListener('click', () => a.querySelector('input[type="file"]').click());
  a.querySelector('[data-del]').onclick = async () => {
    if (!(await confirmDelete(`Delete this ${s.type} section?`))) return;
    list.splice(list.indexOf(s), 1);
    save();
    redraw();
  };

  // Drag-and-drop with pointer events: works with mouse and touch.
  const grip = a.querySelector('.grip');
  grip.onpointerdown = e => {
    grip.setPointerCapture(e.pointerId);
    a.classList.add('dragging');
    grip.onpointermove = ev => {
      const box = a.parentElement;
      const next = [...box.children].find(c => c.tagName === 'ARTICLE' && c !== a && ev.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
      box.insertBefore(a, next ?? box.lastElementChild);
    };
    grip.onpointerup = grip.onpointercancel = () => {
      grip.onpointermove = grip.onpointerup = grip.onpointercancel = null;
      a.classList.remove('dragging');
      const order = [...a.parentElement.querySelectorAll(':scope > article')].map(c => c.dataset.id);
      list.sort((p, q) => order.indexOf(p.id) - order.indexOf(q.id));
      save();
    };
  };
  grip.onkeydown = e => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const i = list.indexOf(s);
    const j = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    save();
    redraw();
    document.querySelector(`[data-id="${s.id}"] .grip`).focus();
  };
  return a;
}

function area(el, list) {
  const redraw = () => {
    const add = document.createElement('nav');
    add.innerHTML = `
      <button class="border" data-t="text"><i>notes</i><span>Add text</span></button>
      <button class="border" data-t="image"><i>add_photo_alternate</i><span>Add image</span></button>`;
    add.onclick = e => {
      const t = e.target.closest('button')?.dataset.t;
      if (!t) return;
      list.push(t === 'text' ? newText() : newImage());
      save();
      redraw();
    };
    el.replaceChildren(...list.map(s => card(s, list, redraw)), add);
  };
  redraw();
}

area($('#content'), draft.content);

const MSG = {
  paper: 'Paper is empty. Put in paper and try again.',
  cover: 'Cover is open. Close the cover and try again.',
  heat: 'Printer is too hot. Wait 1 minute and try again.',
  battery: 'Battery is low. Charge the printer.',
  lost: 'Printer is not connected. Tap Print to connect again.',
  connect: 'Cannot connect. Make sure that the printer is on and that no other device is connected to it.',
};
let userDisconnect = false;
const printMsg = t => ($('#print-msg').textContent = t);

function drawConn() {
  const c = printer.isConnected();
  const b = $('#conn');
  b.className = c ? 'responsive error' : 'responsive';
  b.innerHTML = c ? '<i>bluetooth_disabled</i><span>Disconnect</span>' : '<i>bluetooth</i><span>Connect</span>';
}

function onPrinter(type, b) {
  if (type === 'disconnected') {
    setIndicator('off');
    if (!userDisconnect) printMsg(MSG.lost);
    drawConn();
    return;
  }
  const errs = printer.stateErrors(b);
  $('#st-paper').textContent = errs.includes('paper') ? 'Empty' : 'OK';
  $('#st-cover').textContent = errs.includes('cover') ? 'Open' : 'Closed';
  $('#st-battery').textContent = errs.includes('battery') ? 'Low' : 'OK';
  const fatal = errs.find(e => e !== 'battery');
  setIndicator(fatal ? 'off' : 'on');
  printMsg(fatal ? MSG[fatal] : errs.includes('battery') ? MSG.battery : '');
}

async function connectPrinter() {
  userDisconnect = false;
  settings.printer = await printer.connect(onPrinter);
  save();
  setIndicator('on');
  drawConn();
}

$('#conn').onclick = async () => {
  if (printer.isConnected()) {
    userDisconnect = true;
    printer.disconnect();
    return;
  }
  try {
    await connectPrinter();
  } catch (e) {
    if (e.name !== 'NotFoundError') printMsg(MSG.connect);
  }
};

$('#print').onclick = async () => {
  const b = $('#print');
  b.disabled = true;
  b.setAttribute('aria-busy', 'true');
  b.innerHTML = '<progress class="circle small"></progress><span>Printing</span>';
  let stage = 'connect';
  try {
    clearTimeout(timer);
    await preview();
    if (!printer.isConnected()) await connectPrinter();
    stage = 'print';
    printMsg('');
    await printer.print(current, settings, (n, total) => (b.querySelector('span').textContent = `Printing ${n}/${total}`));
  } catch (e) {
    if (e.name !== 'NotFoundError') printMsg(stage === 'connect' ? MSG.connect : MSG.lost);
  }
  b.disabled = false;
  b.removeAttribute('aria-busy');
  b.innerHTML = '<i>print</i><span>Print</span>';
};

document.querySelectorAll('[data-s]').forEach(f => {
  const k = f.dataset.s;
  const out = document.querySelector(`#printer-screen [data-out="${k}"]`);
  f.value = settings[k];
  out.textContent = settings[k];
  f.oninput = () => {
    settings[k] = +f.value;
    out.textContent = f.value;
    save();
  };
});
drawConn();

// TEMPLATES
const validSection = s =>
  s && typeof s.id === 'string' &&
  ((s.type === 'text' && typeof s.md === 'string') || (s.type === 'image' && typeof s.src === 'string' && (s.src === '' || s.src.startsWith('data:image/'))));

function drawTemplateSelect() {
  const sel = $('#template-select');
  sel.replaceChildren(new Option('None', ''), ...templates.map(t => new Option(t.name, t.id)));
  sel.value = draft.templateId ?? '';
}
$('#template-select').onchange = e => {
  draft.templateId = e.target.value || null;
  save();
};

function exportTemplate(t) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(t, null, 1)], {type: 'application/json'}));
  a.download = `${t.name}.catprinter.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function drawTemplates() {
  $('#template-list').replaceChildren(...templates.map(t => {
    const li = document.createElement('li');
    li.innerHTML = `
      <i>dashboard</i>
      <div class="max"><a class="link" href="#template"></a></div>
      <div>
        <button class="circle transparent" aria-haspopup="menu"><i>more_vert</i></button>
        <menu class="left no-wrap">
          <li><a href="#template" data-a="edit"><i>edit</i>Edit</a></li>
          <li><a href="#templates" data-a="export"><i>download</i>Export</a></li>
          <li><a href="#templates" data-a="delete" class="error-text"><i>delete</i>Delete</a></li>
        </menu>
      </div>`;
    const name = li.querySelector('.max a');
    name.textContent = t.name;
    name.onclick = () => (editing = t);
    const btn = li.querySelector('button');
    btn.setAttribute('aria-label', `Actions for template ${t.name}`);
    btn.onclick = e => {
      e.stopPropagation();
      document.querySelectorAll('menu.active').forEach(m => m !== btn.nextElementSibling && m.classList.remove('active'));
      btn.nextElementSibling.classList.toggle('active');
    };
    li.querySelector('menu').onclick = async e => {
      const act = e.target.closest('a')?.dataset.a;
      if (act === 'edit') editing = t;
      if (act === 'export') { e.preventDefault(); exportTemplate(t); }
      if (act === 'delete') {
        e.preventDefault();
        if (!(await confirmDelete(`Delete template ${t.name}?`))) return;
        templates.splice(templates.indexOf(t), 1);
        if (draft.templateId === t.id) draft.templateId = null;
        save();
        drawTemplates();
        drawTemplateSelect();
      }
    };
    return li;
  }));
}
document.addEventListener('click', () => document.querySelectorAll('menu.active').forEach(m => m.classList.remove('active')));

function drawEditor() {
  $('#template-name').value = editing.name;
  area($('#top'), editing.top);
  area($('#bottom'), editing.bottom);
}
$('#template-name').oninput = e => {
  editing.name = e.target.value;
  save();
  drawTemplateSelect();
};

$('#new-template').onclick = () => {
  editing = {id: id(), name: 'New template', top: [], bottom: []};
  templates.push(editing);
  save();
  drawTemplateSelect();
  location.hash = '#template';
};

$('#import-btn').onclick = () => $('#import').click();
$('#import').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const t = JSON.parse(await file.text());
    if (typeof t.name !== 'string' || !Array.isArray(t.top) || !Array.isArray(t.bottom) || ![...t.top, ...t.bottom].every(validSection)) throw new Error('invalid');
    templates.push({...t, id: id()});
    $('#templates-msg').textContent = '';
    save();
    drawTemplates();
    drawTemplateSelect();
  } catch {
    $('#templates-msg').textContent = 'This file is not a catprinter template. Select a .catprinter.json file.';
  }
};

function setIndicator(state) {
  const i = $('#ind');
  i.dataset.state = state;
  const name = settings.printer ?? 'No printer';
  i.querySelector('i').textContent = {none: 'bluetooth', off: 'bluetooth_disabled', on: 'bluetooth_connected'}[state];
  i.querySelector('span').textContent = state === 'off' ? `${name} offline` : name;
}

const SCREENS = ['edit', 'preview', 'templates', 'template', 'printer'];
function route() {
  let s = location.hash.slice(1);
  if (!SCREENS.includes(s)) s = 'edit';
  if (s === 'template' && !editing) s = 'templates';
  document.body.dataset.screen = s;
  document.querySelectorAll('nav a[href^="#"]').forEach(a => {
    const on = a.hash === '#' + s || (a.dataset.also ?? '').split(' ').includes(s);
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (s === 'templates') drawTemplates();
  if (s === 'template') drawEditor();
  schedulePreview();
}

// Browser check: test the real Web Bluetooth API, not the browser name.
const REASON = {
  'no-api': 'This browser does not have Web Bluetooth. Use Chrome or Edge on a computer, or Chrome on Android. Firefox, Safari and all browsers on iPhone and iPad do not have Web Bluetooth. On Linux, Chrome has Web Bluetooth only after you enable chrome://flags/#enable-experimental-web-platform-features.',
  off: 'This device has no Bluetooth, or Bluetooth is off. Switch on Bluetooth, then load this page again.',
};
const bt = await printer.bluetoothState();
if (bt !== 'ok') {
  $('#gate-reason').textContent = REASON[bt];
  document.body.dataset.gate = '';
  $('#gate-continue').onclick = () => delete document.body.dataset.gate;
  $('#print').disabled = $('#conn').disabled = true;
  $('#print-msg').textContent = 'You cannot connect or print in this browser.';
}

addEventListener('hashchange', route);
globalThis.ui?.('theme', '#7540bf');
setIndicator(settings.printer ? 'off' : 'none');
drawTemplateSelect();
route();

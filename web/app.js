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

// PREVIEW (Task 7)
function schedulePreview() {}

// COMPOSER (Task 7)

// PRINTER (Task 8)

// TEMPLATES (Task 9)
function drawTemplates() {}
function drawEditor() {}
function drawTemplateSelect() {}

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
  'no-api': 'This browser does not have Web Bluetooth. Use Chrome or Edge on a computer, or Chrome on Android. Firefox, Safari and all browsers on iPhone and iPad do not have Web Bluetooth.',
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

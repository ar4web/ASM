"use strict";
/* ================================================================
   Stamp Studio — Smooth Controller + Animations
   Unified floating controller · Smooth everything · Arabic fix
   ================================================================ */

const CSS_DPI = 96, CSS_MM = CSS_DPI / 25.4, DEG = Math.PI / 180;
let DPI_CURRENT = 300;
const mmPx = mm => mm * (DPI_CURRENT / 25.4);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = () => 'L' + Math.random().toString(36).slice(2, 8);
const lerp = (a, b, t) => a + (b - a) * t;

/* ── Undo / Redo ────────────────────────────────────────────────── */
const HIST_MAX = 60;
let histStack = [], histIdx = -1, histPushing = false;

function pushHistory() {
  histStack = histStack.slice(0, histIdx + 1);
  histStack.push(JSON.stringify(cfg));
  if (histStack.length > HIST_MAX) histStack.shift();
  histIdx = histStack.length - 1;
  histPushing = false;
  saveState();
}

function undo() { if (histIdx <= 0) return; histIdx--; cfg = JSON.parse(histStack[histIdx]); DPI_CURRENT = cfg.dpi || 300; syncAll(); render(); showToast('Undo'); }
function redo() { if (histIdx >= histStack.length - 1) return; histIdx++; cfg = JSON.parse(histStack[histIdx]); DPI_CURRENT = cfg.dpi || 300; syncAll(); render(); showToast('Redo'); }
function autoHist() { if (!histPushing) { histPushing = true; pushHistory(); } }

/* ── RTL ───────────────────────────────────────────────────────── */
const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const isRTL = t => RTL_RE.test(t || '');
const layerDir = l => l.dir === 'auto' ? (isRTL(l.text) ? 'rtl' : 'ltr') : l.dir;

const debounce = (fn, ms = 40) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function mkRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function hexRgba(hex, opacity) {
  let c = (hex || '#000000').replace('#', '').trim();
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(c)) c = '000000';
  const n = parseInt(c, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(opacity / 100, 0, 1)})`;
}

/* ── Storage ───────────────────────────────────────────────────── */
const STORAGE_KEY = 'stampstudio_v4';
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (_) {} }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return false;
    cfg = buildConfig(data.template || 'oval');
    Object.assign(cfg, data);
    if (!Array.isArray(cfg.layers) || cfg.layers.length === 0) cfg.layers = defaultLayers();
    cfg.layers = cfg.layers.map(l => makeLayer(l));
    selId = cfg.layers[0]?.id || null;
    selectedIds = new Set([selId].filter(Boolean));
    return true;
  } catch { return false; }
}

/* ── Toast ─────────────────────────────────────────────────────── */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ── Fonts ─────────────────────────────────────────────────────── */
const FONTS = [
  { group: 'Arabic', items: ['Cairo','Tajawal','Noto Sans Arabic'] },
  { group: 'Formal', items: ['Amiri','Noto Naskh Arabic','Noto Kufi Arabic'] },
  { group: 'Latin', items: ['Inter','Montserrat','Poppins'] },
];
const FONT_WEIGHTS = {
  'Cairo': [400,600,700,800], 'Tajawal': [400,500,700],
  'Noto Sans Arabic': [400,500,600,700], 'Amiri': [400,700],
  'Noto Naskh Arabic': [400,600,700], 'Noto Kufi Arabic': [400,700,800],
  'Inter': [300,400,500,600,700], 'Montserrat': [600,700,800,900], 'Poppins': [500,600,700],
};
function safeWeight(font, weight) {
  const list = FONT_WEIGHTS[font];
  if (!list) return weight;
  if (list.includes(weight)) return weight;
  return list.reduce((a, b) => Math.abs(b - weight) < Math.abs(a - weight) ? b : a);
}
function fontOptHTML(sel) {
  return FONTS.map(g => `<optgroup label="${g.group}">` + g.items.map(f => `<option${f === sel ? ' selected' : ''}>${f}</option>`).join('') + '</optgroup>').join('');
}

/* ── State Model ───────────────────────────────────────────────── */
function makeLayer(o = {}) {
  return Object.assign({
    id: uid(), name: 'Text', text: 'Text',
    font: 'Inter', weight: 700,
    sizeMm: 4, letterSpacing: 0, wordSpacing: 0,
    scaleX: 1, scaleY: 1, dir: 'auto', mode: 'curved', flip: false,
    radiusMm: 16, startAngle: 200, endAngle: 340,
    offsetXmm: 0, offsetYmm: 0, visible: true, type: 'text',
    shapeType: 'star', shapeSizeMm: 10, shapeRotation: 0, shapeFill: true, shapePoints: 5,
    imageData: null, imageWidthMm: 10, imageHeightMm: 10,
  }, o);
}

function defaultLayers() {
  return [
    makeLayer({ name: 'Top Arabic', text: 'شركة بصمة الموارد المحدودة', font: 'Cairo', dir: 'rtl', weight: 800, sizeMm: 4.5, mode: 'curved', radiusMm: 16, startAngle: 200, endAngle: 340 }),
    makeLayer({ name: 'Bottom English', text: 'LIMITED RESOURCE STAMP CO.', font: 'Inter', dir: 'ltr', weight: 700, sizeMm: 3.8, mode: 'curved', flip: true, radiusMm: 15.8, startAngle: 145, endAngle: 35, letterSpacing: 1.5 }),
    makeLayer({ name: 'Number', text: '1234567890', font: 'Inter', weight: 900, sizeMm: 3.2, mode: 'straight', offsetYmm: 0 }),
  ];
}

function baseStyle() {
  return { inkColor: '#1e3a8a', opacity: 100, inkBleed: true, inkBleedAmount: 0.5, grungeTexture: true, grungeAmount: 0.3, rotationJitter: true, jitterDegrees: 0.9, paddingMm: 5, seed: 73219, dpi: 300 };
}

/* ── Templates ─────────────────────────────────────────────────── */
const TEMPLATES = {
  oval:           { label: 'Oval',      icon: '⬮', shape: 'oval',      width: 62, height: 36, outerRingThickness: 1.8, innerRingThickness: 0.8, ringGap: 2.0, cornerRadius: 4, rings: 2 },
  circle:         { label: 'Circle',    icon: '●', shape: 'circle',    outerDiameter: 46, outerRingThickness: 2.0, innerRingThickness: 1.1, ringGap: 1.6, cornerRadius: 4, rings: 2 },
  tripleRing:     { label: 'Triple',    icon: '◉', shape: 'circle',    outerDiameter: 50, outerRingThickness: 2.2, innerRingThickness: 0.9, innerRing2Thickness: 0.6, ringGap: 1.3, cornerRadius: 4, rings: 3 },
  rectangle:      { label: 'Rectangle', icon: '▭', shape: 'rectangle', width: 72, height: 34, outerRingThickness: 1.4, innerRingThickness: 0.6, ringGap: 2.0, cornerRadius: 4, rings: 2 },
  square:         { label: 'Square',    icon: '■', shape: 'rectangle', width: 44, height: 44, outerRingThickness: 1.6, innerRingThickness: 0, ringGap: 0, cornerRadius: 8, rings: 1 },
  minimal:        { label: 'Minimal',   icon: '○', shape: 'circle',    outerDiameter: 38, outerRingThickness: 1.1, innerRingThickness: 0, ringGap: 0, cornerRadius: 3, rings: 1 },
  saudiCorporate: { label: 'Saudi CO.', icon: '★', shape: 'oval',      width: 62, height: 38, outerRingThickness: 1.6, innerRingThickness: 0.8, innerRing2Thickness: 0.5, ringGap: 2.0, cornerRadius: 4, rings: 3 },
};

function templateLayers(name) {
  if (name === 'rectangle') return [
    makeLayer({ name: 'Title', text: 'COMPANY NAME', font: 'Montserrat', weight: 900, sizeMm: 4, letterSpacing: 1.5, mode: 'straight', offsetYmm: -7 }),
    makeLayer({ name: 'City', text: 'City · Country', font: 'Montserrat', sizeMm: 3, mode: 'straight', offsetYmm: 0 }),
    makeLayer({ name: 'Email', text: 'info@company.com', font: 'Montserrat', sizeMm: 2.8, mode: 'straight', offsetYmm: 7 }),
  ];
  if (name === 'square') return [
    makeLayer({ name: 'Title', text: 'APPROVED', font: 'Montserrat', weight: 900, sizeMm: 4.5, letterSpacing: 1, mode: 'straight', offsetYmm: -3 }),
    makeLayer({ name: 'Arabic', text: 'موافق عليه', font: 'Cairo', dir: 'rtl', sizeMm: 3.5, mode: 'straight', offsetYmm: 5 }),
  ];
  if (name === 'minimal') return [
    makeLayer({ name: 'Company', text: 'COMPANY NAME', font: 'Montserrat', weight: 800, sizeMm: 3.2, letterSpacing: 2, mode: 'curved', radiusMm: 14, startAngle: 210, endAngle: 330 }),
    makeLayer({ name: 'Logo', text: 'CN', font: 'Montserrat', weight: 800, sizeMm: 7, mode: 'straight' }),
  ];
  if (name === 'saudiCorporate') return [
    makeLayer({ name: 'Arabic', text: 'بصمة التاسعة المحدودة', font: 'Cairo', weight: 800, dir: 'rtl', sizeMm: 4.5, letterSpacing: 0.8, mode: 'curved', radiusMm: 27, startAngle: 200, endAngle: 340 }),
    makeLayer({ name: 'CR', text: 'ب.ت. ٩٠٥٢٣٣٠٧٧', font: 'Cairo', weight: 800, dir: 'rtl', sizeMm: 3.8, letterSpacing: 0.5, mode: 'curved', flip: true, radiusMm: 26.5, startAngle: 200, endAngle: 340 }),
    makeLayer({ name: 'Star L', text: '★', font: 'Inter', weight: 700, sizeMm: 3.5, mode: 'straight', offsetXmm: -17 }),
    makeLayer({ name: 'Star R', text: '★', font: 'Inter', weight: 700, sizeMm: 3.5, mode: 'straight', offsetXmm: 17 }),
    makeLayer({ name: 'Center', text: '✪', font: 'Inter', weight: 900, sizeMm: 10, mode: 'straight' }),
  ];
  const ls = defaultLayers();
  if (name === 'oval') { ls[0].radiusMm = 28; ls[1].radiusMm = 27.5; ls[0].startAngle = 195; ls[0].endAngle = 345; ls[1].startAngle = 150; ls[1].endAngle = 30; }
  if (name === 'tripleRing') { ls[0].radiusMm = 19.5; ls[1].radiusMm = 19; }
  if (name === 'circle') { ls[0].radiusMm = 15; ls[1].radiusMm = 14.8; }
  return ls;
}

function buildConfig(name) {
  const t = TEMPLATES[name] || TEMPLATES.circle;
  return Object.assign({}, baseStyle(), {
    template: name, shape: t.shape,
    outerDiameter: t.outerDiameter || t.width,
    width: t.width, height: t.height,
    outerRingThickness: t.outerRingThickness,
    innerRingThickness: t.innerRingThickness,
    innerRing2Thickness: t.innerRing2Thickness || t.innerRingThickness * 0.8,
    ringGap: t.ringGap, centerAreaDiameter: t.centerAreaDiameter || 0,
    cornerRadius: t.cornerRadius, rings: t.rings,
    shapeOffsetXmm: 0, shapeOffsetYmm: 0,
    layers: templateLayers(name),
    editorZoom: 1, editorPanX: 0, editorPanY: 0,
  });
}

const SWATCHES = ['#1e3a8a','#c0182a','#15171c','#1f7a45','#5b21b6','#0f766e','#b45309','#0369a1'];

/* ── Live State ────────────────────────────────────────────────── */
let cfg = buildConfig('oval');
let selId = cfg.layers[0].id;
let selectedIds = new Set([selId]);
let selShape = false, selRing = null, exporting = false;
let currentElement = null;

const selLayer = () => cfg.layers.find(l => l.id === selId) || null;
const stampSize = () => cfg.shape === 'circle' ? { w: cfg.outerDiameter, h: cfg.outerDiameter } : { w: cfg.width, h: cfg.height };

/* ── Canvas ────────────────────────────────────────────────────── */
const canvas = document.getElementById('stampCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
const viewport = document.getElementById('viewport');
const stage = document.getElementById('stage');
const zoomLabel = document.getElementById('zoomLabel');

/* ═══ SMOOTH ZOOM (mouse wheel) ═══ */
let targetZoom = 1;
let currentZoom = 1;
let isPanning = false;
let panStart = { x: 0, y: 0 };
let targetPan = { x: 0, y: 0 };
let currentPan = { x: 0, y: 0 };

function setupCanvas() {
  const canvasSizePx = 10 * 300;
  canvas.width = canvasSizePx;
  canvas.height = canvasSizePx;
  updateCanvasCSS();
}

function updateCanvasCSS() {
  const vpW = viewport.clientWidth - 40;
  const vpH = viewport.clientHeight - 40;
  const baseSize = Math.min(vpW, vpH, 600);
  const size = baseSize * currentZoom;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  canvas.style.transform = `translate(${currentPan.x}px, ${currentPan.y}px)`;
  zoomLabel.textContent = Math.round(currentZoom * 100) + '%';
}

function smoothZoom(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.08 : 0.08;
  targetZoom = clamp(targetZoom + delta, 0.3, 4);
  animateTransform();
}

function animateTransform() {
  const ease = 0.15;
  let animFrame;
  function step() {
    currentZoom = lerp(currentZoom, targetZoom, ease);
    currentPan.x = lerp(currentPan.x, targetPan.x, ease);
    currentPan.y = lerp(currentPan.y, targetPan.y, ease);
    updateCanvasCSS();
    if (Math.abs(currentZoom - targetZoom) > 0.001 || Math.abs(currentPan.x - targetPan.x) > 0.5 || Math.abs(currentPan.y - targetPan.y) > 0.5) {
      animFrame = requestAnimationFrame(step);
    }
  }
  cancelAnimationFrame(animFrame);
  step();
}

function initZoomPan() {
  viewport.addEventListener('wheel', smoothZoom, { passive: false });
  viewport.addEventListener('mousedown', e => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      isPanning = true;
      panStart = { x: e.clientX - targetPan.x, y: e.clientY - targetPan.y };
      viewport.style.cursor = 'grabbing';
    }
  });
  document.addEventListener('mousemove', e => {
    if (!isPanning) return;
    targetPan.x = e.clientX - panStart.x;
    targetPan.y = e.clientY - panStart.y;
    animateTransform();
  });
  document.addEventListener('mouseup', () => {
    isPanning = false;
    viewport.style.cursor = '';
  });
  // Double-click to reset
  viewport.addEventListener('dblclick', () => {
    targetZoom = 1;
    targetPan = { x: 0, y: 0 };
    animateTransform();
  });
}

/* ═══ SIDEBAR TOGGLE ═══ */
function initSidebarToggle() {
  const panel = document.getElementById('leftPanel');
  const btn = document.getElementById('sidebarToggle');
  btn.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    btn.textContent = panel.classList.contains('collapsed') ? '☰' : '✕';
  });
}

/* ═══ FLOATING PANEL DRAG (smooth) ═══ */
function initFloatingPanel() {
  const panel = document.getElementById('floatingPanel');
  const header = document.getElementById('fpHeader');
  const close = document.getElementById('fpClose');

  close.addEventListener('click', () => {
    panel.classList.remove('open');
  });

  let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

  header.addEventListener('mousedown', e => {
    if (e.target.closest('.fp-close')) return;
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    panel.style.transition = 'none';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const x = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - dragOffsetX));
    const y = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, e.clientY - dragOffsetY));
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
    panel.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
    panel.style.transition = '';
  });
}

/* ================================================================
   DRAWING
   ================================================================ */
function ellipseStroke(cx, cy, rx, ry, thickMm, color) {
  if (thickMm <= 0 || rx <= 0 || ry <= 0) return;
  const lw = mmPx(thickMm);
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.5, rx - lw/2), Math.max(0.5, ry - lw/2), 0, 0, Math.PI * 2);
  ctx.stroke(); ctx.restore();
}

function roundRectPath(x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath(); ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r); ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r); ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r); ctx.closePath();
}

function rectStroke(cx, cy, wPx, hPx, insetMm, thickMm, color) {
  if (thickMm <= 0) return;
  const inset = mmPx(insetMm), lw = mmPx(thickMm);
  const x = cx - wPx/2 + inset + lw/2, y = cy - hPx/2 + inset + lw/2;
  const rw = wPx - inset*2 - lw, rh = hPx - inset*2 - lw;
  if (rw <= 0 || rh <= 0) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw;
  roundRectPath(x, y, rw, rh, mmPx(cfg.cornerRadius)); ctx.stroke(); ctx.restore();
}

function drawGeometry(cx, cy, wPx, hPx, color) {
  const rx = wPx/2, ry = hPx/2;
  const insetPx = mmPx(cfg.outerRingThickness + cfg.ringGap);
  if (cfg.shape === 'rectangle') {
    rectStroke(cx, cy, wPx, hPx, 0, cfg.outerRingThickness, color);
    if (cfg.rings >= 2 && cfg.innerRingThickness > 0) rectStroke(cx, cy, wPx, hPx, cfg.outerRingThickness + cfg.ringGap, cfg.innerRingThickness, color);
    if (cfg.rings >= 3 && cfg.innerRing2Thickness > 0) rectStroke(cx, cy, wPx, hPx, cfg.outerRingThickness + cfg.ringGap + cfg.innerRingThickness + cfg.ringGap, cfg.innerRing2Thickness, color);
    return;
  }
  ellipseStroke(cx, cy, rx, ry, cfg.outerRingThickness, color);
  if (cfg.rings >= 2 && cfg.innerRingThickness > 0) ellipseStroke(cx, cy, rx-insetPx, ry-insetPx, cfg.innerRingThickness, color);
  if (cfg.rings >= 3 && cfg.innerRing2Thickness > 0) {
    const inset2 = mmPx(cfg.outerRingThickness + cfg.ringGap) + mmPx(cfg.innerRingThickness + cfg.ringGap);
    ellipseStroke(cx, cy, rx-inset2, ry-inset2, cfg.innerRing2Thickness, color);
  }
  if (cfg.centerAreaDiameter > 0) {
    const cr = mmPx(cfg.centerAreaDiameter/2);
    const sy = cfg.shape === 'oval' ? clamp(ry/rx, 0.1, 1) : 1;
    ellipseStroke(cx, cy, cr, cr*sy, Math.max(0.4, cfg.innerRingThickness||0.8), color);
  }
}

/* ── Text Rendering (Arabic fix) ──────────────────────────────── */
function textEllipseMm(layer) {
  const sz = stampSize();
  const r = layer.radiusMm;
  if (cfg.shape === 'oval' && sz.w > 0) return { rx: r, ry: Math.max(0.5, r * (sz.h / sz.w)) };
  return { rx: r, ry: r };
}

function buildTextStrip(layer, color) {
  const fontPx = mmPx(layer.sizeMm);
  const fontStr = `${safeWeight(layer.font, layer.weight)} ${fontPx}px "${layer.font}"`;
  const dir = layerDir(layer);
  const sx = layer.scaleX || 1, sy = layer.scaleY || 1;
  const m = document.createElement('canvas').getContext('2d');
  m.font = fontStr;
  if ('letterSpacing' in m) m.letterSpacing = `${layer.letterSpacing}px`;
  if ('wordSpacing' in m) m.wordSpacing = `${layer.wordSpacing}px`;
  const measured = m.measureText(layer.text);
  const textW = Math.max(2, Math.ceil(measured.width * sx));
  const pad = fontPx * 0.3;
  const sw = textW + pad*2, sh = Math.max(2, Math.ceil(fontPx * 2.2 * sy));
  const strip = document.createElement('canvas');
  strip.width = sw; strip.height = sh;
  const sc = strip.getContext('2d');
  sc.font = fontStr;
  if ('letterSpacing' in sc) sc.letterSpacing = `${layer.letterSpacing}px`;
  if ('wordSpacing' in sc) sc.wordSpacing = `${layer.wordSpacing}px`;
  sc.fillStyle = color; sc.textAlign = 'center'; sc.textBaseline = 'middle';
  sc.direction = dir;
  sc.translate(sw/2, sh/2); sc.scale(sx, sy); sc.fillText(layer.text, 0, 0);
  return { canvas: strip, textWidth: textW, pad };
}

function bleedWrap(drawFn, rng) {
  if (!cfg.inkBleed || cfg.inkBleedAmount <= 0) { drawFn(); return; }
  const blurPx = mmPx(cfg.inkBleedAmount) * 0.20;
  ctx.save(); ctx.globalAlpha *= 0.16; ctx.filter = `blur(${blurPx}px)`;
  for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate((rng()-0.5)*mmPx(0.09), (rng()-0.5)*mmPx(0.09)); drawFn(); ctx.restore(); }
  ctx.restore(); drawFn();
}

function drawCurvedLayer(layer, cx, cy, color, rng) {
  if (!layer.text.trim()) return;
  const info = buildTextStrip(layer, color), strip = info.canvas;
  const sw = strip.width, sh = strip.height, textW = info.textWidth, padPx = info.pad;
  const slice = Math.max(1, Math.round(sh/32));
  const e = textEllipseMm(layer);
  const textRx = mmPx(e.rx), textRy = mmPx(e.ry);
  const draw = () => {
    for (let x = 0; x < sw; x += slice) {
      const f = (x + slice/2 - padPx) / textW;
      if (f < -0.02 || f > 1.02) continue;
      const cf = Math.max(0, Math.min(1, f));
      const ang = (layer.startAngle + (layer.endAngle - layer.startAngle) * cf) * DEG;
      const tx = cx + Math.cos(ang) * textRx, ty = cy + Math.sin(ang) * textRy;
      const tangent = Math.atan2(textRy*Math.cos(ang), -textRx*Math.sin(ang));
      const jit = (cfg.rotationJitter && cfg.jitterDegrees > 0) ? (rng()*2-1)*cfg.jitterDegrees*DEG : 0;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(tangent + (layer.flip ? Math.PI : 0) + jit);
      ctx.drawImage(strip, x, 0, slice, sh, -slice/2, -sh/2, slice, sh); ctx.restore();
    }
  };
  bleedWrap(draw, rng);
}

function drawStraightLayer(layer, cx, cy, color, rng) {
  if (!layer.text.trim()) return;
  const fontPx = mmPx(layer.sizeMm);
  const tx = cx + mmPx(layer.offsetXmm), ty = cy + mmPx(layer.offsetYmm);
  const draw = () => {
    ctx.save();
    ctx.font = `${safeWeight(layer.font, layer.weight)} ${fontPx}px "${layer.font}"`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${layer.letterSpacing}px`;
    if ('wordSpacing' in ctx) ctx.wordSpacing = `${layer.wordSpacing}px`;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.direction = layerDir(layer);
    const sx = layer.scaleX||1, sy = layer.scaleY||1;
    if (cfg.rotationJitter && cfg.jitterDegrees > 0) {
      ctx.translate(tx, ty); ctx.rotate((rng()*2-1)*cfg.jitterDegrees*DEG*0.5); ctx.scale(sx, sy); ctx.fillText(layer.text, 0, 0);
    } else { ctx.translate(tx, ty); ctx.scale(sx, sy); ctx.fillText(layer.text, 0, 0); }
    ctx.restore();
  };
  bleedWrap(draw, rng);
}

function drawShapeLayer(layer, cx, cy, color, rng) {
  const tx = cx + mmPx(layer.offsetXmm), ty = cy + mmPx(layer.offsetYmm);
  const size = mmPx(layer.shapeSizeMm), rot = (layer.shapeRotation||0)*DEG;
  const fill = layer.shapeFill, pts = layer.shapePoints || 5;
  const draw = () => {
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(rot); ctx.beginPath();
    if (layer.shapeType === 'star') {
      const inner = size * 0.4;
      for (let i = 0; i < pts*2; i++) {
        const r = i%2===0 ? size : inner;
        const a = (i*Math.PI)/pts - Math.PI/2;
        if (i===0) ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); else ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      ctx.closePath();
    } else if (layer.shapeType === 'pentagon' || layer.shapeType === 'hexagon') {
      const n = layer.shapeType === 'pentagon' ? 5 : 6;
      for (let i = 0; i < n; i++) {
        const a = (i*2*Math.PI)/n - Math.PI/2;
        if (i===0) ctx.moveTo(Math.cos(a)*size, Math.sin(a)*size); else ctx.lineTo(Math.cos(a)*size, Math.sin(a)*size);
      }
      ctx.closePath();
    } else if (layer.shapeType === 'diamond') {
      ctx.moveTo(0,-size); ctx.lineTo(size*0.6,0); ctx.lineTo(0,size); ctx.lineTo(-size*0.6,0); ctx.closePath();
    } else if (layer.shapeType === 'cross') {
      const t = size*0.3;
      ctx.moveTo(-t,-size); ctx.lineTo(t,-size); ctx.lineTo(t,-t);
      ctx.lineTo(size,-t); ctx.lineTo(size,t); ctx.lineTo(t,t);
      ctx.lineTo(t,size); ctx.lineTo(-t,size); ctx.lineTo(-t,t);
      ctx.lineTo(-size,t); ctx.lineTo(-size,-t); ctx.lineTo(-t,-t); ctx.closePath();
    } else if (layer.shapeType === 'circle') { ctx.arc(0, 0, size, 0, Math.PI*2); }
    if (fill) { ctx.fillStyle = color; ctx.fill(); }
    else { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, mmPx(0.5)); ctx.stroke(); }
    ctx.restore();
  };
  bleedWrap(draw, rng);
}

const imageCache = {};
function drawImageLayer(layer, cx, cy) {
  if (!layer.imageData) return;
  let img = imageCache[layer.id];
  if (!img) {
    img = new Image();
    img.onload = () => { imageCache[layer.id] = img; render(); };
    img.src = layer.imageData;
    return;
  }
  const w = mmPx(layer.imageWidthMm), h = mmPx(layer.imageHeightMm);
  ctx.save(); ctx.translate(cx + mmPx(layer.offsetXmm), cy + mmPx(layer.offsetYmm));
  ctx.drawImage(img, -w/2, -h/2, w, h); ctx.restore();
}

/* ── Main Render ───────────────────────────────────────────────── */
function render() {
  setupCanvas();
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const stampW = mmPx(stampSize().w);
  const stampH = mmPx(stampSize().h);
  const cx = W/2 + mmPx(cfg.shapeOffsetXmm || 0);
  const cy = H/2 + mmPx(cfg.shapeOffsetYmm || 0);

  const color = hexRgba(cfg.inkColor, cfg.opacity);
  const rng = mkRng(cfg.seed);

  drawGeometry(cx, cy, stampW, stampH, color);

  cfg.layers.forEach(layer => {
    if (!layer.visible) return;
    if (layer.type === 'text' && layer.mode === 'curved') drawCurvedLayer(layer, cx, cy, color, rng);
    else if (layer.type === 'text' && layer.mode === 'straight') drawStraightLayer(layer, cx, cy, color, rng);
    else if (layer.type === 'shape') drawShapeLayer(layer, cx, cy, color, rng);
    else if (layer.type === 'image') drawImageLayer(layer, cx, cy);
  });
}

const renderD = debounce(render, 30);

/* ═══ POINTER EVENTS ═══ */
function bindPointerEvents() {
  canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const stampW = mmPx(stampSize().w), stampH = mmPx(stampSize().h);
    const cx = canvas.width/2 + mmPx(cfg.shapeOffsetXmm || 0);
    const cy = canvas.height/2 + mmPx(cfg.shapeOffsetYmm || 0);

    const dx = (mx - cx) / (stampW/2);
    const dy = (my - cy) / (stampH/2);
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist > 0.7 && dist < 1.15) {
      if (dist > 0.85) selectElement({ type: 'ring', id: 'outer-ring' });
      else if (cfg.rings >= 2) selectElement({ type: 'ring', id: 'inner-ring' });
      return;
    }

    let found = false;
    cfg.layers.forEach(layer => {
      const lcx = cx + mmPx(layer.offsetXmm);
      const lcy = cy + mmPx(layer.offsetYmm);
      if (layer.mode === 'straight') {
        const dist = Math.hypot(mx - lcx, my - lcy);
        if (dist < mmPx(layer.sizeMm) * 2) { selectElement({ type: 'layer', id: layer.id }); found = true; }
      } else {
        const dist = Math.hypot(mx - lcx, my - lcy);
        if (dist < mmPx(layer.radiusMm)) { selectElement({ type: 'layer', id: layer.id }); found = true; }
      }
    });

    if (!found) selectElement(null);
  });
}

/* ═══ SELECTION ═══ */
function selectElement(el) {
  if (!el) {
    currentElement = null; selShape = false; selRing = null; selId = null; selectedIds.clear();
  } else if (el.type === 'ring') {
    currentElement = el.id; selRing = el.id.replace('-ring', ''); selShape = true; selId = null; selectedIds.clear();
  } else if (el.type === 'layer') {
    selId = el.id; selectedIds = new Set([el.id]); currentElement = el.id; selShape = false; selRing = null;
  }
  updateLeftPanel();
  updateFloatingPanel();
  render();
}

/* ═══ LEFT PANEL ═══ */
function updateLeftPanel() {
  document.querySelectorAll('.lp-element').forEach(el => {
    el.classList.toggle('selected', currentElement === el.dataset.element);
  });

  const outerRing = document.getElementById('valOuterRing');
  const innerRing = document.getElementById('valInnerRing');
  const centerRing = document.getElementById('valCenterRing');
  if (outerRing) outerRing.textContent = cfg.outerRingThickness || '0';
  if (innerRing) innerRing.textContent = cfg.innerRingThickness || '0';
  if (centerRing) centerRing.textContent = cfg.innerRing2Thickness || '0';

  const centerRingEl = document.querySelector('[data-element="center-ring"]');
  if (centerRingEl) centerRingEl.style.display = cfg.rings >= 3 ? '' : 'none';

  const stampSz = document.getElementById('valStampSize');
  const stampOff = document.getElementById('valStampOffset');
  if (stampSz) stampSz.textContent = `${cfg.width}×${cfg.height}`;
  if (stampOff) stampOff.textContent = `${cfg.shapeOffsetXmm||0}, ${cfg.shapeOffsetYmm||0}`;

  const straightList = document.getElementById('straightTextList');
  if (straightList) {
    const straightLayers = cfg.layers.filter(l => l.mode === 'straight' && l.type === 'text');
    if (straightLayers.length === 0) {
      straightList.innerHTML = '<div style="font-size:10px;color:var(--text-dim);padding:2px 10px">None</div>';
    } else {
      straightList.innerHTML = straightLayers.map(l => `
        <div class="lp-element${currentElement === l.id ? ' selected' : ''}" data-element="${l.id}">
          <span class="lp-icon">T</span>
          <span class="lp-name">${l.name || l.text}</span>
        </div>
      `).join('');
    }
    bindLeftPanelElements(straightList);
  }

  const shapeListEl = document.getElementById('shapeList');
  if (shapeListEl) {
    const shapeLayers = cfg.layers.filter(l => l.type === 'shape');
    if (shapeLayers.length === 0) {
      shapeListEl.innerHTML = '<div style="font-size:10px;color:var(--text-dim);padding:2px 10px">None</div>';
    } else {
      shapeListEl.innerHTML = shapeLayers.map(l => `
        <div class="lp-element${currentElement === l.id ? ' selected' : ''}" data-element="${l.id}">
          <span class="lp-icon">${l.shapeType === 'star' ? '★' : '●'}</span>
          <span class="lp-name">${l.name || l.shapeType}</span>
        </div>
      `).join('');
    }
    bindLeftPanelElements(shapeListEl);
  }

  const imageListEl = document.getElementById('imageList');
  if (imageListEl) {
    const imageLayers = cfg.layers.filter(l => l.type === 'image');
    if (imageLayers.length === 0) {
      imageListEl.innerHTML = '<div style="font-size:10px;color:var(--text-dim);padding:2px 10px">None</div>';
    } else {
      imageListEl.innerHTML = imageLayers.map(l => `
        <div class="lp-element${currentElement === l.id ? ' selected' : ''}" data-element="${l.id}">
          <span class="lp-icon">🖼</span>
          <span class="lp-name">${l.name || 'Image'}</span>
        </div>
      `).join('');
    }
    bindLeftPanelElements(imageListEl);
  }
}

function bindLeftPanelElements(container) {
  container.querySelectorAll('.lp-element').forEach(el => {
    if (el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('click', () => selectElement({ type: 'layer', id: el.dataset.element }));
  });
}

function bindLeftPanelStatic() {
  ['outer-ring','inner-ring','center-ring'].forEach(ringId => {
    const el = document.querySelector(`[data-element="${ringId}"]`);
    if (el) el.addEventListener('click', () => selectElement({ type: 'ring', id: ringId }));
  });

  ['arc-top','arc-bottom'].forEach(arcId => {
    const el = document.querySelector(`[data-element="${arcId}"]`);
    if (el) el.addEventListener('click', () => {
      const isBottom = arcId === 'arc-bottom';
      const layer = cfg.layers.find(l => l.mode === 'curved' && l.flip === isBottom);
      if (layer) selectElement({ type: 'layer', id: layer.id });
    });
  });

  const stampSize = document.querySelector('[data-element="stamp-size"]');
  if (stampSize) stampSize.addEventListener('click', () => { selShape=true; selRing='outer'; currentElement=null; updateLeftPanel(); updateFloatingPanel(); render(); });
}

/* ═══ FLOATING CONTROLLER ═══ */
function updateFloatingPanel() {
  const panel = document.getElementById('floatingPanel');
  const body = document.getElementById('fpBody');
  const header = document.getElementById('fpHeader').querySelector('span');
  const l = selLayer();

  if (selShape && selRing) {
    const ringLabel = selRing.charAt(0).toUpperCase() + selRing.slice(1);
    header.textContent = `⚙️ ${ringLabel} Ring`;
    body.innerHTML = buildRingController(selRing);
    bindRingControls(selRing);
    panel.classList.add('open');
    return;
  }

  if (!l) {
    header.textContent = '⚙️ Controller';
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">👆</div><div class="empty-text">Click an element to control it</div></div>';
    panel.classList.remove('open');
    return;
  }

  header.textContent = `⚙️ ${l.name || 'Layer'}`;
  panel.classList.add('open');

  if (l.type === 'shape') {
    body.innerHTML = buildShapeController(l);
    bindLayerControls();
    return;
  }
  if (l.type === 'image') {
    body.innerHTML = buildImageController(l);
    bindLayerControls();
    return;
  }
  body.innerHTML = buildTextController(l);
  bindLayerControls();
}

/* ── Unified Slider Builder ────────────────────────────────────── */
function smoothSlider(key, min, max, step, unit, value) {
  const uid = 's_' + key + '_' + Math.random().toString(36).slice(2, 6);
  return `
    <div class="ctrl-row">
      <span class="ctrl-label">${key}</span>
      <div class="slider-pair">
        <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" id="${uid}" data-ctrl="${key}">
        <input type="number" min="${min}" max="${max}" step="${step}" value="${value}" data-ctrl="${key}">
      </div>
      ${unit ? `<span style="font-size:9px;color:var(--text-dim);min-width:18px">${unit}</span>` : ''}
    </div>
  `;
}

/* ── Ring Controller ───────────────────────────────────────────── */
function buildRingController(ring) {
  const isCenter = ring === 'center';
  const thickness = isCenter ? cfg.innerRing2Thickness : (ring === 'outer' ? cfg.outerRingThickness : cfg.innerRingThickness);
  const thicknessKey = isCenter ? 'innerRing2Thickness' : (ring === 'outer' ? 'outerRingThickness' : 'innerRingThickness');

  return `
    <div class="ctrl-section">
      <div class="ctrl-section-title">Size</div>
      ${smoothSlider(thicknessKey, 0.1, 8, 0.1, 'mm', thickness)}
    </div>
    <div class="ctrl-section">
      <div class="ctrl-section-title">Dimensions</div>
      ${smoothSlider('width', 15, 254, 0.5, 'mm', cfg.width)}
      ${smoothSlider('height', 10, 254, 0.5, 'mm', cfg.height)}
    </div>
    <div class="ctrl-section">
      <div class="ctrl-section-title">Curve</div>
      ${smoothSlider('cornerRadius', 0, 50, 0.5, 'r', cfg.cornerRadius)}
    </div>
    ${cfg.rings >= 2 && !isCenter ? `
    <div class="ctrl-section">
      <div class="ctrl-section-title">Gap</div>
      ${smoothSlider('ringGap', 0, 10, 0.1, 'mm', cfg.ringGap)}
    </div>` : ''}
  `;
}

/* ── Text Controller ───────────────────────────────────────────── */
function buildTextController(l) {
  const weightOpts = (FONT_WEIGHTS[l.font]||[400,700,900]).map(w => {
    const names = {300:'Light',400:'Regular',500:'Medium',600:'Semi Bold',700:'Bold',800:'Extra Bold',900:'Black'};
    return `<option value="${w}"${l.weight===w?' selected':''}>${names[w]||w}</option>`;
  }).join('');

  let html = `
    <div class="ctrl-section">
      <div class="ctrl-section-title">Content</div>
      <div class="ctrl-row"><textarea class="ctrl-textarea" data-ctrl="text" dir="auto">${l.text}</textarea></div>
    </div>
    <div class="ctrl-section">
      <div class="ctrl-section-title">Font</div>
      <div class="ctrl-row" style="gap:4px">
        <select class="ctrl-select" data-ctrl="font">${fontOptHTML(l.font)}</select>
        <select class="ctrl-select" style="max-width:72px" data-ctrl="weight">${weightOpts}</select>
      </div>
      <div class="ctrl-row" style="margin-top:6px">
        <select class="ctrl-select" data-ctrl="mode">
          <option value="curved"${l.mode==='curved'?' selected':''}>Curved</option>
          <option value="straight"${l.mode==='straight'?' selected':''}>Straight</option>
        </select>
      </div>
    </div>
    <div class="ctrl-section">
      <div class="ctrl-section-title">Size</div>
      ${smoothSlider('sizeMm', 1, 18, 0.1, 'mm', l.sizeMm)}
    </div>
  `;

  if (l.mode === 'curved') {
    html += `
    <div class="ctrl-section">
      <div class="ctrl-section-title">Curve / Arc</div>
      ${smoothSlider('radiusMm', 3, 42, 0.1, 'mm', l.radiusMm)}
      ${smoothSlider('startAngle', 0, 360, 1, '°', l.startAngle)}
      ${smoothSlider('endAngle', 0, 360, 1, '°', l.endAngle)}
      <div class="toggle-row">
        <div class="toggle${l.flip?' on':''}" data-ctrl="flip"></div>
        <span class="toggle-label">Flip</span>
      </div>
    </div>`;
  } else {
    html += `
    <div class="ctrl-section">
      <div class="ctrl-section-title">Position</div>
      ${smoothSlider('offsetXmm', -50, 50, 0.1, 'x', l.offsetXmm)}
      ${smoothSlider('offsetYmm', -50, 50, 0.1, 'y', l.offsetYmm)}
    </div>`;
  }

  html += `
    <div class="ctrl-section">
      <div class="ctrl-section-title">Spacing</div>
      ${smoothSlider('letterSpacing', -4, 20, 0.5, 'px', l.letterSpacing)}
      ${smoothSlider('wordSpacing', -4, 30, 0.5, 'px', l.wordSpacing)}
    </div>
    <div class="ctrl-section">
      <div class="ctrl-section-title">Scale</div>
      ${smoothSlider('scaleX', 0.3, 3, 0.05, 'x', l.scaleX)}
      ${smoothSlider('scaleY', 0.3, 3, 0.05, 'x', l.scaleY)}
    </div>
  `;
  return html;
}

/* ── Shape Controller ──────────────────────────────────────────── */
function buildShapeController(l) {
  const shapeOpts = ['star','pentagon','hexagon','diamond','cross','circle'].map(s =>
    `<option value="${s}"${l.shapeType===s?' selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
  ).join('');

  return `
    <div class="ctrl-section">
      <div class="ctrl-section-title">Shape</div>
      <div class="ctrl-row"><select class="ctrl-select" data-ctrl="shapeType">${shapeOpts}</select></div>
    </div>
    <div class="ctrl-section">
      <div class="ctrl-section-title">Size</div>
      ${smoothSlider('shapeSizeMm', 1, 20, 0.5, 'mm', l.shapeSizeMm)}
    </div>
    <div class="ctrl-section">
      <div class="ctrl-section-title">Rotation</div>
      ${smoothSlider('shapeRotation', 0, 360, 1, '°', l.shapeRotation)}
    </div>
    <div class="ctrl-section">
      <div class="ctrl-section-title">Position</div>
      ${smoothSlider('offsetXmm', -30, 30, 0.1, 'x', l.offsetXmm)}
      ${smoothSlider('offsetYmm', -30, 30, 0.1, 'y', l.offsetYmm)}
    </div>
    <div class="ctrl-section">
      <div class="ctrl-section-title">Style</div>
      <div class="toggle-row">
        <div class="toggle${l.shapeFill?' on':''}" data-ctrl="shapeFill"></div>
        <span class="toggle-label">Filled</span>
      </div>
    </div>
  `;
}

/* ── Image Controller ──────────────────────────────────────────── */
function buildImageController(l) {
  return `
    <div class="ctrl-section">
      <div class="ctrl-section-title">Size</div>
      ${smoothSlider('imageWidthMm', 1, 30, 0.5, 'mm', l.imageWidthMm)}
      ${smoothSlider('imageHeightMm', 1, 30, 0.5, 'mm', l.imageHeightMm)}
    </div>
    <div class="ctrl-section">
      <div class="ctrl-section-title">Position</div>
      ${smoothSlider('offsetXmm', -30, 30, 0.1, 'x', l.offsetXmm)}
      ${smoothSlider('offsetYmm', -30, 30, 0.1, 'y', l.offsetYmm)}
    </div>
  `;
}

/* ── Bind Functions ────────────────────────────────────────────── */
function bindRingControls(ring) {
  document.querySelectorAll('[data-ctrl]').forEach(input => {
    if (input.dataset.bound) return;
    input.dataset.bound = '1';
    const key = input.dataset.ctrl;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value)||0;
      cfg[key] = v;
      document.querySelectorAll(`[data-ctrl="${key}"]`).forEach(x => { if(x!==input) x.value = v; });
      renderD();
    });
  });
}

function bindLayerControls() {
  document.querySelectorAll('[data-ctrl]').forEach(input => {
    if (input.dataset.bound) return;
    input.dataset.bound = '1';
    const key = input.dataset.ctrl;
    const isToggle = input.classList.contains('toggle');
    const isRange = input.type === 'range';
    const isNumber = input.type === 'number';

    if (isToggle) {
      input.addEventListener('click', () => {
        input.classList.toggle('on');
        const l = selLayer();
        if (l) { l[key] = input.classList.contains('on'); renderD(); autoHist(); }
      });
      return;
    }

    const ev = (input.tagName === 'SELECT' || input.type === 'checkbox') ? 'change' : 'input';
    input.addEventListener(ev, () => {
      let v = input.value;
      if (isRange || isNumber) v = parseFloat(v)||0;
      const l = selLayer();
      if (l) {
        l[key] = v;
        if (key==='text') l.name = v;
        if (key==='font'||key==='mode') updateFloatingPanel();
      }
      if (isRange||isNumber) document.querySelectorAll(`[data-ctrl="${key}"]`).forEach(x => { if(x!==input) x.value = v; });
      renderD();
      if (!isRange && !isNumber) autoHist();
    });
  });
}

/* ═══ COLOR PALETTE ═══ */
function buildColorPalette() {
  const row = document.getElementById('swatchRow');
  row.innerHTML = SWATCHES.map(c =>
    `<div class="color-swatch" data-color="${c}" style="background:${c}" title="${c}"></div>`
  ).join('');

  row.querySelectorAll('.color-swatch').forEach(s => {
    s.addEventListener('click', () => {
      cfg.inkColor = s.dataset.color;
      row.querySelectorAll('.color-swatch').forEach(x => x.classList.toggle('active', x === s));
      document.getElementById('inkColorPicker').value = cfg.inkColor;
      document.getElementById('inkHex').value = cfg.inkColor;
      renderD();
    });
  });

  const picker = document.getElementById('inkColorPicker');
  const hex = document.getElementById('inkHex');
  picker.addEventListener('input', () => { cfg.inkColor = picker.value; hex.value = picker.value; renderD(); });
  hex.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) { cfg.inkColor = hex.value; picker.value = hex.value; renderD(); }
  });

  row.querySelectorAll('.color-swatch').forEach(s => {
    if (s.dataset.color.toLowerCase() === cfg.inkColor.toLowerCase()) s.classList.add('active');
  });
}

/* ── Template Cards ────────────────────────────────────────────── */
function updateTemplateCards() {
  const container = document.getElementById('templateOptions');
  container.innerHTML = Object.entries(TEMPLATES).map(([key, t]) => `
    <div class="tpl-card${cfg.template === key ? ' active' : ''}" data-template="${key}">
      <span class="tpl-icon">${t.icon}</span><span class="tpl-name">${t.label}</span>
    </div>
  `).join('');

  container.querySelectorAll('.tpl-card').forEach(card => {
    card.addEventListener('click', () => applyTemplate(card.dataset.template));
  });
}

function applyTemplate(name) {
  if (!TEMPLATES[name]) return;
  const styleKeys = ['inkColor','opacity','inkBleed','inkBleedAmount','grungeTexture','grungeAmount','rotationJitter','jitterDegrees'];
  const saved = {};
  styleKeys.forEach(k => { saved[k] = cfg[k]; });
  cfg = Object.assign(buildConfig(name), saved);
  DPI_CURRENT = cfg.dpi || 300;
  selId = cfg.layers[0].id; selectedIds = new Set([selId]); selShape = false; selRing = null;
  currentElement = null;
  updateLeftPanel(); updateFloatingPanel(); updateTemplateCards(); render(); pushHistory();
  showToast(TEMPLATES[name].label + ' applied');
}

/* ═══ EXPORT ═══ */
function download(url, filename, revoke) {
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportPNG(whiteBg = false) {
  exporting = true; render();
  let src = canvas;
  if (whiteBg) {
    const o = document.createElement('canvas');
    o.width = canvas.width; o.height = canvas.height;
    const oc = o.getContext('2d');
    oc.fillStyle = '#fff'; oc.fillRect(0, 0, o.width, o.height);
    oc.drawImage(canvas, 0, 0); src = o;
  }
  download(src.toDataURL('image/png'), whiteBg ? 'stamp-white.png' : 'stamp-transparent.png');
  showToast(whiteBg ? 'PNG (white)' : 'PNG (transparent)');
  exporting = false; render();
}

function escXml(s) { return String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])); }

function exportSVG() {
  const sz = stampSize(), pad = cfg.paddingMm;
  const vwMm = sz.w+pad*2, vhMm = sz.h+pad*2;
  const wPx = Math.round(mmPx(vwMm)), hPx = Math.round(mmPx(vhMm));
  const stampW = mmPx(sz.w), stampH = mmPx(sz.h);
  const cx = wPx/2, cy = hPx/2;
  const scx = cx+mmPx(cfg.shapeOffsetXmm||0), scy = cy+mmPx(cfg.shapeOffsetYmm||0);
  const rx = stampW/2, ry = stampH/2;
  const color = cfg.inkColor;
  const op = clamp(cfg.opacity/100, 0, 1).toFixed(3);
  const insetPx = mmPx(cfg.outerRingThickness+cfg.ringGap);
  const cr = mmPx(cfg.cornerRadius).toFixed(2);
  let shapes = '', defs = '', texts = '';

  if (cfg.shape === 'rectangle') {
    const o = mmPx(cfg.outerRingThickness);
    shapes += `<rect x="${(scx-rx+o/2).toFixed(2)}" y="${(scy-ry+o/2).toFixed(2)}" width="${(stampW-o).toFixed(2)}" height="${(stampH-o).toFixed(2)}" rx="${cr}" fill="none" stroke="${color}" stroke-width="${o.toFixed(2)}" opacity="${op}"/>`;
    if (cfg.rings >= 2 && cfg.innerRingThickness > 0) {
      const inset = mmPx(cfg.outerRingThickness+cfg.ringGap), il = mmPx(cfg.innerRingThickness);
      const iw = stampW-inset*2-il, ih = stampH-inset*2-il;
      if (iw>0&&ih>0) shapes += `<rect x="${(scx-rx+inset+il/2).toFixed(2)}" y="${(scy-ry+inset+il/2).toFixed(2)}" width="${iw.toFixed(2)}" height="${ih.toFixed(2)}" rx="${cr}" fill="none" stroke="${color}" stroke-width="${il.toFixed(2)}" opacity="${op}"/>`;
    }
  } else {
    const o = mmPx(cfg.outerRingThickness);
    shapes += `<ellipse cx="${scx}" cy="${scy}" rx="${(rx-o/2).toFixed(2)}" ry="${(ry-o/2).toFixed(2)}" fill="none" stroke="${color}" stroke-width="${o.toFixed(2)}" opacity="${op}"/>`;
    if (cfg.rings >= 2 && cfg.innerRingThickness > 0) {
      const il = mmPx(cfg.innerRingThickness);
      shapes += `<ellipse cx="${scx}" cy="${scy}" rx="${(rx-insetPx-il/2).toFixed(2)}" ry="${(ry-insetPx-il/2).toFixed(2)}" fill="none" stroke="${color}" stroke-width="${il.toFixed(2)}" opacity="${op}"/>`;
    }
    if (cfg.rings >= 3 && cfg.innerRing2Thickness > 0) {
      const inset2 = mmPx(cfg.outerRingThickness+cfg.ringGap+cfg.innerRingThickness+cfg.ringGap);
      const il2 = mmPx(cfg.innerRing2Thickness);
      shapes += `<ellipse cx="${scx}" cy="${scy}" rx="${(rx-inset2).toFixed(2)}" ry="${(ry-inset2).toFixed(2)}" fill="none" stroke="${color}" stroke-width="${il2.toFixed(2)}" opacity="${op}"/>`;
    }
  }

  cfg.layers.forEach((l,i) => {
    if (!l.visible || !l.text.trim()) return;
    const fs = mmPx(l.sizeMm).toFixed(2);
    const dir = layerDir(l);
    const common = `font-family="${l.font}" font-size="${fs}" font-weight="${safeWeight(l.font,l.weight)}" fill="${color}" opacity="${op}" letter-spacing="${l.letterSpacing}" direction="${dir}"`;
    if (l.mode === 'curved') {
      const pid = 'tp'+i;
      let svgRx = mmPx(l.radiusMm), svgRy;
      if (cfg.shape==='oval') { const ss=stampSize(); svgRy=mmPx(Math.max(2,ss.h/2-(ss.w/2-l.radiusMm))); } else svgRy=svgRx;
      const sAng=l.startAngle*DEG, span=((l.endAngle-l.startAngle+360)%360)||1;
      const eAng=(l.startAngle+span)*DEG;
      const sweep=l.flip?0:1;
      const s=l.flip?{x:cx+Math.cos(eAng)*svgRx,y:cy+Math.sin(eAng)*svgRy}:{x:cx+Math.cos(sAng)*svgRx,y:cy+Math.sin(sAng)*svgRy};
      const e=l.flip?{x:cx+Math.cos(sAng)*svgRx,y:cy+Math.sin(sAng)*svgRy}:{x:cx+Math.cos(eAng)*svgRx,y:cy+Math.sin(eAng)*svgRy};
      const large=span>180?1:0;
      defs += `<path id="${pid}" d="M${s.x.toFixed(2)},${s.y.toFixed(2)} A${svgRx.toFixed(2)},${svgRy.toFixed(2)},0,${large},${sweep},${e.x.toFixed(2)},${e.y.toFixed(2)}" fill="none"/>`;
      texts += `<text ${common}><textPath href="#${pid}" startOffset="50%" text-anchor="middle">${escXml(l.text)}</textPath></text>`;
    } else {
      const tx=(cx+mmPx(l.offsetXmm)).toFixed(2), ty=(cy+mmPx(l.offsetYmm)).toFixed(2);
      texts += `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle" ${common}>${escXml(l.text)}</text>`;
    }
  });

  const svgStr = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${vwMm.toFixed(2)}mm" height="${vhMm.toFixed(2)}mm" viewBox="0 0 ${wPx} ${hPx}">
<defs>${defs}</defs>
${shapes}
${texts}
</svg>`;
  download(URL.createObjectURL(new Blob([svgStr],{type:'image/svg+xml'})), 'stamp-vector.svg', true);
  showToast('SVG exported');
}

/* ═══ SYNC + INIT ═══ */
function syncAll() { DPI_CURRENT = cfg.dpi || 300; updateLeftPanel(); updateFloatingPanel(); updateTemplateCards(); }

function init() {
  const loaded = loadState();

  buildColorPalette();
  updateTemplateCards();
  bindLeftPanelStatic();
  bindPointerEvents();
  bindTitleAndPresets();
  initSidebarToggle();
  initFloatingPanel();
  initZoomPan();

  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);
  document.getElementById('saveBtn').addEventListener('click', () => { saveState(); showToast('Project saved'); });
  document.getElementById('exportBtn').addEventListener('click', () => exportPNG(false));
  document.getElementById('resetBtn').addEventListener('click', () => {
    cfg = buildConfig('oval'); cfg.seed = Math.floor(Math.random()*1e6);
    DPI_CURRENT = cfg.dpi || 300;
    selId = cfg.layers[0].id; selectedIds = new Set([selId]); selShape=false; selRing=null; currentElement=null;
    Object.keys(imageCache).forEach(k => delete imageCache[k]);
    syncAll(); render(); pushHistory(); showToast('Reset to defaults');
  });

  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const maxMm=12; let w=maxMm,h=maxMm;
        if(img.width>img.height) h=maxMm*(img.height/img.width); else w=maxMm*(img.width/img.height);
        const l = makeLayer({type:'image',name:'Image',imageData:ev.target.result,imageWidthMm:Math.round(w*10)/10,imageHeightMm:Math.round(h*10)/10});
        cfg.layers.push(l); selId=l.id; selectedIds=new Set([selId]);
        autoHist(); updateLeftPanel(); updateFloatingPanel(); render(); showToast('Image imported');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file); e.target.value='';
  });

  window.addEventListener('resize', () => { updateCanvasCSS(); });

  if (loaded) { syncAll(); render(); pushHistory(); }
  else { syncAll(); render(); }
  document.fonts.ready.then(() => render());
}

/* ── Title + Presets ───────────────────────────────────────────── */
function bindTitleAndPresets() {
  const nameInput = document.getElementById('docNameInput');
  const savePresetBtn = document.getElementById('savePresetBtn');
  const loadPresetBtn = document.getElementById('loadPresetBtn');
  const modal = document.getElementById('presetModal');
  const modalTitle = document.getElementById('presetModalTitle');
  const modalBody = document.getElementById('presetModalBody');
  const modalClose = document.getElementById('presetModalClose');

  const savedTitle = localStorage.getItem('stampstudio_title');
  if (savedTitle) nameInput.value = savedTitle;

  nameInput.addEventListener('input', () => {
    localStorage.setItem('stampstudio_title', nameInput.value);
  });

  modalClose.addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });

  savePresetBtn.addEventListener('click', () => {
    modalTitle.textContent = 'Save Preset';
    modalBody.innerHTML = `
      <input type="text" class="preset-input" id="presetNameInput" placeholder="Preset name..." maxlength="30">
      <div class="modal-actions">
        <button class="modal-btn primary" id="confirmSavePreset">Save</button>
        <button class="modal-btn secondary" id="cancelPreset">Cancel</button>
      </div>
    `;
    modal.classList.add('show');
    setTimeout(() => document.getElementById('presetNameInput').focus(), 100);

    document.getElementById('cancelPreset').addEventListener('click', () => modal.classList.remove('show'));
    document.getElementById('confirmSavePreset').addEventListener('click', () => {
      const name = document.getElementById('presetNameInput').value.trim();
      if (!name) { showToast('Enter a name'); return; }
      savePreset(name);
      modal.classList.remove('show');
    });
  });

  loadPresetBtn.addEventListener('click', () => {
    const presets = loadPresetsList();
    modalTitle.textContent = 'Load Preset';
    if (presets.length === 0) {
      modalBody.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-dim);font-size:11px">No presets saved yet</div>';
    } else {
      modalBody.innerHTML = `
        <div class="preset-list">
          ${presets.map((p, i) => `
            <div class="preset-item" data-idx="${i}">
              <span class="preset-name">${p.name}</span>
              <span class="preset-date">${new Date(p.date).toLocaleDateString()}</span>
              <span class="preset-del" data-del="${i}" title="Delete">✕</span>
            </div>
          `).join('')}
        </div>
      `;
      modalBody.querySelectorAll('.preset-item').forEach(item => {
        item.addEventListener('click', e => {
          if (e.target.classList.contains('preset-del')) {
            e.stopPropagation();
            deletePreset(parseInt(e.target.dataset.del));
            loadPresetBtn.click();
            return;
          }
          loadPreset(parseInt(item.dataset.idx));
          modal.classList.remove('show');
        });
      });
    }
    modal.classList.add('show');
  });
}

const PRESETS_KEY = 'stampstudio_presets';

function loadPresetsList() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; }
  catch { return []; }
}

function savePreset(name) {
  const presets = loadPresetsList();
  presets.push({ name, config: JSON.parse(JSON.stringify(cfg)), date: Date.now() });
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  showToast('Preset saved: ' + name);
}

function loadPreset(index) {
  const presets = loadPresetsList();
  if (!presets[index]) return;
  cfg = JSON.parse(JSON.stringify(presets[index].config));
  cfg.seed = cfg.seed || Math.floor(Math.random() * 1e6);
  DPI_CURRENT = cfg.dpi || 300;
  selId = cfg.layers[0]?.id || null;
  selectedIds = new Set([selId].filter(Boolean));
  selShape = false; selRing = null; currentElement = null;
  syncAll(); render(); pushHistory();
  showToast('Loaded: ' + presets[index].name);
}

function deletePreset(index) {
  const presets = loadPresetsList();
  const name = presets[index]?.name || '?';
  presets.splice(index, 1);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  showToast('Deleted: ' + name);
}

init();

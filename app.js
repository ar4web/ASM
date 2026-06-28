"use strict";
/* ================================================================
   Stamp Studio — Minimal · 5x5" Canvas · Left-aligned · Smooth
   ================================================================ */

const CSS_DPI = 96, DEG = Math.PI / 180;
let DPI_CURRENT = 300;
const mmPx = mm => mm * (DPI_CURRENT / 25.4);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = () => 'L' + Math.random().toString(36).slice(2, 8);
const lerp = (a, b, t) => a + (b - a) * t;

/* ── Performance ──────────────────────────────────────────────── */
const textStripCache = new Map();
let canvasInitialized = false;
let renderQueued = false;

/* ── Undo / Redo ──────────────────────────────────────────────── */
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

/* ── RTL ──────────────────────────────────────────────────────── */
const RTL_RE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
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

/* ── Storage ──────────────────────────────────────────────────── */
const STORAGE_KEY = 'stampstudio_v5';
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

/* ── Toast ────────────────────────────────────────────────────── */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 1500);
}

/* ── Fonts ────────────────────────────────────────────────────── */
const FONTS = [
  { group: 'Arabic', items: ['Cairo','Tajawal','Noto Sans Arabic'] },
  { group: 'Formal', items: ['Amiri','Noto Naskh Arabic'] },
  { group: 'Latin', items: ['Inter','Montserrat','Poppins'] },
];
const FONT_WEIGHTS = {
  'Cairo': [400,600,700,800], 'Tajawal': [400,500,700],
  'Noto Sans Arabic': [400,500,600,700], 'Amiri': [400,700],
  'Noto Naskh Arabic': [400,600,700], 'Inter': [300,400,500,600,700],
  'Montserrat': [600,700,800,900], 'Poppins': [500,600,700],
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

/* ── State Model ──────────────────────────────────────────────── */
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
    makeLayer({ name: 'Top Arabic', text: 'شركة بصمة الموارد', font: 'Cairo', dir: 'rtl', weight: 800, sizeMm: 4.5, mode: 'curved', radiusMm: 16, startAngle: 200, endAngle: 340 }),
    makeLayer({ name: 'Bottom', text: 'STAMP CO.', font: 'Inter', dir: 'ltr', weight: 700, sizeMm: 3.8, mode: 'curved', flip: true, radiusMm: 15.8, startAngle: 145, endAngle: 35 }),
    makeLayer({ name: 'Number', text: '1234567890', font: 'Inter', weight: 900, sizeMm: 3.2, mode: 'straight', offsetYmm: 0 }),
  ];
}

function baseStyle() {
  return { inkColor: '#1e3a8a', opacity: 100, inkBleed: true, inkBleedAmount: 0.5, rotationJitter: true, jitterDegrees: 0.9, paddingMm: 5, seed: 73219, dpi: 300 };
}

/* ── Templates ────────────────────────────────────────────────── */
const TEMPLATES = {
  oval:       { label: 'Oval',    icon: '⬮', shape: 'oval',      width: 62, height: 36, outerRingThickness: 1.8, innerRingThickness: 0.8, ringGap: 2.0, cornerRadius: 4, rings: 2 },
  circle:     { label: 'Circle',  icon: '●', shape: 'circle',    outerDiameter: 46, outerRingThickness: 2.0, innerRingThickness: 1.1, ringGap: 1.6, cornerRadius: 4, rings: 2 },
  tripleRing: { label: 'Triple',  icon: '◉', shape: 'circle',    outerDiameter: 50, outerRingThickness: 2.2, innerRingThickness: 0.9, innerRing2Thickness: 0.6, ringGap: 1.3, cornerRadius: 4, rings: 3 },
  rectangle:  { label: 'Rect',    icon: '▭', shape: 'rectangle', width: 72, height: 34, outerRingThickness: 1.4, innerRingThickness: 0.6, ringGap: 2.0, cornerRadius: 4, rings: 2 },
  square:     { label: 'Square',  icon: '■', shape: 'rectangle', width: 44, height: 44, outerRingThickness: 1.6, innerRingThickness: 0, ringGap: 0, cornerRadius: 8, rings: 1 },
  minimal:    { label: 'Minimal', icon: '○', shape: 'circle',    outerDiameter: 38, outerRingThickness: 1.1, innerRingThickness: 0, ringGap: 0, cornerRadius: 3, rings: 1 },
};

function templateLayers(name) {
  if (name === 'rectangle') return [
    makeLayer({ name: 'Title', text: 'COMPANY NAME', font: 'Montserrat', weight: 900, sizeMm: 4, letterSpacing: 1.5, mode: 'straight', offsetYmm: -7 }),
    makeLayer({ name: 'City', text: 'City · Country', font: 'Montserrat', sizeMm: 3, mode: 'straight', offsetYmm: 0 }),
  ];
  if (name === 'square') return [
    makeLayer({ name: 'Title', text: 'APPROVED', font: 'Montserrat', weight: 900, sizeMm: 4.5, mode: 'straight', offsetYmm: -3 }),
    makeLayer({ name: 'Arabic', text: 'موافق', font: 'Cairo', dir: 'rtl', sizeMm: 3.5, mode: 'straight', offsetYmm: 5 }),
  ];
  if (name === 'minimal') return [
    makeLayer({ name: 'Company', text: 'COMPANY', font: 'Montserrat', weight: 800, sizeMm: 3.2, letterSpacing: 2, mode: 'curved', radiusMm: 14, startAngle: 210, endAngle: 330 }),
  ];
  const ls = defaultLayers();
  if (name === 'oval') { ls[0].radiusMm = 28; ls[1].radiusMm = 27.5; }
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
    ringGap: t.ringGap, cornerRadius: t.cornerRadius, rings: t.rings,
    shapeOffsetXmm: 0, shapeOffsetYmm: 0,
    layers: templateLayers(name),
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

/* ── Canvas & Zoom ─────────────────────────────────────────────── */
const canvas = document.getElementById('stampCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
const viewport = document.getElementById('viewport');
const zoomLabel = document.getElementById('zoomLabel');

let targetZoom = 1, currentZoom = 1;
let targetPan = { x: 0, y: 0 }, currentPan = { x: 0, y: 0 };

function setupCanvas() {
  if (canvasInitialized) { updateCanvasCSS(); return; }
  // 5x5 inches at 300 DPI = 1500x1500px
  canvas.width = 5 * 300;
  canvas.height = 5 * 300;
  canvasInitialized = true;
  updateCanvasCSS();
}

function updateCanvasCSS() {
  const vpW = viewport.clientWidth - 60;
  const vpH = viewport.clientHeight - 40;
  const baseSize = Math.min(vpW, vpH, 500);
  const size = baseSize * currentZoom;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  canvas.style.transform = `translate(${currentPan.x}px, ${currentPan.y}px)`;
  zoomLabel.textContent = Math.round(currentZoom * 100) + '%';
}

function animateTransform() {
  let frame;
  function step() {
    currentZoom = lerp(currentZoom, targetZoom, 0.15);
    currentPan.x = lerp(currentPan.x, targetPan.x, 0.15);
    currentPan.y = lerp(currentPan.y, targetPan.y, 0.15);
    updateCanvasCSS();
    if (Math.abs(currentZoom - targetZoom) > 0.002 || Math.abs(currentPan.x - targetPan.x) > 1 || Math.abs(currentPan.y - targetPan.y) > 1) {
      frame = requestAnimationFrame(step);
    }
  }
  cancelAnimationFrame(frame);
  step();
}

function initZoomPan() {
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    targetZoom = clamp(targetZoom + (e.deltaY > 0 ? -0.1 : 0.1), 0.3, 5);
    animateTransform();
  }, { passive: false });

  let isPanning = false, panStart = { x: 0, y: 0 };
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
  document.addEventListener('mouseup', () => { isPanning = false; viewport.style.cursor = ''; });
  viewport.addEventListener('dblclick', () => { targetZoom = 1; targetPan = { x: 0, y: 0 }; animateTransform(); });
}

// Zoom buttons
function zoomIn() { targetZoom = clamp(targetZoom + 0.2, 0.3, 5); animateTransform(); }
function zoomOut() { targetZoom = clamp(targetZoom - 0.2, 0.3, 5); animateTransform(); }
function recenter() { targetZoom = 1; targetPan = { x: 0, y: 0 }; animateTransform(); }

/* ═══ DRAWING ═══ */
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
}

function textEllipseMm(layer) {
  const sz = stampSize();
  const r = layer.radiusMm;
  if (cfg.shape === 'oval' && sz.w > 0) return { rx: r, ry: Math.max(0.5, r * (sz.h / sz.w)) };
  return { rx: r, ry: r };
}

function buildTextStrip(layer, color) {
  const key = layer.id + "_" + layer.text + "_" + layer.font + "_" + layer.weight + "_" + layer.sizeMm + "_" + layer.letterSpacing + "_" + layer.wordSpacing + "_" + layer.scaleX + "_" + layer.scaleY + "_" + layer.dir + "_" + color;
  if (textStripCache.has(key)) return textStripCache.get(key);
  const fontPx = mmPx(layer.sizeMm);
  const fontStr = safeWeight(layer.font, layer.weight) + " " + fontPx + 'px "' + layer.font + '"';
  const dir = layerDir(layer);
  const sx = layer.scaleX || 1, sy = layer.scaleY || 1;
  const m = document.createElement("canvas").getContext("2d");
  m.font = fontStr;
  if ("letterSpacing" in m) m.letterSpacing = layer.letterSpacing + "px";
  const measured = m.measureText(layer.text);
  const textW = Math.max(2, Math.ceil(measured.width * sx));
  const pad = fontPx * 0.3;
  const sw = textW + pad*2, sh = Math.max(2, Math.ceil(fontPx * 2.2 * sy));
  const strip = document.createElement("canvas");
  strip.width = sw; strip.height = sh;
  const sc = strip.getContext("2d");
  sc.font = fontStr;
  if ("letterSpacing" in sc) sc.letterSpacing = layer.letterSpacing + "px";
  sc.fillStyle = color; sc.textAlign = "center"; sc.textBaseline = "middle";
  sc.direction = dir;
  sc.translate(sw/2, sh/2); sc.scale(sx, sy); sc.fillText(layer.text, 0, 0);
  const result = { canvas: strip, textWidth: textW, pad: pad };
  textStripCache.set(key, result);
  return result;
}

function bleedWrap(drawFn, rng) {
  if (!cfg.inkBleed || cfg.inkBleedAmount <= 0) { drawFn(); return; }
  const blurPx = mmPx(cfg.inkBleedAmount) * 0.20;
  ctx.save(); ctx.globalAlpha *= 0.16; ctx.filter = "blur(" + blurPx + "px)";
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
    const fontStr = safeWeight(layer.font, layer.weight) + " " + fontPx + 'px "' + layer.font + '"';
    if ("letterSpacing" in ctx) ctx.letterSpacing = layer.letterSpacing + "px";
    ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.direction = layerDir(layer);
    const sx = layer.scaleX||1, sy = layer.scaleY||1;
    ctx.translate(tx, ty); ctx.scale(sx, sy); ctx.fillText(layer.text, 0, 0);
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
    if (layer.shapeType === "star") {
      const inner = size * 0.4;
      for (let i = 0; i < pts*2; i++) { const r = i%2===0 ? size : inner; const a = (i*Math.PI)/pts - Math.PI/2;
        if (i===0) ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); else ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); }
      ctx.closePath();
    } else if (layer.shapeType === "circle") { ctx.arc(0, 0, size, 0, Math.PI*2); }
    else if (layer.shapeType === "diamond") { ctx.moveTo(0,-size); ctx.lineTo(size*0.6,0); ctx.lineTo(0,size); ctx.lineTo(-size*0.6,0); ctx.closePath(); }
    if (fill) { ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, mmPx(0.5)); ctx.stroke(); }
    ctx.restore();
  };
  bleedWrap(draw, rng);
}

const imageCache = {};
function drawImageLayer(layer, cx, cy) {
  if (!layer.imageData) return;
  let img = imageCache[layer.id];
  if (!img) { img = new Image(); img.onload = () => { imageCache[layer.id] = img; render(); }; img.src = layer.imageData; return; }
  const w = mmPx(layer.imageWidthMm), h = mmPx(layer.imageHeightMm);
  ctx.save(); ctx.translate(cx + mmPx(layer.offsetXmm), cy + mmPx(layer.offsetYmm));
  ctx.drawImage(img, -w/2, -h/2, w, h); ctx.restore();
}

/* ═══ RENDER ═══ */
function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; _render(); });
}

function _render() {
  setupCanvas();
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
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
    if (layer.type === "text" && layer.mode === "curved") drawCurvedLayer(layer, cx, cy, color, rng);
    else if (layer.type === "text" && layer.mode === "straight") drawStraightLayer(layer, cx, cy, color, rng);
    else if (layer.type === "shape") drawShapeLayer(layer, cx, cy, color, rng);
    else if (layer.type === "image") drawImageLayer(layer, cx, cy);
  });
}

const renderD = debounce(render, 16);

/* ═══ POINTER ═══ */
function bindPointerEvents() {
  canvas.addEventListener("mousedown", e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX, my = (e.clientY - rect.top) * scaleY;
    const stampW = mmPx(stampSize().w), stampH = mmPx(stampSize().h);
    const cx = canvas.width/2 + mmPx(cfg.shapeOffsetXmm || 0);
    const cy = canvas.height/2 + mmPx(cfg.shapeOffsetYmm || 0);
    const dx = (mx - cx) / (stampW/2), dy = (my - cy) / (stampH/2);
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 0.7 && dist < 1.15) {
      if (dist > 0.85) selectElement({ type: "ring", id: "outer-ring" });
      else if (cfg.rings >= 2) selectElement({ type: "ring", id: "inner-ring" });
      return;
    }
    let found = false;
    cfg.layers.forEach(layer => {
      const lcx = cx + mmPx(layer.offsetXmm), lcy = cy + mmPx(layer.offsetYmm);
      const d = Math.hypot(mx - lcx, my - lcy);
      if (d < mmPx(layer.sizeMm || layer.shapeSizeMm || 4) * 2.5) { selectElement({ type: "layer", id: layer.id }); found = true; }
    });
    if (!found) selectElement(null);
  });
}

/* ═══ SELECTION ═══ */
function selectElement(el) {
  if (!el) { currentElement = null; selShape = false; selRing = null; selId = null; selectedIds.clear(); }
  else if (el.type === "ring") { currentElement = el.id; selRing = el.id.replace("-ring",""); selShape = true; selId = null; selectedIds.clear(); }
  else if (el.type === "layer") { selId = el.id; selectedIds = new Set([el.id]); currentElement = el.id; selShape = false; selRing = null; }
  updateLeftPanel();
  updateFloatingPanel();
  render();
}

/* ═══ LEFT PANEL ═══ */
function updateLeftPanel() {
  // Templates
  const tplList = document.getElementById("templateList");
  if (tplList) {
    tplList.innerHTML = Object.entries(TEMPLATES).map(([key, t]) =>
      `<div class="tpl-card${cfg.template === key ? " active" : ""}" data-tpl="${key}">
        <span class="tpl-icon">${t.icon}</span><span class="tpl-name">${t.label}</span>
      </div>`
    ).join("");
    tplList.querySelectorAll(".tpl-card").forEach(c => c.addEventListener("click", () => applyTemplate(c.dataset.tpl)));
  }

  // Elements
  const elList = document.getElementById("elementList");
  if (elList) {
    let html = "";
    html += `<div class="lp-element${currentElement === "outer-ring" ? " selected" : ""}" data-el="outer-ring">
      <span class="lp-icon">◯</span><span class="lp-name">Outer Ring</span></div>`;
    if (cfg.rings >= 2) html += `<div class="lp-element${currentElement === "inner-ring" ? " selected" : ""}" data-el="inner-ring">
      <span class="lp-icon">◯</span><span class="lp-name">Inner Ring</span></div>`;
    cfg.layers.forEach(l => {
      html += `<div class="lp-element${currentElement === l.id ? " selected" : ""}" data-el="${l.id}">
        <span class="lp-icon">${l.type === "shape" ? "★" : "T"}</span>
        <span class="lp-name">${l.name || l.text}</span></div>`;
    });
    elList.innerHTML = html;
    elList.querySelectorAll(".lp-element").forEach(el => el.addEventListener("click", () => {
      const id = el.dataset.el;
      if (id === "outer-ring" || id === "inner-ring") selectElement({ type: "ring", id: id });
      else selectElement({ type: "layer", id: id });
    }));
  }

  // Presets
  const pList = document.getElementById("presetList");
  if (pList) {
    const presets = loadPresetsList();
    pList.innerHTML = presets.length === 0 ? "<div style=\"font-size:9px;color:var(--text-dim);padding:4px 8px\">No presets</div>" :
      presets.map((p, i) => `<div class="lp-element" data-preset="${i}">
        <span class="lp-icon">📄</span><span class="lp-name">${p.name}</span></div>`).join("");
    pList.querySelectorAll("[data-preset]").forEach(el => el.addEventListener("click", () => {
      loadPreset(parseInt(el.dataset.preset));
    }));
  }
}

/* ═══ FLOATING CONTROLLER ═══ */
function updateFloatingPanel() {
  const panel = document.getElementById("floatingPanel");
  const body = document.getElementById("fpBody");
  const header = document.getElementById("fpHeader").querySelector("span");
  const l = selLayer();

  if (selShape && selRing) {
    header.textContent = "⚙️ " + selRing.charAt(0).toUpperCase() + selRing.slice(1) + " Ring";
    body.innerHTML = buildRingController(selRing);
    bindRingControls(selRing);
    panel.classList.add("open");
    return;
  }
  if (!l) {
    header.textContent = "⚙️ Controller";
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">👆</div><div class="empty-text">Click an element to control it</div></div>';
    panel.classList.remove("open");
    return;
  }
  header.textContent = "⚙️ " + (l.name || "Layer");
  panel.classList.add("open");
  if (l.type === "shape") { body.innerHTML = buildShapeController(l); bindLayerControls(); return; }
  if (l.type === "image") { body.innerHTML = buildImageController(l); bindLayerControls(); return; }
  body.innerHTML = buildTextController(l);
  bindLayerControls();
}

function smoothSlider(key, min, max, step, unit, value) {
  return `<div class="ctrl-row">
    <span class="ctrl-label">${key}</span>
    <div class="slider-pair">
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-ctrl="${key}">
      <input type="number" min="${min}" max="${max}" step="${step}" value="${value}" data-ctrl="${key}">
    </div>
    ${unit ? '<span style="font-size:9px;color:var(--text-dim)">' + unit + "</span>" : ""}
  </div>`;
}

function buildRingController(ring) {
  const isCenter = ring === "center";
  const thickness = isCenter ? cfg.innerRing2Thickness : (ring === "outer" ? cfg.outerRingThickness : cfg.innerRingThickness);
  const tk = isCenter ? "innerRing2Thickness" : (ring === "outer" ? "outerRingThickness" : "innerRingThickness");
  let html = '<div class="ctrl-section"><div class="ctrl-section-title">Size</div>';
  html += smoothSlider(tk, 0.1, 8, 0.1, "mm", thickness);
  html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Dimensions</div>';
  html += smoothSlider("width", 15, 120, 0.5, "mm", cfg.width);
  html += smoothSlider("height", 10, 100, 0.5, "mm", cfg.height);
  html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Curve</div>';
  html += smoothSlider("cornerRadius", 0, 30, 0.5, "r", cfg.cornerRadius);
  if (cfg.rings >= 2 && !isCenter) {
    html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Gap</div>';
    html += smoothSlider("ringGap", 0, 10, 0.1, "mm", cfg.ringGap);
  }
  html += "</div>";
  return html;
}

function buildTextController(l) {
  const weightOpts = (FONT_WEIGHTS[l.font]||[400,700]).map(w => {
    const names = {300:"Light",400:"Regular",500:"Medium",600:"Semi",700:"Bold",800:"Extra",900:"Black"};
    return '<option value="' + w + '"' + (l.weight===w?" selected":"") + ">" + (names[w]||w) + "</option>";
  }).join("");
  let html = '<div class="ctrl-section"><div class="ctrl-section-title">Text</div>';
  html += '<div class="ctrl-row"><textarea class="ctrl-textarea" data-ctrl="text" dir="auto">' + l.text + "</textarea></div>";
  html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Font</div><div class="ctrl-row" style="gap:4px">';
  html += '<select class="ctrl-select" data-ctrl="font">' + fontOptHTML(l.font) + "</select>";
  html += '<select class="ctrl-select" style="max-width:65px" data-ctrl="weight">' + weightOpts + "</select>";
  html += '</div></div><div class="ctrl-section"><div class="ctrl-section-title">Size</div>';
  html += smoothSlider("sizeMm", 1, 18, 0.1, "mm", l.sizeMm);
  if (l.mode === "curved") {
    html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Curve</div>';
    html += smoothSlider("radiusMm", 3, 42, 0.1, "mm", l.radiusMm);
    html += smoothSlider("startAngle", 0, 360, 1, "°", l.startAngle);
    html += smoothSlider("endAngle", 0, 360, 1, "°", l.endAngle);
    html += '<div class="toggle-row"><div class="toggle' + (l.flip?" on":"") + '" data-ctrl="flip"></div><span class="toggle-label">Flip</span></div>';
  } else {
    html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Position</div>';
    html += smoothSlider("offsetXmm", -50, 50, 0.1, "x", l.offsetXmm);
    html += smoothSlider("offsetYmm", -50, 50, 0.1, "y", l.offsetYmm);
  }
  html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Spacing</div>';
  html += smoothSlider("letterSpacing", -4, 20, 0.5, "px", l.letterSpacing);
  html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Scale</div>';
  html += smoothSlider("scaleX", 0.3, 3, 0.05, "x", l.scaleX);
  html += smoothSlider("scaleY", 0.3, 3, 0.05, "x", l.scaleY);
  html += "</div>";
  return html;
}

function buildShapeController(l) {
  const opts = ["star","circle","diamond"].map(s => '<option value="' + s + '"' + (l.shapeType===s?" selected":"") + ">" + s.charAt(0).toUpperCase()+s.slice(1) + "</option>").join("");
  let html = '<div class="ctrl-section"><div class="ctrl-section-title">Shape</div><div class="ctrl-row"><select class="ctrl-select" data-ctrl="shapeType">' + opts + "</select></div>";
  html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Size</div>';
  html += smoothSlider("shapeSizeMm", 1, 20, 0.5, "mm", l.shapeSizeMm);
  html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Rotation</div>';
  html += smoothSlider("shapeRotation", 0, 360, 1, "°", l.shapeRotation);
  html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Position</div>';
  html += smoothSlider("offsetXmm", -30, 30, 0.1, "x", l.offsetXmm);
  html += smoothSlider("offsetYmm", -30, 30, 0.1, "y", l.offsetYmm);
  html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Style</div>';
  html += '<div class="toggle-row"><div class="toggle' + (l.shapeFill?" on":"") + '" data-ctrl="shapeFill"></div><span class="toggle-label">Filled</span></div>';
  html += "</div>";
  return html;
}

function buildImageController(l) {
  let html = '<div class="ctrl-section"><div class="ctrl-section-title">Size</div>';
  html += smoothSlider("imageWidthMm", 1, 30, 0.5, "mm", l.imageWidthMm);
  html += smoothSlider("imageHeightMm", 1, 30, 0.5, "mm", l.imageHeightMm);
  html += '</div><div class="ctrl-section"><div class="ctrl-section-title">Position</div>';
  html += smoothSlider("offsetXmm", -30, 30, 0.1, "x", l.offsetXmm);
  html += smoothSlider("offsetYmm", -30, 30, 0.1, "y", l.offsetYmm);
  html += "</div>";
  return html;
}

/* ═══ BIND CONTROLS ═══ */
function bindRingControls(ring) {
  document.querySelectorAll("[data-ctrl]").forEach(input => {
    if (input.dataset.bound) return;
    input.dataset.bound = "1";
    const key = input.dataset.ctrl;
    input.addEventListener("input", () => {
      cfg[key] = parseFloat(input.value)||0;
      document.querySelectorAll("[data-ctrl=\""+key+"\"]").forEach(x => { if(x!==input) x.value = input.value; });
      renderD();
    });
  });
}

function bindLayerControls() {
  document.querySelectorAll("[data-ctrl]").forEach(input => {
    if (input.dataset.bound) return;
    input.dataset.bound = "1";
    const key = input.dataset.ctrl;
    const isToggle = input.classList.contains("toggle");
    const isRange = input.type === "range";
    const isNumber = input.type === "number";
    if (isToggle) {
      input.addEventListener("click", () => {
        input.classList.toggle("on");
        const l = selLayer();
        if (l) { l[key] = input.classList.contains("on"); textStripCache.clear(); renderD(); autoHist(); }
      });
      return;
    }
    const ev = (input.tagName === "SELECT" || input.type === "checkbox") ? "change" : "input";
    input.addEventListener(ev, () => {
      let v = input.value;
      if (isRange || isNumber) v = parseFloat(v)||0;
      const l = selLayer();
      if (l) { l[key] = v; if (key==="text") l.name=v; if (key==="font"||key==="mode") updateFloatingPanel(); }
      if (isRange||isNumber) document.querySelectorAll("[data-ctrl=\""+key+"\"]").forEach(x => { if(x!==input) x.value = v; });
      textStripCache.clear();
      renderD();
      if (!isRange && !isNumber) autoHist();
    });
  });
}

/* ═══ COLOR PALETTE ═══ */
function buildColorPalette() {
  const row = document.getElementById("swatchRow");
  row.innerHTML = SWATCHES.map(c => '<div class="color-swatch" data-color="' + c + '" style="background:' + c + '"></div>').join("");
  row.querySelectorAll(".color-swatch").forEach(s => {
    s.addEventListener("click", () => {
      cfg.inkColor = s.dataset.color;
      row.querySelectorAll(".color-swatch").forEach(x => x.classList.toggle("active", x === s));
      document.getElementById("inkColorPicker").value = cfg.inkColor;
      textStripCache.clear(); renderD();
    });
  });
  document.getElementById("inkColorPicker").addEventListener("input", () => {
    cfg.inkColor = document.getElementById("inkColorPicker").value; textStripCache.clear(); renderD();
  });
}

/* ═══ TEMPLATES ═══ */
function applyTemplate(name) {
  if (!TEMPLATES[name]) return;
  const saved = { inkColor: cfg.inkColor, opacity: cfg.opacity };
  cfg = Object.assign(buildConfig(name), saved);
  DPI_CURRENT = cfg.dpi || 300;
  selId = cfg.layers[0].id; selectedIds = new Set([selId]); selShape = false; selRing = null; currentElement = null;
  textStripCache.clear();
  updateLeftPanel(); updateFloatingPanel(); render(); pushHistory();
  showToast(TEMPLATES[name].label);
}

/* ═══ EXPORT ═══ */
function download(url, filename) {
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

function exportPNG() {
  render();
  download(canvas.toDataURL("image/png"), "stamp.png");
  showToast("PNG exported");
}

/* ═══ SYNC + INIT ═══ */
function syncAll() { DPI_CURRENT = cfg.dpi || 300; updateLeftPanel(); updateFloatingPanel(); }

function init() {
  const loaded = loadState();
  buildColorPalette();
  bindPointerEvents();
  initSidebarToggle();
  initFloatingPanel();
  initZoomPan();

  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("redoBtn").addEventListener("click", redo);
  document.getElementById("zoomIn").addEventListener("click", zoomIn);
  document.getElementById("zoomOut").addEventListener("click", zoomOut);
  document.getElementById("recenterBtn").addEventListener("click", recenter);
  document.getElementById("exportBtn").addEventListener("click", exportPNG);
  document.getElementById("savePresetBtn").addEventListener("click", () => {
    const name = prompt("Preset name:");
    if (name) { savePreset(name); updateLeftPanel(); }
  });
  document.getElementById("loadPresetBtn").addEventListener("click", () => {
    const presets = loadPresetsList();
    if (presets.length === 0) { showToast("No presets"); return; }
    const modal = document.getElementById("presetModal");
    const body = document.getElementById("presetModalBody");
    document.getElementById("presetModalTitle").textContent = "Load Preset";
    body.innerHTML = presets.map((p, i) =>
      '<div class="preset-item" data-idx="' + i + '"><span class="preset-name">' + p.name + "</span></div>"
    ).join("");
    body.querySelectorAll(".preset-item").forEach(el => el.addEventListener("click", () => {
      loadPreset(parseInt(el.dataset.idx)); updateLeftPanel(); modal.classList.remove("show");
    }));
    modal.classList.add("show");
  });
  document.getElementById("presetModalClose").addEventListener("click", () => document.getElementById("presetModal").classList.remove("show"));
  document.getElementById("presetModal").addEventListener("click", e => { if (e.target === e.currentTarget) e.target.classList.remove("show"); });

  document.getElementById("importFile").addEventListener("change", e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const maxMm=12; let w=maxMm,h=maxMm;
        if(img.width>img.height) h=maxMm*(img.height/img.width); else w=maxMm*(img.width/img.height);
        const l = makeLayer({type:"image",name:"Image",imageData:ev.target.result,imageWidthMm:Math.round(w*10)/10,imageHeightMm:Math.round(h*10)/10});
        cfg.layers.push(l); selId=l.id; selectedIds=new Set([selId]);
        autoHist(); updateLeftPanel(); updateFloatingPanel(); render(); showToast("Image imported");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file); e.target.value="";
  });

  window.addEventListener("resize", () => updateCanvasCSS());

  if (loaded) { syncAll(); render(); pushHistory(); }
  else { syncAll(); render(); }
  document.fonts.ready.then(() => render());
}

/* ── Presets ── */
const PRESETS_KEY = "stampstudio_presets_v2";
function loadPresetsList() { try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; } catch { return []; } }
function savePreset(name) {
  const presets = loadPresetsList();
  presets.push({ name, config: JSON.parse(JSON.stringify(cfg)), date: Date.now() });
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  showToast("Saved: " + name);
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
  textStripCache.clear();
  syncAll(); render(); pushHistory();
  showToast("Loaded: " + presets[index].name);
}

init();

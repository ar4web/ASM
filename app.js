"use strict";
/* Stamp Studio — Clean Rebuild */

const DEG = Math.PI / 180;
let DPI = 300;
const mmPx = mm => mm * (DPI / 25.4);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = () => 'L' + Math.random().toString(36).slice(2, 8);
const lerp = (a, b, t) => a + (b - a) * t;
const debounce = (fn, ms = 16) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ── RTL ── */
const isRTL = t => /[؀-ۿ]/.test(t || '');
const layerDir = l => l.dir === 'auto' ? (isRTL(l.text) ? 'rtl' : 'ltr') : l.dir;

/* ── RNG ── */
function mkRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ── Color ── */
function hexRgba(hex, opacity) {
  let c = (hex || '#000000').replace('#', '').trim();
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(c)) c = '000000';
  const n = parseInt(c, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(opacity / 100, 0, 1)})`;
}

/* ── Storage ── */
const STORAGE_KEY = 'stampstudio_v6';
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (_) {} }
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return false;
    cfg = buildConfig(data.template || 'oval');
    Object.assign(cfg, data);
    if (!Array.isArray(cfg.ringsData) || cfg.ringsData.length === 0) cfg.ringsData = defaultRings();
    if (!Array.isArray(cfg.layers) || cfg.layers.length === 0) cfg.layers = defaultLayers();
    cfg.layers = cfg.layers.map(l => makeLayer(l));
    selId = cfg.layers[0]?.id || null;
    return true;
  } catch { return false; }
}

/* ── Toast ── */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 1500);
}

/* ── Fonts ── */
const FONTS = [
  { group: 'Arabic', items: ['Cairo','Tajawal'] },
  { group: 'Latin', items: ['Inter','Montserrat'] },
];
const FONT_WEIGHTS = {
  'Cairo': [400,600,700,800], 'Tajawal': [400,500,700],
  'Inter': [300,400,500,600,700], 'Montserrat': [700,800,900],
};
function safeWeight(font, weight) {
  const list = FONT_WEIGHTS[font];
  if (!list) return weight;
  if (list.includes(weight)) return weight;
  return list.reduce((a, b) => Math.abs(b - weight) < Math.abs(a - weight) ? b : a);
}
function fontOptHTML(sel) {
  return FONTS.map(g => `<optlabel>${g.group}</optlabel>` + g.items.map(f => `<option${f === sel ? ' selected' : ''}>${f}</option>`).join('')).join('');
}

/* ── State Model ── */
function makeLayer(o = {}) {
  return Object.assign({
    id: uid(), name: 'Text', text: 'Text',
    font: 'Inter', weight: 700,
    sizeMm: 4, letterSpacing: 0,
    scaleX: 1, scaleY: 1, dir: 'auto', mode: 'curved', flip: false,
    radiusMm: 16, startAngle: 200, endAngle: 340,
    offsetXmm: 0, offsetYmm: 0, visible: true, type: 'text',
    shapeType: 'star', shapeSizeMm: 10, shapeRotation: 0, shapeFill: true, shapePoints: 5,
    imageData: null, imageWidthMm: 10, imageHeightMm: 10,
  }, o);
}

function defaultRings() {
  return [
    { id: uid(), thickness: 1.8, gap: 0 },
    { id: uid(), thickness: 0.8, gap: 1.2 },
  ];
}

function defaultLayers() {
  return [
    makeLayer({ name: 'Top Arabic', text: 'شركة بصمة الموارد', font: 'Cairo', dir: 'rtl', weight: 800, sizeMm: 4, mode: 'curved', radiusMm: 14, startAngle: 200, endAngle: 340 }),
    makeLayer({ name: 'Bottom', text: 'STAMP CO.', font: 'Inter', dir: 'ltr', weight: 700, sizeMm: 3.2, mode: 'curved', flip: true, radiusMm: 13.5, startAngle: 150, endAngle: 30 }),
  ];
}

function baseStyle() {
  return { inkColor: '#1e3a8a', opacity: 100, inkBleed: true, inkBleedAmount: 0.5, rotationJitter: true, jitterDegrees: 0.5, seed: 73219, dpi: 300 };
}

/* ── Templates ── */
const TEMPLATES = {
  oval:       { label: 'Oval',    icon: '⬮', shape: 'oval',      width: 62, height: 36 },
  circle:     { label: 'Circle',  icon: '●', shape: 'circle',    outerDiameter: 46 },
  rectangle:  { label: 'Rect',    icon: '▭', shape: 'rectangle', width: 72, height: 34 },
  square:     { label: 'Square',  icon: '■', shape: 'rectangle', width: 44, height: 44 },
  minimal:    { label: 'Minimal', icon: '○', shape: 'circle',    outerDiameter: 38 },
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
    makeLayer({ name: 'Company', text: 'COMPANY', font: 'Montserrat', weight: 800, sizeMm: 3, letterSpacing: 2, mode: 'curved', radiusMm: 12, startAngle: 210, endAngle: 330 }),
  ];
  return [
    makeLayer({ name: 'Top Arabic', text: 'شركة بصمة الموارد', font: 'Cairo', dir: 'rtl', weight: 800, sizeMm: 4, mode: 'curved', radiusMm: 14, startAngle: 200, endAngle: 340 }),
    makeLayer({ name: 'Bottom', text: 'STAMP CO.', font: 'Inter', dir: 'ltr', weight: 700, sizeMm: 3.2, mode: 'curved', flip: true, radiusMm: 13.5, startAngle: 150, endAngle: 30 }),
  ];
}

function buildConfig(name) {
  const t = TEMPLATES[name] || TEMPLATES.circle;
  return Object.assign({}, baseStyle(), {
    template: name, shape: t.shape,
    outerDiameter: t.outerDiameter || t.width,
    width: t.width, height: t.height,
    cornerRadius: t.shape === 'rectangle' ? 4 : 0,
    ringsData: defaultRings(),
    layers: templateLayers(name),
  });
}

const SWATCHES = ['#1e3a8a','#c0182a','#15171c','#1f7a45','#5b21b6','#0f766e','#b45309','#0369a1'];

/* ── Live State ── */
let cfg = buildConfig('oval');
let selId = cfg.layers[0]?.id || null;
let selRingId = null;
let currentSel = null; // { type: 'ring'|'layer', id }

const selLayer = () => cfg.layers.find(l => l.id === selId) || null;
const stampSize = () => cfg.shape === 'circle' ? { w: cfg.outerDiameter, h: cfg.outerDiameter } : { w: cfg.width, h: cfg.height };

/* ── Canvas ── */
const canvas = document.getElementById('stampCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
const viewport = document.getElementById('viewport');
const zoomLabel = document.getElementById('zoomLabel');
const zoomVal2 = document.getElementById('zoomVal2');

let targetZoom = 1, currentZoom = 1;
let targetPan = { x: 0, y: 0 }, currentPan = { x: 0, y: 0 };
let canvasReady = false;

function setupCanvas() {
  if (canvasReady) { updateCanvasCSS(); return; }
  canvas.width = 2.5 * 300;  // 750px
  canvas.height = 2.5 * 300;
  canvasReady = true;
  updateCanvasCSS();
}

function updateCanvasCSS() {
  const vpW = viewport.clientWidth - 40;
  const vpH = viewport.clientHeight - 20;
  const base = Math.min(vpW, vpH, 380);
  const size = base * currentZoom;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  canvas.style.transform = `translate(${currentPan.x}px, ${currentPan.y}px)`;
  const pct = Math.round(currentZoom * 100) + '%';
  if (zoomLabel) zoomLabel.textContent = pct;
  if (zoomVal2) zoomVal2.textContent = pct;
}

function animateTransform() {
  let frame;
  function step() {
    currentZoom = lerp(currentZoom, targetZoom, 0.15);
    currentPan.x = lerp(currentPan.x, targetPan.x, 0.15);
    currentPan.y = lerp(currentPan.y, targetPan.y, 0.15);
    updateCanvasCSS();
    if (Math.abs(currentZoom - targetZoom) > 0.002 || Math.abs(currentPan.x - targetPan.x) > 0.5 || Math.abs(currentPan.y - targetPan.y) > 0.5) {
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

  let isPanning = false, pStart = { x: 0, y: 0 };
  viewport.addEventListener('mousedown', e => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      isPanning = true;
      pStart = { x: e.clientX - targetPan.x, y: e.clientY - targetPan.y };
      viewport.style.cursor = 'grabbing';
    }
  });
  document.addEventListener('mousemove', e => {
    if (!isPanning) return;
    targetPan.x = e.clientX - pStart.x;
    targetPan.y = e.clientY - pStart.y;
    animateTransform();
  });
  document.addEventListener('mouseup', () => { isPanning = false; viewport.style.cursor = ''; });
  viewport.addEventListener('dblclick', () => { targetZoom = 1; targetPan = { x: 0, y: 0 }; animateTransform(); });
}

function zoomIn() { targetZoom = clamp(targetZoom + 0.2, 0.3, 5); animateTransform(); }
function zoomOut() { targetZoom = clamp(targetZoom - 0.2, 0.3, 5); animateTransform(); }
function recenter() { targetZoom = 1; targetPan = { x: 0, y: 0 }; animateTransform(); }

/* ═══ SIDEBAR ═══ */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    setTimeout(updateCanvasCSS, 260);
  });
}

/* ═══ FLOATING PANEL (draggable) ═══ */
function initFloatingPanel() {
  const panel = document.getElementById('floatingPanel');
  const header = document.getElementById('fpHeader');
  const close = document.getElementById('fpClose');
  close.addEventListener('click', () => panel.classList.remove('open'));

  let dragging = false, ox = 0, oy = 0;

  header.addEventListener('mousedown', e => {
    if (e.target.closest('.fp-close')) return;
    dragging = true;
    e.preventDefault();
    const r = panel.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    panel.style.transition = 'none';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const x = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - ox));
    const y = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, e.clientY - oy));
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
    panel.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    document.body.style.userSelect = '';
    panel.style.transition = '';
  });
}

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

function drawRings(cx, cy, wPx, hPx, color) {
  const rx = wPx/2, ry = hPx/2;
  if (cfg.shape === 'rectangle') {
    rectStroke(cx, cy, wPx, hPx, 0, cfg.ringsData[0]?.thickness || 1.5, color);
    let offset = (cfg.ringsData[0]?.thickness || 1.5) + (cfg.ringsData[0]?.gap || 1);
    for (let i = 1; i < cfg.ringsData.length; i++) {
      const r = cfg.ringsData[i];
      if (r.thickness > 0) rectStroke(cx, cy, wPx, hPx, offset, r.thickness, color);
      offset += r.thickness + r.gap;
    }
    return;
  }
  // Circle / Oval
  ellipseStroke(cx, cy, rx, ry, cfg.ringsData[0]?.thickness || 1.5, color);
  let insetPx = mmPx((cfg.ringsData[0]?.thickness || 1.5) + (cfg.ringsData[0]?.gap || 1));
  for (let i = 1; i < cfg.ringsData.length; i++) {
    const r = cfg.ringsData[i];
    if (r.thickness > 0) ellipseStroke(cx, cy, rx - insetPx, ry - insetPx, r.thickness, color);
    insetPx += mmPx(r.thickness + r.gap);
  }
}

function textEllipseMm(layer) {
  const sz = stampSize();
  const r = layer.radiusMm;
  if (cfg.shape === 'oval' && sz.w > 0) return { rx: r, ry: Math.max(0.5, r * (sz.h / sz.w)) };
  return { rx: r, ry: r };
}

const textStripCache = new Map();

function buildTextStrip(layer, color) {
  const key = layer.id + "_" + layer.text + "_" + layer.font + "_" + layer.weight + "_" + layer.sizeMm + "_" + layer.letterSpacing + "_" + layer.scaleX + "_" + layer.scaleY + "_" + layer.dir + "_" + color;
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
  const blurPx = mmPx(cfg.inkBleedAmount) * 0.2;
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
    ctx.font = safeWeight(layer.font, layer.weight) + " " + fontPx + 'px "' + layer.font + '"';
    if ("letterSpacing" in ctx) ctx.letterSpacing = layer.letterSpacing + "px";
    ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.direction = layerDir(layer);
    ctx.translate(tx, ty); ctx.scale(layer.scaleX||1, layer.scaleY||1); ctx.fillText(layer.text, 0, 0);
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
let renderQueued = false;
function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; _doRender(); });
}

function _doRender() {
  setupCanvas();
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  const stampW = mmPx(stampSize().w);
  const stampH = mmPx(stampSize().h);
  const cx = W/2, cy = H/2;
  const color = hexRgba(cfg.inkColor, cfg.opacity);
  const rng = mkRng(cfg.seed);
  drawRings(cx, cy, stampW, stampH, color);
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
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * sx, my = (e.clientY - rect.top) * sy;
    const stampW = mmPx(stampSize().w), stampH = mmPx(stampSize().h);
    const cx = canvas.width/2, cy = canvas.height/2;
    const dx = (mx - cx) / (stampW/2), dy = (my - cy) / (stampH/2);
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 0.7 && dist < 1.2) {
      if (dist > 0.85) selectRing(cfg.ringsData[0]?.id);
      else if (cfg.ringsData.length > 1) selectRing(cfg.ringsData[1]?.id);
      return;
    }
    let found = false;
    cfg.layers.forEach(layer => {
      const lcx = cx + mmPx(layer.offsetXmm), lcy = cy + mmPx(layer.offsetYmm);
      const d = Math.hypot(mx - lcx, my - lcy);
      if (d < mmPx(layer.sizeMm || 4) * 2.5) { selectLayer(layer.id); found = true; }
    });
    if (!found) selectNone();
  });
}

/* ═══ SELECTION ═══ */
function selectRing(ringId) {
  currentSel = { type: 'ring', id: ringId };
  selRingId = ringId;
  selId = null;
  updateSidebar();
  updateFloatingPanel();
  render();
}
function selectLayer(layerId) {
  currentSel = { type: 'layer', id: layerId };
  selId = layerId;
  selRingId = null;
  updateSidebar();
  updateFloatingPanel();
  render();
}
function selectNone() {
  currentSel = null; selId = null; selRingId = null;
  updateSidebar();
  updateFloatingPanel();
  render();
}

/* ═══ SIDEBAR UPDATE ═══ */
function updateSidebar() {
  // Templates
  const tl = document.getElementById("templateList");
  if (tl) {
    tl.innerHTML = Object.entries(TEMPLATES).map(([k, t]) =>
      `<div class="lp-el${cfg.template === k ? ' selected' : ''}" data-tpl="${k}">
        <span class="lp-icon">${t.icon}</span><span class="lp-name">${t.label}</span>
      </div>`
    ).join("");
    tl.querySelectorAll("[data-tpl]").forEach(el => el.addEventListener("click", () => applyTemplate(el.dataset.tpl)));
  }

  // Rings
  const rl = document.getElementById("ringList");
  if (rl) {
    rl.innerHTML = cfg.ringsData.map((r, i) =>
      `<div class="lp-el${selRingId === r.id ? ' selected' : ''}" data-ring="${r.id}">
        <span class="lp-icon">◯</span><span class="lp-name">Ring ${i + 1}</span>
        <span class="lp-val">${r.thickness}mm</span>
      </div>`
    ).join("");
    rl.querySelectorAll("[data-ring]").forEach(el => el.addEventListener("click", () => selectRing(el.dataset.ring)));
  }

  // Elements
  const el = document.getElementById("elementList");
  if (el) {
    el.innerHTML = cfg.layers.map(l =>
      `<div class="lp-el${selId === l.id ? ' selected' : ''}" data-layer="${l.id}">
        <span class="lp-icon">${l.type === "shape" ? "★" : "T"}</span>
        <span class="lp-name">${l.name || l.text}</span>
      </div>`
    ).join("");
    el.querySelectorAll("[data-layer]").forEach(e2 => e2.addEventListener("click", () => selectLayer(e2.dataset.layer)));
  }

  // Presets
  const pl = document.getElementById("presetList");
  if (pl) {
    const presets = loadPresetsList();
    pl.innerHTML = presets.length === 0 ? '<div style="font-size:9px;color:var(--text-dim);padding:4px 8px">No presets</div>' :
      presets.map((p, i) => `<div class="lp-el" data-preset="${i}"><span class="lp-icon">📄</span><span class="lp-name">${p.name}</span></div>`).join("");
    pl.querySelectorAll("[data-preset]").forEach(e2 => e2.addEventListener("click", () => { loadPreset(parseInt(e2.dataset.preset)); updateSidebar(); }));
  }
}

/* ═══ ADD RING ═══ */
function addRing() {
  const lastRing = cfg.ringsData[cfg.ringsData.length - 1];
  const newThickness = 0.6;
  const newGap = 1.0;
  cfg.ringsData.push({ id: uid(), thickness: newThickness, gap: newGap });
  textStripCache.clear();
  updateSidebar();
  render();
  showToast("Ring added");
}

/* ═══ FLOATING CONTROLLER ═══ */
function updateFloatingPanel() {
  const panel = document.getElementById("floatingPanel");
  const body = document.getElementById("fpBody");
  const header = document.getElementById("fpHeader").querySelector("span");

  if (currentSel?.type === "ring") {
    const ring = cfg.ringsData.find(r => r.id === currentSel.id);
    if (!ring) { panel.classList.remove("open"); return; }
    const idx = cfg.ringsData.indexOf(ring);
    header.textContent = "⚙️ Ring " + (idx + 1);
    body.innerHTML = ringController(ring, idx);
    bindRingControls(ring);
    panel.classList.add("open");
    return;
  }

  const l = selLayer();
  if (!l) {
    header.textContent = "⚙️ Controller";
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">👆</div><div class="empty-text">Click an element to control</div></div>';
    panel.classList.remove("open");
    return;
  }
  header.textContent = "⚙️ " + (l.name || "Layer");
  panel.classList.add("open");
  if (l.type === "shape") { body.innerHTML = shapeController(l); bindLayerControls(); return; }
  if (l.type === "image") { body.innerHTML = imageController(l); bindLayerControls(); return; }
  body.innerHTML = textController(l);
  bindLayerControls();
}

function sldr(key, min, max, step, unit, val) {
  return `<div class="ctrl-row"><span class="ctrl-label">${key}</span>
    <div class="slider-pair">
      <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-ctrl="${key}">
      <input type="number" min="${min}" max="${max}" step="${step}" value="${val}" data-ctrl="${key}">
    </div>
    ${unit ? '<span style="font-size:9px;color:var(--text-dim)">' + unit + "</span>" : ""}
  </div>`;
}

function ringController(ring, idx) {
  let h = '<div class="ctrl-section"><div class="ctrl-section-title">Size</div>';
  h += sldr("thickness", 0.1, 8, 0.1, "mm", ring.thickness);
  h += '</div><div class="ctrl-section"><div class="ctrl-section-title">Gap</div>';
  h += sldr("gap", 0, 10, 0.1, "mm", ring.gap);
  if (idx > 0) h += '<div class="ctrl-row"><button class="lp-btn" style="width:100%;color:var(--danger)" data-delring="' + ring.id + '">Remove Ring</button></div>';
  h += "</div>";
  return h;
}

function textController(l) {
  const weightOpts = (FONT_WEIGHTS[l.font]||[400,700]).map(w => {
    const n = {300:"Light",400:"Regular",500:"Medium",600:"Semi",700:"Bold",800:"Extra",900:"Black"};
    return '<option value="' + w + '"' + (l.weight===w?" selected":"") + ">" + (n[w]||w) + "</option>";
  }).join("");
  let h = '<div class="ctrl-section"><div class="ctrl-section-title">Text</div>';
  h += '<div class="ctrl-row"><textarea class="ctrl-textarea" data-ctrl="text" dir="auto">' + l.text + "</textarea></div>";
  h += '</div><div class="ctrl-section"><div class="ctrl-section-title">Font</div><div class="ctrl-row" style="gap:4px">';
  h += '<select class="ctrl-select" data-ctrl="font">' + fontOptHTML(l.font) + "</select>";
  h += '<select class="ctrl-select" style="max-width:60px" data-ctrl="weight">' + weightOpts + "</select>";
  h += '</div></div><div class="ctrl-section"><div class="ctrl-section-title">Size</div>';
  h += sldr("sizeMm", 1, 18, 0.1, "mm", l.sizeMm);
  if (l.mode === "curved") {
    h += '</div><div class="ctrl-section"><div class="ctrl-section-title">Curve</div>';
    h += sldr("radiusMm", 3, 42, 0.1, "mm", l.radiusMm);
    h += sldr("startAngle", 0, 360, 1, "°", l.startAngle);
    h += sldr("endAngle", 0, 360, 1, "°", l.endAngle);
    h += '<div class="toggle-row"><div class="toggle' + (l.flip?" on":"") + '" data-ctrl="flip"></div><span class="toggle-label">Flip</span></div>';
  } else {
    h += '</div><div class="ctrl-section"><div class="ctrl-section-title">Position</div>';
    h += sldr("offsetXmm", -50, 50, 0.1, "x", l.offsetXmm);
    h += sldr("offsetYmm", -50, 50, 0.1, "y", l.offsetYmm);
  }
  h += '</div><div class="ctrl-section"><div class="ctrl-section-title">Spacing</div>';
  h += sldr("letterSpacing", -4, 20, 0.5, "px", l.letterSpacing);
  h += '</div><div class="ctrl-section"><div class="ctrl-section-title">Scale</div>';
  h += sldr("scaleX", 0.3, 3, 0.05, "x", l.scaleX);
  h += sldr("scaleY", 0.3, 3, 0.05, "x", l.scaleY);
  h += "</div>";
  return h;
}

function shapeController(l) {
  const opts = ["star","circle","diamond"].map(s => '<option value="' + s + '"' + (l.shapeType===s?" selected":"") + ">" + s.charAt(0).toUpperCase()+s.slice(1) + "</option>").join("");
  let h = '<div class="ctrl-section"><div class="ctrl-section-title">Shape</div><div class="ctrl-row"><select class="ctrl-select" data-ctrl="shapeType">' + opts + "</select></div>";
  h += '</div><div class="ctrl-section"><div class="ctrl-section-title">Size</div>';
  h += sldr("shapeSizeMm", 1, 20, 0.5, "mm", l.shapeSizeMm);
  h += '</div><div class="ctrl-section"><div class="ctrl-section-title">Rotation</div>';
  h += sldr("shapeRotation", 0, 360, 1, "°", l.shapeRotation);
  h += '</div><div class="ctrl-section"><div class="ctrl-section-title">Position</div>';
  h += sldr("offsetXmm", -30, 30, 0.1, "x", l.offsetXmm);
  h += sldr("offsetYmm", -30, 30, 0.1, "y", l.offsetYmm);
  h += '</div><div class="ctrl-section"><div class="ctrl-section-title">Style</div>';
  h += '<div class="toggle-row"><div class="toggle' + (l.shapeFill?" on":"") + '" data-ctrl="shapeFill"></div><span class="toggle-label">Filled</span></div>';
  h += "</div>";
  return h;
}

function imageController(l) {
  let h = '<div class="ctrl-section"><div class="ctrl-section-title">Size</div>';
  h += sldr("imageWidthMm", 1, 30, 0.5, "mm", l.imageWidthMm);
  h += sldr("imageHeightMm", 1, 30, 0.5, "mm", l.imageHeightMm);
  h += '</div><div class="ctrl-section"><div class="ctrl-section-title">Position</div>';
  h += sldr("offsetXmm", -30, 30, 0.1, "x", l.offsetXmm);
  h += sldr("offsetYmm", -30, 30, 0.1, "y", l.offsetYmm);
  h += "</div>";
  return h;
}

/* ═══ BIND CONTROLS ═══ */
function bindRingControls(ring) {
  document.querySelectorAll("[data-ctrl]").forEach(input => {
    if (input.dataset.bound) return;
    input.dataset.bound = "1";
    const key = input.dataset.ctrl;
    input.addEventListener("input", () => {
      ring[key] = parseFloat(input.value)||0;
      document.querySelectorAll("[data-ctrl=\""+key+"\"]").forEach(x => { if(x!==input) x.value = input.value; });
      textStripCache.clear(); renderD();
    });
  });
  const delBtn = document.querySelector("[data-delring]");
  if (delBtn) delBtn.addEventListener("click", () => {
    cfg.ringsData = cfg.ringsData.filter(r => r.id !== delBtn.dataset.delring);
    selectNone();
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
        if (l) { l[key] = input.classList.contains("on"); textStripCache.clear(); renderD(); }
      });
      return;
    }
    const ev = (input.tagName === "SELECT" || input.type === "checkbox") ? "change" : "input";
    input.addEventListener(ev, () => {
      let v = input.value;
      if (isRange || isNumber) v = parseFloat(v)||0;
      const l = selLayer();
      if (l) {
        l[key] = v;
        if (key==="text") l.name = v;
        if (key==="font"||key==="mode") updateFloatingPanel();
      }
      if (isRange||isNumber) document.querySelectorAll("[data-ctrl=\""+key+"\"]").forEach(x => { if(x!==input) x.value = v; });
      textStripCache.clear(); renderD();
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
  DPI = cfg.dpi || 300;
  selId = cfg.layers[0]?.id || null;
  textStripCache.clear();
  updateSidebar();
  updateFloatingPanel();
  render();
  showToast(TEMPLATES[name].label);
}

/* ═══ EXPORT ═══ */
function download(url, fname) {
  const a = document.createElement("a"); a.href = url; a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
}

function exportPNG() {
  render();
  download(canvas.toDataURL("image/png"), "stamp.png");
  showToast("PNG exported");
}

/* ═══ PRESETS ── */
const PRESETS_KEY = "stampstudio_presets_v2";
function loadPresetsList() { try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; } catch { return []; } }
function savePreset(name) {
  const p = loadPresetsList(); p.push({ name, config: JSON.parse(JSON.stringify(cfg)) });
  localStorage.setItem(PRESETS_KEY, JSON.stringify(p)); showToast("Saved: " + name);
}
function loadPreset(index) {
  const p = loadPresetsList(); if (!p[index]) return;
  cfg = JSON.parse(JSON.stringify(p[index].config));
  cfg.seed = cfg.seed || Math.floor(Math.random() * 1e6);
  DPI = cfg.dpi || 300; selId = cfg.layers[0]?.id || null;
  textStripCache.clear(); syncAll(); render();
  showToast("Loaded: " + p[index].name);
}

/* ═══ SYNC + INIT ═══ */
function syncAll() { DPI = cfg.dpi || 300; updateSidebar(); updateFloatingPanel(); }

function init() {
  const loaded = loadState();
  buildColorPalette();
  bindPointerEvents();
  initSidebar();
  initFloatingPanel();
  initZoomPan();

  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("redoBtn").addEventListener("click", redo);
  document.getElementById("zoomIn").addEventListener("click", zoomIn);
  document.getElementById("zoomOut").addEventListener("click", zoomOut);
  document.getElementById("recenterBtn").addEventListener("click", recenter);
  document.getElementById("zoomIn2").addEventListener("click", zoomIn);
  document.getElementById("zoomOut2").addEventListener("click", zoomOut);
  document.getElementById("recenterBtn2").addEventListener("click", recenter);
  document.getElementById("exportBtn").addEventListener("click", exportPNG);
  document.getElementById("addRingBtn").addEventListener("click", addRing);

  document.getElementById("savePresetBtn").addEventListener("click", () => {
    const name = prompt("Preset name:"); if (name) { savePreset(name); updateSidebar(); }
  });
  document.getElementById("loadPresetBtn").addEventListener("click", () => {
    const presets = loadPresetsList();
    if (presets.length === 0) { showToast("No presets"); return; }
    const modal = document.getElementById("presetModal");
    const body = document.getElementById("presetModalBody");
    document.getElementById("presetModalTitle").textContent = "Load Preset";
    body.innerHTML = '<div class="preset-list">' + presets.map((p, i) =>
      '<div class="preset-item" data-idx="' + i + '"><span class="preset-name">' + p.name + '</span></div>'
    ).join("") + '</div>';
    body.querySelectorAll(".preset-item").forEach(el => el.addEventListener("click", () => {
      loadPreset(parseInt(el.dataset.idx)); updateSidebar(); modal.classList.remove("show");
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
        cfg.layers.push(l); selId=l.id;
        updateSidebar(); updateFloatingPanel(); render(); showToast("Image imported");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file); e.target.value="";
  });

  window.addEventListener("resize", () => updateCanvasCSS());

  if (loaded) { syncAll(); render(); }
  else { syncAll(); render(); }
  document.fonts.ready.then(() => render());
}

init();

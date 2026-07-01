"use strict";
/* Stamp Studio - Minimal Smooth UI */
const DEG = Math.PI / 180;
let DPI_CURRENT = 300;
const mmPx = mm => mm * (DPI_CURRENT / 25.4);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = () => 'L' + Math.random().toString(36).slice(2, 8);

// Undo/Redo
let histStack = [], histIdx = -1, histPushing = false;
function pushHistory() {
  histStack = histStack.slice(0, histIdx + 1);
  histStack.push(JSON.stringify(cfg));
  if (histStack.length > 60) histStack.shift();
  histIdx = histStack.length - 1;
  histPushing = false;
  localStorage.setItem('stampstudio_v6', JSON.stringify(cfg));
}
function undo() { if (histIdx <= 0) return; histIdx--; loadCfg(histStack[histIdx]); }
function redo() { if (histIdx >= histStack.length - 1) return; histIdx++; loadCfg(histStack[histIdx]); }
function loadCfg(json) {
  cfg = JSON.parse(json); DPI_CURRENT = cfg.dpi || 300;
  selId = cfg.layers[0]?.id || null;
  syncAll(); render(); showToast('Undo');
}
function autoHist() { if (!histPushing) { histPushing = true; pushHistory(); } }

// Fonts
const FONTS = [
  { group: 'Arabic', items: ['Cairo','Tajawal','Noto Sans Arabic'] },
  { group: 'Latin', items: ['Inter','Montserrat','Poppins'] },
];
const FONT_WEIGHTS = {
  'Cairo': [400,600,700,800], 'Tajawal': [400,500,700],
  'Noto Sans Arabic': [400,500,600,700], 'Amiri': [400,700],
  'Inter': [300,400,500,600,700], 'Montserrat': [600,700,800,900], 'Poppins': [500,600,700],
};
function safeWeight(font, weight) {
  const list = FONT_WEIGHTS[font];
  return list && !list.includes(weight) ? list.reduce((a,b) => Math.abs(b-weight) < Math.abs(a-weight) ? b : a) : weight;
}
function fontOptHTML(sel) {
  return FONTS.map(g => '<optgroup label="'+g.group+'">' + g.items.map(f => '<option'+(f===sel?' selected':'')+'</option>').join('') + '</optgroup>').join('');
}

// Templates
const TEMPLATES = {
  oval: { label: 'Oval', icon: '⬮', shape: 'oval', width: 62, height: 36, outerRingThickness: 1.8, innerRingThickness: 0.8, rings: 2 },
  circle: { label: 'Circle', icon: '●', shape: 'circle', outerDiameter: 46, outerRingThickness: 2.0, innerRingThickness: 1.1, rings: 2 },
  rectangle: { label: 'Rectangle', icon: '▭', shape: 'rectangle', width: 72, height: 34, outerRingThickness: 1.4, innerRingThickness: 0.6, rings: 2 },
};

// State
let cfg = {
  template: 'oval', shape: 'oval', width: 62, height: 36,
  outerRingThickness: 1.8, innerRingThickness: 0.8, rings: 2,
  inkColor: '#1e3a8a', paddingMm: 5, editorZoom: 1,
  layers: [],
};
let selId = null, activeTool = 'select', currentElement = null;
let canvas, ctx, viewport, stage;

function makeLayer(o = {}) {
  return Object.assign({
    id: uid(), name: 'Text', text: 'Text', font: 'Inter', weight: 700, sizeMm: 4,
    offsetXmm: 0, offsetYmm: 0, visible: true, locked: false, opacity: 100,
    mode: 'curved', flip: false, radiusMm: 16, startAngle: 200, endAngle: 340, type: 'text',
  }, o);
}

function stampSize() {
  return cfg.shape === 'circle' ? { w: cfg.outerDiameter, h: cfg.outerDiameter } : { w: cfg.width, h: cfg.height };
}

// Init layers
cfg.layers = [
  makeLayer({ name: 'Top Arabic', text: 'شركة بصمة الموارد المحدودة', font: 'Cairo', weight: 800, sizeMm: 4.5, mode: 'curved', radiusMm: 28, startAngle: 195, endAngle: 345 }),
  makeLayer({ name: 'Bottom English', text: 'LIMITED RESOURCE STAMP CO.', font: 'Montserrat', weight: 700, sizeMm: 3.8, mode: 'curved', flip: true, radiusMm: 27.5, startAngle: 150, endAngle: 30 }),
];
selId = cfg.layers[0].id;

// Toast
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

// Render
function render() {
  const sz = stampSize(), pad = cfg.paddingMm;
  const wPx = Math.round(mmPx(sz.w + pad * 2)), hPx = Math.round(mmPx(sz.h + pad * 2));
  if (canvas.width !== wPx || canvas.height !== hPx) { canvas.width = wPx; canvas.height = hPx; }
  
  const cx = canvas.width / 2, cy = canvas.height / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw outer ring
  const rx = mmPx(sz.w) / 2, ry = mmPx(sz.h) / 2;
  ctx.strokeStyle = cfg.inkColor; ctx.lineWidth = mmPx(cfg.outerRingThickness);
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw layers
  cfg.layers.forEach(l => {
    if (!l.visible) return;
    ctx.globalAlpha = clamp(l.opacity / 100, 0, 1);
    if (l.mode === 'curved') drawCurvedLayer(l, cx, cy, cfg.inkColor, rx, ry);
    else if (l.mode === 'straight') drawStraightLayer(l, cx, cy, cfg.inkColor);
  });
  ctx.globalAlpha = 1;
  
  // Overlays
  drawOverlays(cx, cy, rx, ry);
  
  document.getElementById('zoomLabelMain').textContent = Math.round(cfg.editorZoom * 100) + '%';
}

function drawCurvedLayer(layer, cx, cy, color, rx, ry) {
  if (!layer.text.trim()) return;
  const fontPx = mmPx(layer.sizeMm), fontStr = safeWeight(layer.font, layer.weight) + ' ' + fontPx + 'px "' + layer.font + '"';
  const m = document.createElement('canvas').getContext('2d');
  m.font = fontStr; m.letterSpacing = layer.letterSpacing + 'px';
  const textW = Math.max(2, Math.ceil(m.measureText(layer.text).width));
  const pad = fontPx * 0.3, sw = textW + pad * 2, sh = fontPx * 2.2;
  const strip = document.createElement('canvas'); strip.width = sw; strip.height = sh;
  const sc = strip.getContext('2d');
  sc.font = fontStr; sc.fillStyle = color; sc.textAlign = 'center'; sc.textBaseline = 'middle';
  sc.translate(sw / 2, sh / 2); sc.fillText(layer.text, 0, 0);
  
  const r = layer.radiusMm;
  const sz = stampSize();
  const textRx = mmPx(r), textRy = mmPx(r * (sz.w / sz.h || 1));
  const slice = Math.max(1, Math.round(sh / 32));
  for (let x = 0; x < sw; x += slice) {
    const f = (x + slice / 2 - pad) / textW;
    if (f < -0.02 || f > 1.02) continue;
    const ang = (layer.startAngle + (layer.endAngle - layer.startAngle) * f) * DEG;
    const tx = cx + Math.cos(ang) * textRx, ty = cy + Math.sin(ang) * textRy;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang + Math.PI / 2 + (layer.flip ? Math.PI : 0));
    ctx.drawImage(strip, x, 0, slice, sh, -slice / 2, -sh / 2, slice, sh);
    ctx.restore();
  }
}

function drawStraightLayer(layer, cx, cy, color) {
  if (!layer.text.trim()) return;
  const fontPx = mmPx(layer.sizeMm), fontStr = safeWeight(layer.font, layer.weight) + ' ' + fontPx + 'px "' + layer.font + '"';
  const tx = cx + mmPx(layer.offsetXmm), ty = cy + mmPx(layer.offsetYmm);
  ctx.font = fontStr; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(layer.text, tx, ty);
}

function drawOverlays(cx, cy, rx, ry) {
  ctx.save(); ctx.strokeStyle = 'rgba(79,140,255,.2)'; ctx.lineWidth = 1; ctx.setLineDash([3,5]);
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
  ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
  ctx.restore();
}

// Left Panel
function updateLeftPanel() {
  document.getElementById('valOuterRing').textContent = (cfg.outerRingThickness || 0).toFixed(1);
  document.getElementById('valInnerRing').textContent = (cfg.innerRingThickness || 0).toFixed(1);
  const layersList = document.getElementById('layersList');
  layersList.innerHTML = cfg.layers.map((l, idx) => `
    <div class="layer-row${currentElement === l.id ? ' selected' : ''}${l.locked ? ' locked' : ''}" data-layer-id="${l.id}">
      <span class="handle">≡</span>
      <button class="vis-btn${l.visible ? ' active' : ''}" data-action="visibility">👁</button>
      <button class="lock-btn${l.locked ? ' active' : ''}" data-action="lock">🔒</button>
      <span class="lp-name">${l.name || l.text || 'Layer'}</span>
      <input type="range" class="opacity-s" min="0" max="100" value="${l.opacity}" data-action="opacity">
    </div>
  `).join('');
  bindLayerEvents();
}

function bindLayerEvents() {
  document.querySelectorAll('[data-layer-id]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('[data-action]')) return;
      const layer = cfg.layers.find(l => l.id === el.dataset.layerId);
      if (!layer.locked) { selId = layer.id; currentElement = selId; updateLeftPanel(); updateRightPanel(); render(); }
    });
    const visBtn = el.querySelector('[data-action="visibility"]');
    const lockBtn = el.querySelector('[data-action="lock"]');
    const opacity = el.querySelector('[data-action="opacity"]');
    if (visBtn) visBtn.addEventListener('click', e => { e.stopPropagation(); const layer = cfg.layers.find(l => l.id === el.dataset.layerId); if (layer) { layer.visible = !layer.visible; visBtn.classList.toggle('active', layer.visible); render(); } });
    if (lockBtn) lockBtn.addEventListener('click', e => { e.stopPropagation(); const layer = cfg.layers.find(l => l.id === el.dataset.layerId); if (layer) { layer.locked = !layer.locked; lockBtn.classList.toggle('active', layer.locked); el.classList.toggle('locked', layer.locked); render(); } });
    if (opacity) opacity.addEventListener('input', e => { e.stopPropagation(); const layer = cfg.layers.find(l => l.id === el.dataset.layerId); if (layer) { layer.opacity = parseInt(opacity.value); render(); } });
  });
}

// Right Panel
function updateRightPanel() {
  const body = document.getElementById('rpBody');
  const header = document.getElementById('rpHeader');
  const l = cfg.layers.find(x => x.id === selId);
  header.textContent = l ? (l.name || 'Layer') : 'Properties';
  if (!l) { body.innerHTML = '<div style="color:var(--text-dim);padding:20px 0">Select a layer</div>'; return; }
  body.innerHTML = `
    <div class="prop-group"><label class="prop-label">Text</label><textarea class="prop-input" data-prop="text" rows="2">${l.text}</textarea></div>
    <div class="prop-group"><label class="prop-label">Font</label><select class="prop-select" data-prop="font">${fontOptHTML(l.font)}</select></div>
    <div class="prop-group"><label class="prop-label">Size</label><input type="range" min="2" max="10" step="0.1" value="${l.sizeMm}" data-prop="sizeMm"><input type="number" min="2" max="10" step="0.1" value="${l.sizeMm}" data-prop="sizeMm"></div>
  `;
  body.querySelectorAll('[data-prop]').forEach(inp => {
    const key = inp.dataset.prop;
    inp.addEventListener(inp.type === 'range' || inp.type === 'number' ? 'input' : 'change', () => {
      let v = inp.value;
      if (inp.type === 'range' || inp.type === 'number') v = parseFloat(v) || 0;
      l[key] = v;
      body.querySelectorAll('[data-prop="'+key+'"]').forEach(x => { if (x !== inp) x.value = v; });
      if (key === 'text') l.name = v;
      render();
    });
  });
}

// Templates
function updateTemplateCards() {
  const container = document.getElementById('templateOptions');
  container.innerHTML = Object.entries(TEMPLATES).map(([key, t]) => `
    <div class="tpl-btn" data-template="${key}">${t.icon} ${t.label}</div>
  `).join('');
  container.querySelectorAll('.tpl-btn').forEach(card => {
    card.addEventListener('click', () => {
      const t = TEMPLATES[card.dataset.template];
      if (t.shape === 'rectangle') cfg.width = t.width, cfg.height = t.height;
      else cfg.outerDiameter = t.outerDiameter;
      Object.assign(cfg, { shape: t.shape, outerRingThickness: t.outerRingThickness, innerRingThickness: t.innerRingThickness, rings: t.rings, template: card.dataset.template });
      render();
    });
  });
}

// Pointers
function bindPointerEvents() {
  viewport.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('.panel') || e.target.closest('.topbar')) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const dxMm = (x - cx) / (DPI_CURRENT / 25.4), dyMm = (y - cy) / (DPI_CURRENT / 25.4);
    
    if (activeTool === 'text') {
      const l = makeLayer({ type: 'text', text: 'New Text', mode: 'straight', offsetXmm: Math.round(dxMm * 10) / 10, offsetYmm: Math.round(dyMm * 10) / 10 });
      cfg.layers.push(l); selId = l.id; currentElement = selId; autoHist(); updateLeftPanel(); updateRightPanel(); render();
    } else if (activeTool === 'shape-rectangle' || activeTool === 'shape-circle') {
      const l = makeLayer({ type: 'shape', name: activeTool === 'shape-rectangle' ? 'Rectangle' : 'Circle', shapeType: activeTool === 'shape-rectangle' ? 'rectangle' : 'circle', shapeSizeMm: 8, offsetXmm: Math.round(dxMm * 10) / 10, offsetYmm: Math.round(dyMm * 10) / 10 });
      cfg.layers.push(l); selId = l.id; currentElement = selId; autoHist(); updateLeftPanel(); updateRightPanel(); render();
    }
  });
  
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b === btn));
      activeTool = btn.dataset.tool;
    });
  });
}

// Color
function buildColorPalette() {
  const row = document.getElementById('swatchRow');
  row.innerHTML = ['#1e3a8a','#c0182a','#15171c','#1f7a45','#5b21b6','#0f766e'].map(c => `<div class="color-swatch" data-color="${c}" style="background:${c}"></div>`).join('');
  row.querySelectorAll('.color-swatch').forEach(s => {
    s.addEventListener('click', () => { cfg.inkColor = s.dataset.color; document.getElementById('inkHex').value = cfg.inkColor; render(); });
  });
}

// Init
function init() {
  canvas = document.getElementById('stampCanvas');
  ctx = canvas.getContext('2d', { alpha: true });
  viewport = document.getElementById('viewport');
  stage = document.getElementById('stage');
  
  syncAll(); render(); pushHistory();
  
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);
  document.getElementById('saveBtn').addEventListener('click', () => { localStorage.setItem('stampstudio_v6', JSON.stringify(cfg)); showToast('Saved'); });
  document.getElementById('exportBtn').addEventListener('click', () => { 
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'stamp.png';
    link.click(); showToast('Exported');
  });
  
  bindPointerEvents();
  buildColorPalette();
}

function syncAll() { updateLeftPanel(); updateRightPanel(); updateTemplateCards(); }

init();
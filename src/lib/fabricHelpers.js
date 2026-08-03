/**
 * fabric.js まわりの小さな道具。
 *
 * window.fabric は public/vendor/ から読み込まれるグローバルなので、
 * ここでは import せず、呼ばれた時点の window.fabric を使う。
 */
export const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const CUSTOM_JSON_PROPS = ['linkType', 'linkTarget', 'stampType'];

// 背景画像(ページ画像そのもの)は毎回ページ表示時に再設定するため、
// 保存データ・履歴には含めない(保存容量と処理時間を大幅に削減)
export const serializeCanvas = (canvas) => {
  const json = canvas.toJSON(CUSTOM_JSON_PROPS);
  delete json.backgroundImage;
  // 保存時のキャンバス幅を記録し、画面サイズの違う端末で開いても
  // 書き込み位置を正しく再現できるようにする
  json.canvasWidth = canvas.getWidth();
  return json;
};

export const isSafeUrl = (url) => /^https?:\/\//i.test(url);

// ツールモードをキャンバスに適用する(初期化時とモード変更時で共通)
export const applyCanvasMode = (canvas, mode, color) => {
  canvas.isDrawingMode = false;
  canvas.selection = false;
  canvas.defaultCursor = 'crosshair';
  canvas.hoverCursor = 'crosshair';

  if (mode === 'pencil') {
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush = new window.fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = 4;
  } else if (mode === 'highlighter') {
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush = new window.fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = hexToRgba(color, 0.4);
    canvas.freeDrawingBrush.width = 24;
  } else if (mode === 'eraser') {
    canvas.defaultCursor = 'cell';
    canvas.hoverCursor = 'cell';
  } else if (mode === 'qr') {
    canvas.defaultCursor = 'crosshair';
    canvas.hoverCursor = 'crosshair';
  } else if (mode === 'select') {
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';
    canvas.selection = true;
  }
};

export const createMathShape = (subtype, x, y) => {
  if (!window.fabric) return null;
  const fabric = window.fabric;
  const yellow = '#ffeb3b'; const stroke = '#666';
  
  if (subtype === 'block-1') { return new fabric.Rect({ left: x, top: y, width: 30, height: 30, fill: yellow, stroke: stroke, strokeWidth: 2, originX: 'center', originY: 'center' }); }
  else if (subtype === 'block-10') { const grp = [new fabric.Rect({ width: 30, height: 300, fill: yellow, stroke: stroke, strokeWidth: 2 })]; for (let i = 1; i < 10; i++) grp.push(new fabric.Line([0, i * 30, 30, i * 30], { stroke: stroke, strokeWidth: 1 })); return new fabric.Group(grp, { left: x, top: y, originX: 'center', originY: 'center', scaleX: 0.3, scaleY: 0.3 }); }
  else if (subtype === 'block-100') { const rect = new fabric.Rect({ width: 300, height: 300, fill: yellow, stroke: stroke, strokeWidth: 2 }); const lines = [rect]; for (let i = 1; i < 10; i++) { lines.push(new fabric.Line([0, i * 30, 300, i * 30], { stroke: stroke, strokeWidth: 1 })); lines.push(new fabric.Line([i * 30, 0, i * 30, 300], { stroke: stroke, strokeWidth: 1 })); } return new fabric.Group(lines, { left: x, top: y, originX: 'center', originY: 'center', scaleX: 0.2, scaleY: 0.2 }); }
  else if (subtype === 'block-1000') { const size = 100; const offset = 30; const front = new fabric.Rect({ left: 0, top: offset, width: size, height: size, fill: yellow, stroke: stroke, strokeWidth: 2 }); const top = new fabric.Polygon([{ x: 0, y: offset }, { x: offset, y: 0 }, { x: size + offset, y: 0 }, { x: size, y: offset }], { fill: '#fdd835', stroke: stroke, strokeWidth: 2 }); const side = new fabric.Polygon([{ x: size, y: offset }, { x: size + offset, y: 0 }, { x: size + offset, y: size }, { x: size, y: size + offset }], { fill: '#fbc02d', stroke: stroke, strokeWidth: 2 }); return new fabric.Group([front, top, side], { left: x, top: y, originX: 'center', originY: 'center', scaleX: 0.6, scaleY: 0.6 }); }
  else if (subtype === 'place-value') { const w = 300; const h = 150; const bg = new fabric.Rect({ width: w, height: h, fill: 'white', stroke: 'black', strokeWidth: 2 }); const grp = [bg, new fabric.Line([w / 4, 0, w / 4, h], { stroke: 'black' }), new fabric.Line([w / 2, 0, w / 2, h], { stroke: 'black' }), new fabric.Line([w * 3 / 4, 0, w * 3 / 4, h], { stroke: 'black' }), new fabric.Line([0, 40, w, 40], { stroke: 'black' })]; const opts = { fontSize: 24, fontFamily: 'Zen Maru Gothic', fill: 'black', top: 8 }; grp.push(new fabric.Text('千', { ...opts, left: w * 0.125 - 12 }), new fabric.Text('百', { ...opts, left: w * 0.375 - 12 }), new fabric.Text('十', { ...opts, left: w * 0.625 - 12 }), new fabric.Text('一', { ...opts, left: w * 0.875 - 12 })); return new fabric.Group(grp, { left: x, top: y, originX: 'center', originY: 'center' }); }
  else if (subtype === 'calc-frame') { const grp = []; const step = 40; for (let i = 0; i < 4; i++) grp.push(new fabric.Line([i * step, 0, i * step, step * 4], { stroke: '#ddd', strokeDashArray: [5, 5] })); for (let i = 0; i < 5; i++) grp.push(new fabric.Line([0, i * step, step * 3, i * step], { stroke: '#ddd', strokeDashArray: [5, 5] })); grp.push(new fabric.Line([0, step * 3, step * 3, step * 3], { stroke: 'black', strokeWidth: 2 })); return new fabric.Group(grp, { left: x, top: y, originX: 'center', originY: 'center', backgroundColor: 'rgba(255,255,255,0.5)' }); }

  // Geometry 2D
  else if (subtype === 'parallelogram') { return new fabric.Polygon([{ x: 20, y: 0 }, { x: 120, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }], { left: x, top: y, fill: 'transparent', stroke: 'black', strokeWidth: 2, originX: 'center', originY: 'center' }); }
  else if (subtype === 'rhombus') { return new fabric.Polygon([{ x: 50, y: 0 }, { x: 100, y: 40 }, { x: 50, y: 80 }, { x: 0, y: 40 }], { left: x, top: y, fill: 'transparent', stroke: 'black', strokeWidth: 2, originX: 'center', originY: 'center' }); }
  else if (subtype === 'trapezoid') { return new fabric.Polygon([{ x: 30, y: 0 }, { x: 90, y: 0 }, { x: 120, y: 60 }, { x: 0, y: 60 }], { left: x, top: y, fill: 'transparent', stroke: 'black', strokeWidth: 2, originX: 'center', originY: 'center' }); }
  else if (subtype === 'pentagon') { return new fabric.Polygon([{ x: 50, y: 0 }, { x: 100, y: 38 }, { x: 81, y: 95 }, { x: 19, y: 95 }, { x: 0, y: 38 }], { left: x, top: y, fill: 'transparent', stroke: 'black', strokeWidth: 2, originX: 'center', originY: 'center' }); }
  else if (subtype === 'hexagon') { return new fabric.Polygon([{ x: 25, y: 0 }, { x: 75, y: 0 }, { x: 100, y: 43 }, { x: 75, y: 86 }, { x: 25, y: 86 }, { x: 0, y: 43 }], { left: x, top: y, fill: 'transparent', stroke: 'black', strokeWidth: 2, originX: 'center', originY: 'center' }); }

  // Geometry 3D (Wireframe)
  else if (subtype === 'cube') {
    const s = 80; const o = 30;
    const front = new fabric.Rect({ width: s, height: s, fill: 'transparent', stroke: 'black', strokeWidth: 2 });
    const top = new fabric.Polygon([{ x: 0, y: s }, { x: o, y: s - o }, { x: s + o, y: s - o }, { x: s, y: s }], { fill: 'transparent', stroke: 'black', strokeWidth: 2 });
    const side = new fabric.Polygon([{ x: s, y: s }, { x: s + o, y: s - o }, { x: s + o, y: 2 * s - o }, { x: s, y: 2 * s }], { fill: 'transparent', stroke: 'black', strokeWidth: 2 });
    return new fabric.Group([front, top, side], { left: x, top: y, originX: 'center', originY: 'center', scaleX: 0.8, scaleY: 0.8 });
  }
  else if (subtype === 'cuboid') {
    const w = 120, h = 70, d = 30;
    const front = new fabric.Rect({ width: w, height: h, fill: 'transparent', stroke: 'black', strokeWidth: 2 });
    const top = new fabric.Polygon([{ x: 0, y: 0 }, { x: d, y: -d }, { x: w + d, y: -d }, { x: w, y: 0 }], { fill: 'transparent', stroke: 'black', strokeWidth: 2 });
    const side = new fabric.Polygon([{ x: w, y: 0 }, { x: w + d, y: -d }, { x: w + d, y: h - d }, { x: w, y: h }], { fill: 'transparent', stroke: 'black', strokeWidth: 2 });
    return new fabric.Group([front, top, side], { left: x, top: y, originX: 'center', originY: 'center', scaleX: 0.8, scaleY: 0.8 });
  }
  else if (subtype === 'cylinder') {
    const w = 60, h = 80;
    const e1 = new fabric.Ellipse({ rx: w / 2, ry: 10, fill: 'transparent', stroke: 'black', strokeWidth: 2, top: 0 });
    const e2 = new fabric.Ellipse({ rx: w / 2, ry: 10, fill: 'transparent', stroke: 'black', strokeWidth: 2, top: h });
    const l1 = new fabric.Line([0, 10, 0, h + 10], { stroke: 'black', strokeWidth: 2 });
    const l2 = new fabric.Line([w, 10, w, h + 10], { stroke: 'black', strokeWidth: 2 });
    return new fabric.Group([e1, e2, l1, l2], { left: x, top: y, originX: 'center', originY: 'center' });
  }

  // Tools
  else if (subtype === 'triangle-ruler') {
    return new fabric.Polygon([{ x: 0, y: 100 }, { x: 100, y: 100 }, { x: 0, y: 0 }], { left: x, top: y, fill: 'rgba(255,255,255,0.5)', stroke: 'black', strokeWidth: 2, originX: 'center', originY: 'center' });
  }

  return null;
};

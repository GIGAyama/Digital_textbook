/**
 * 評価スタンプ（はなまる・検印など）のベクター定義とプレビュー。
 *
 * 絵文字ではなく SVG で描いているのは、端末を問わず同じ見た目になり、
 * 拡大しても劣化しないため。児童のノートに大きく押されることがある。
 */
import React from 'react';

// ==========================================
// 評価スタンプ (ベクター描画・高品質版)
// 絵文字と違い端末を問わず同じ見た目で、拡大しても劣化しない
// ==========================================
export const STAMP_RED = '#e0392f';

// 中心(cx,cy)から外側へ向かう渦巻きのSVGパスを生成する
export const buildSpiralPath = (cx, cy, rStart, rEnd, turns) => {
  const steps = Math.round(turns * 36);
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2 - Math.PI / 2;
    const r = rStart + (rEnd - rStart) * t;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d.trim();
};

// 花びら状(スカラップ)の縁取りパスを生成する
export const buildFlowerPath = (cx, cy, r, petals, bulge) => {
  let d = '';
  for (let i = 0; i <= petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    const x = (cx + r * Math.cos(a)).toFixed(1);
    const y = (cy + r * Math.sin(a)).toFixed(1);
    if (i === 0) { d += `M ${x} ${y} `; continue; }
    const am = ((i - 0.5) / petals) * Math.PI * 2 - Math.PI / 2;
    const qx = (cx + (r + bulge) * Math.cos(am)).toFixed(1);
    const qy = (cy + (r + bulge) * Math.sin(am)).toFixed(1);
    d += `Q ${qx} ${qy} ${x} ${y} `;
  }
  return d.trim() + ' Z';
};

export const HANAMARU_FLOWER_PATH = buildFlowerPath(60, 60, 40, 9, 15);
export const HANAMARU_SPIRAL_PATH = buildSpiralPath(60, 60, 3, 27, 2.6);
export const SEAL_FLOWER_PATH = buildFlowerPath(60, 60, 46, 12, 8);
export const CHECK_PATH = 'M 24 62 L 50 88 L 96 30';
export const TRIANGLE_PATH = 'M 60 18 L 101 94 L 19 94 Z';

// 検印(ハンコ)型スタンプの定義。lines を縁取り内に配置する
export const SEAL_STAMPS = {
  'seal-taihen': { lines: ['たいへん', 'よく', 'できました'], border: 'flower', fontSize: 17 },
  'seal-yoku': { lines: ['よく', 'できました'], border: 'flower', fontSize: 18 },
  'seal-ganbari': { lines: ['がんばり', 'ました'], border: 'circle', fontSize: 20 },
  'seal-mimashita': { lines: ['みました'], border: 'circle', fontSize: 21 },
  'seal-goukaku': { lines: ['合', '格'], border: 'square', fontSize: 30 },
  'hyakuten': { lines: ['100点'], border: 'double', fontSize: 24 },
};

// fabric.js オブジェクトとして評価スタンプを組み立てる
export const createPremiumStamp = (subtype) => {
  if (!window.fabric) return null;
  const fabric = window.fabric;
  const stroke = {
    fill: 'transparent', stroke: STAMP_RED, strokeLineCap: 'round', strokeLineJoin: 'round',
    originX: 'center', originY: 'center', left: 0, top: 0,
  };
  const parts = [];

  const seal = SEAL_STAMPS[subtype];
  if (seal) {
    if (seal.border === 'flower') parts.push(new fabric.Path(SEAL_FLOWER_PATH, { ...stroke, strokeWidth: 4.5 }));
    else if (seal.border === 'double') {
      parts.push(new fabric.Circle({ radius: 50, ...stroke, strokeWidth: 4.5 }));
      parts.push(new fabric.Circle({ radius: 42, ...stroke, strokeWidth: 3 }));
    }
    else if (seal.border === 'square') parts.push(new fabric.Rect({ width: 78, height: 78, rx: 10, ry: 10, ...stroke, strokeWidth: 4.5 }));
    else parts.push(new fabric.Circle({ radius: 50, ...stroke, strokeWidth: 4.5 }));
    parts.push(new fabric.Text(seal.lines.join('\n'), {
      fontSize: seal.fontSize, fill: STAMP_RED, fontFamily: 'Zen Maru Gothic', fontWeight: '700',
      textAlign: 'center', lineHeight: 1.12, originX: 'center', originY: 'center', left: 0, top: 0,
    }));
  } else if (subtype === 'hanamaru') {
    parts.push(new fabric.Path(HANAMARU_FLOWER_PATH, { ...stroke, strokeWidth: 6 }));
    parts.push(new fabric.Path(HANAMARU_SPIRAL_PATH, { ...stroke, strokeWidth: 5 }));
  } else if (subtype === 'double-circle') {
    parts.push(new fabric.Circle({ radius: 46, ...stroke, strokeWidth: 6 }));
    parts.push(new fabric.Circle({ radius: 31, ...stroke, strokeWidth: 5 }));
  } else if (subtype === 'circle') {
    parts.push(new fabric.Circle({ radius: 46, ...stroke, strokeWidth: 6 }));
  } else if (subtype === 'triangle') {
    parts.push(new fabric.Path(TRIANGLE_PATH, { ...stroke, strokeWidth: 6 }));
  } else if (subtype === 'check') {
    parts.push(new fabric.Path(CHECK_PATH, { ...stroke, strokeWidth: 11 }));
  } else {
    return null;
  }

  return new fabric.Group(parts, { originX: 'center', originY: 'center', opacity: 0.95 });
};

// スタンプ一覧メニューでのプレビュー (キャンバス上と同じ形状データを共有)
export const StampPreview = ({ subtype }) => {
  const seal = SEAL_STAMPS[subtype];
  const strokeProps = { fill: 'none', stroke: STAMP_RED, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg viewBox="0 0 120 120" className="w-9 h-9" aria-hidden="true">
      {subtype === 'hanamaru' && (<>
        <path d={HANAMARU_FLOWER_PATH} {...strokeProps} strokeWidth="6" />
        <path d={HANAMARU_SPIRAL_PATH} {...strokeProps} strokeWidth="5" />
      </>)}
      {subtype === 'double-circle' && (<>
        <circle cx="60" cy="60" r="46" {...strokeProps} strokeWidth="6" />
        <circle cx="60" cy="60" r="31" {...strokeProps} strokeWidth="5" />
      </>)}
      {subtype === 'circle' && <circle cx="60" cy="60" r="46" {...strokeProps} strokeWidth="6" />}
      {subtype === 'triangle' && <path d={TRIANGLE_PATH} {...strokeProps} strokeWidth="6" />}
      {subtype === 'check' && <path d={CHECK_PATH} {...strokeProps} strokeWidth="11" />}
      {seal && (<>
        {seal.border === 'flower' && <path d={SEAL_FLOWER_PATH} {...strokeProps} strokeWidth="4.5" />}
        {seal.border === 'circle' && <circle cx="60" cy="60" r="50" {...strokeProps} strokeWidth="4.5" />}
        {seal.border === 'double' && (<>
          <circle cx="60" cy="60" r="50" {...strokeProps} strokeWidth="4.5" />
          <circle cx="60" cy="60" r="42" {...strokeProps} strokeWidth="3" />
        </>)}
        {seal.border === 'square' && <rect x="21" y="21" width="78" height="78" rx="10" {...strokeProps} strokeWidth="4.5" />}
        {seal.lines.map((line, i) => (
          <text
            key={i} x="60" y={60 + (i - (seal.lines.length - 1) / 2) * seal.fontSize * 1.12}
            textAnchor="middle" dominantBaseline="central" fill={STAMP_RED}
            fontSize={seal.fontSize} fontWeight="700" fontFamily="'Zen Maru Gothic', sans-serif"
          >{line}</text>
        ))}
      </>)}
    </svg>
  );
};

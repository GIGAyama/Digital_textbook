/**
 * ページの中で走らせる測定関数。コントラストと接触領域を実際の描画から測る。
 * どのリポジトリでも使い回せるよう、アプリ固有の前提を置かない。
 */
function probeA11y() {
    // Tailwind v4 は色を oklch() で書き出す。数字だけ拾うと
    // oklch(0.554 0.046 257.417) を rgb(0.554, 0.046, 257.417) と読み違え、
    // どれも「ほぼ真っ黒」と判定されて比が 1.0 付近になる。
    // fillStyle に代入して読み返しても oklch のまま返るので、1px 実際に塗って画素を読む。
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const cache = new Map();
    const parse = (s) => {
        if (!s) return [0, 0, 0, 1];
        if (cache.has(s)) return cache.get(s);
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = s;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        const a = d[3] / 255;
        const out = a === 0 ? [0, 0, 0, 0]
            : [Math.min(255, d[0] / a), Math.min(255, d[1] / a), Math.min(255, d[2] / a), a];
        cache.set(s, out);
        return out;
    };
    const lum = ([r, g, b]) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = (fg, bg) => {
        const a = fg[3] ?? 1;
        return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
    };
    // 背景はグラデーションのことがある。backgroundColor だけ見ると
    // 「透明」と出て白扱いになり、白地に白（比 1.0）という誤報になる。
    const bgOf = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
            const cs = getComputedStyle(n);
            if (cs.backgroundImage && cs.backgroundImage !== 'none') {
                const cols = cs.backgroundImage.match(/(rgba?|oklch|oklab|hsla?|color)\([^)]*\)|#[0-9a-f]{3,8}/gi);
                if (cols) return parse(cols[0]).slice(0, 3);
            }
            const c = parse(cs.backgroundColor);
            if ((c[3] ?? 1) > 0.95) return c.slice(0, 3);
            n = n.parentElement;
        }
        return [255, 255, 255];
    };
    // 絵文字はフォント自身の色で描かれ、CSS の color は効かない。数えると誤報になる。
    const isEmoji = (s) => {
        for (const ch of s) {
            const c = ch.codePointAt(0);
            if ((c >= 0x1f300 && c <= 0x1faff) || (c >= 0x2600 && c <= 0x27bf) || c === 0xfe0f) return true;
        }
        return false;
    };
    const visible = (el) => {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    };

    const contrast = [];
    for (const el of document.querySelectorAll('*')) {
        const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
        if (!text || isEmoji(text) || !visible(el)) continue;
        const cs = getComputedStyle(el);
        const bg = bgOf(el);
        const fg = over(parse(cs.color), bg);
        const L1 = lum(fg), L2 = lum(bg);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
        const need = large ? 3 : 4.5;
        if (ratio < need) {
            contrast.push({
                text: text.slice(0, 28), ratio: +ratio.toFixed(2), need, size, color: cs.color,
                cls: (typeof el.className === 'string' ? el.className : '').slice(0, 160),
                oyaCls: (typeof el.parentElement?.className === 'string' ? el.parentElement.className : '').slice(0, 160),
            });
        }
    }

    const taps = [];
    for (const el of document.querySelectorAll('button, a[href], input[type=button], input[type=checkbox], input[type=radio], select')) {
        if (!visible(el)) continue;
        if (el.disabled) continue;
        // チェックボックスやラジオは、囲みの <label> ごと押せる。
        // input 単体を測ると必ず落ちるが、実際に指が届く範囲はラベル全体。
        const box = el.closest('label') || el;
        const r = box.getBoundingClientRect();
        // ::after で当たり判定だけ広げている場合があるので、その分を足して見る
        const after = getComputedStyle(box, '::after');
        const w = Math.max(r.width, parseFloat(after.minWidth) || 0);
        const h = Math.max(r.height, parseFloat(after.minHeight) || 0);
        // 端数で 43.98px になることがある。0.5px はブラウザの丸め誤差として許す。
        if (w < 43.5 || h < 43.5) {
            taps.push({
                tag: el.tagName,
                text: (el.textContent || '').trim().slice(0, 24) || el.getAttribute('aria-label') || '(なし)',
                w: +w.toFixed(1), h: +h.toFixed(1),
                cls: (typeof el.className === 'string' ? el.className : '').slice(0, 200),
            });
        }
    }
    return { contrast, taps };
}

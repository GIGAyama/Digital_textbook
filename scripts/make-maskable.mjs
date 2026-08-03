/**
 * maskable アイコンを作り直す。
 *
 * なぜ必要か：
 *   これまで maskable として配っていた画像は、実体が「白い余白のついた
 *   角丸アイコン」だった。maskable は Android が端末ごとに違う形
 *   （円・角丸四角・しずく型）で切り抜く前提の画像で、切り抜かれても
 *   困らないよう、中央80%の円（セーフゾーン）の外は「消えてよい部分」に
 *   しておく必要がある。
 *
 *   元の画像は、青い角丸四角の四隅と、えんぴつの先がセーフゾーンを
 *   はみ出していた。円で切り抜かれると角が落ち、えんぴつの先も欠ける。
 *
 * どう直すか（3段階）：
 *   1. 角丸の「外側の白」だけを透明にする。画像の縁から白がつながっている
 *      範囲を塗りつぶしていくので、本のページの白（内側にある）は残る。
 *   2. 青い下地をアイコンの端まで伸ばす。色は元の絵のグラデーションから拾った。
 *      こうするとどんな形で切り抜かれても「青が青に切られる」だけで、
 *      欠けたように見えない。
 *   3. 絵の中身（本・えんぴつ・歯車）がセーフゾーンに収まる倍率を、
 *      実際に画素を数えながら自動で探す。
 *
 *   purpose:"any" のアイコン（pwa-192 / pwa-512 / favicon /
 *   apple-touch-icon）は切り抜かれないので、一切変更しない。
 *
 *   node scripts/make-maskable.mjs
 */
import sharp from 'sharp';
import { existsSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, '.assets-original', 'pwa-maskable-512x512.png');
const SIZE = 512;

// 元の絵の青い下地から拾ったグラデーション。上が明るい水色、下が濃い青。
const TOP = '#4bc0f5';
const BOTTOM = '#4a72dc';

if (!existsSync(SRC)) {
    console.error('[make-maskable] 元画像がありません: ' + SRC);
    process.exit(1);
}

// --- 1. 角丸の外側の白を透明にする ------------------------------------
// 画像の縁から「白がつながっている範囲」を辿って消す。内側にある本の
// ページの白は縁とつながっていないので残る。
const trimmed = await sharp(SRC).trim({ threshold: 10 }).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
{
    const { data, info } = trimmed;
    const { width: W, height: H, channels: C } = info;
    const isWhite = (i) => data[i + 3] < 16 || (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240);
    const seen = new Uint8Array(W * H);
    const stack = [];
    const push = (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        const n = y * W + x;
        if (seen[n]) return;
        seen[n] = 1;
        if (!isWhite(n * C)) return;
        stack.push(n);
    };
    for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
    for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
    while (stack.length) {
        const n = stack.pop();
        data[n * C + 3] = 0;
        const x = n % W, y = (n / W) | 0;
        push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
}
const artClean = await sharp(trimmed.data, {
    raw: { width: trimmed.info.width, height: trimmed.info.height, channels: trimmed.info.channels },
}).png().toBuffer();

// --- 2 + 3. 下地を全面に敷き、中身が収まる倍率を探す --------------------
const background = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%" stop-color="${TOP}"/>
           <stop offset="100%" stop-color="${BOTTOM}"/>
         </linearGradient>
       </defs>
       <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
     </svg>`
);

const compose = async (ratio) => {
    const s = Math.round(SIZE * ratio);
    const art = await sharp(artClean)
        .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer();
    return sharp(background).composite([{ input: art, gravity: 'center' }]).png().toBuffer();
};

// セーフゾーンの外に「中身」が何画素あるかを数える。
// 青い下地・青い枠は B が R より十分大きい。本の白紙・えんぴつのオレンジ・
// 歯車の灰色はそうならないので、それを「中身」とみなす。
const contentOutside = async (buf) => {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: C } = info;
    const cx = W / 2, cy = H / 2, R = W * 0.4;
    let out = 0, total = 0;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (Math.hypot(x - cx, y - cy) <= R) continue;
            total++;
            const i = (y * W + x) * C;
            if (!(data[i + 2] > data[i] + 30)) out++;
        }
    }
    return out / total;
};

let chosen = null;
for (let ratio = 0.90; ratio >= 0.60; ratio -= 0.02) {
    const buf = await compose(ratio);
    const ratioOut = await contentOutside(buf);
    if (ratioOut <= 0.002) { chosen = { ratio, buf, ratioOut }; break; }
}

if (!chosen) {
    console.error('❌ 中身をセーフゾーンに収められなかった。元画像を見直すこと。');
    process.exit(1);
}

for (const [name, size, limit] of [
    ['pwa-maskable-512x512.png', 512, 61440],
    ['pwa-maskable-192x192.png', 192, 30720],
]) {
    let best = null;
    for (const colours of [256, 192, 128, 96, 64]) {
        const buf = await sharp(chosen.buf)
            .resize(size, size)
            .png({ palette: true, colours, effort: 10, compressionLevel: 9 })
            .toBuffer();
        best = { buf, colours };
        if (buf.length <= limit) break;
    }
    const out = join(ROOT, 'public', name);
    writeFileSync(out, best.buf);
    console.log(`${name}  ${(statSync(out).size / 1024).toFixed(1)} KB (${best.colours}色)`);
}

console.log(`\n絵の倍率: ${(chosen.ratio * 100).toFixed(0)}%`);
console.log(`セーフゾーン（中央80%の円）の外に出ている「中身」: ${(chosen.ratioOut * 100).toFixed(2)}%`);
console.log('✅ 外側は下地の青だけ。どの形で切り抜かれても欠けて見えない。');

/**
 * アイコン画像を圧縮し、足りないサイズを生成する。
 *
 * なぜ必要か：
 *   アイコンだけで 704KB あり、アプリ本体より重かった。校内Wi-Fiに
 *   40人が同時につなぐと、この 704KB が初回表示をまるごと遅らせる。
 *   アイコンは元が単純な絵なので、色数を落としても見た目はほぼ変わらない。
 *
 * 元画像は .assets-original/ に退避してある（git には入れない）。
 * 画質が気に入らなければ、そこから戻して数値を調整すればよい。
 *
 *   node scripts/optimize-icons.mjs
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, copyFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const ORIG = join(ROOT, '.assets-original');

// [出力名, 元にする画像, 出力サイズ, 目標バイト数]
// favicon はタブに 16〜32px で出るだけなので、512 のままなのは無駄。
// PWA アイコンは仕様で決まったサイズなので寸法は変えない。
const JOBS = [
    ['favicon.png', 'favicon.png', 256, 30 * 1024],
    ['pwa-192x192.png', 'pwa-192x192.png', 192, 40 * 1024],
    ['pwa-512x512.png', 'pwa-512x512.png', 512, 60 * 1024],
    ['pwa-maskable-512x512.png', 'pwa-maskable-512x512.png', 512, 60 * 1024],
    // 192 の maskable が無く、Android のホーム画面で 512 を縮めて使われていた
    ['pwa-maskable-192x192.png', 'pwa-maskable-512x512.png', 192, 30 * 1024],
    ['apple-touch-icon.png', 'apple-touch-icon.png', 180, 30 * 1024],
];

if (!existsSync(ORIG)) mkdirSync(ORIG, { recursive: true });

// 元画像をまだ退避していなければ、いま退避する（上書き圧縮で原本を失わないため）
for (const [, from] of JOBS) {
    const src = join(PUB, from);
    const bak = join(ORIG, from);
    if (existsSync(src) && !existsSync(bak)) copyFileSync(src, bak);
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const rows = [];

for (const [out, from, size, target] of JOBS) {
    const src = join(ORIG, from);
    if (!existsSync(src)) {
        console.error('[optimize-icons] 元画像がありません: ' + src);
        process.exit(1);
    }
    const before = statSync(src).size;

    // 色数を段階的に落として、目標サイズに収まる中でいちばん高画質なものを採る。
    // いきなり最低画質にすると、グラデーションに縞が出て安っぽく見える。
    let best = null;
    for (const colours of [256, 192, 128, 96, 64, 48, 32]) {
        const buf = await sharp(src)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png({ palette: true, colours, effort: 10, compressionLevel: 9 })
            .toBuffer();
        best = { buf, colours };
        if (buf.length <= target) break;
    }

    // sharp に通し直すと減色した結果がフルカラーに戻ってしまうので、
    // 出来上がったバイト列をそのまま書き出す。
    writeFileSync(join(PUB, out), best.buf);
    const after = statSync(join(PUB, out)).size;
    rows.push({ out, before, after, colours: best.colours, ok: after <= target });
}

console.log('\n| ファイル | 圧縮前 | 圧縮後 | 削減 | 色数 |');
console.log('|---|---:|---:|---:|---:|');
let sumB = 0, sumA = 0;
for (const r of rows) {
    sumB += r.before; sumA += r.after;
    const cut = Math.round((1 - r.after / r.before) * 100);
    console.log(`| ${r.out} | ${kb(r.before)} | ${kb(r.after)} | −${cut}% | ${r.colours} |`);
}
console.log(`| **合計** | **${kb(sumB)}** | **${kb(sumA)}** | **−${Math.round((1 - sumA / sumB) * 100)}%** | |`);

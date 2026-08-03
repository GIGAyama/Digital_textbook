/**
 * node_modules から、ブラウザにそのまま渡せるビルド済みファイルを
 * public/vendor/ へコピーする。
 *
 * なぜこれが必要か：
 *   以前は pdf.js や fabric.js を cdnjs / jsDelivr から実行時に読み込んでいた。
 *   これには3つの問題があった。
 *     1. 配信元が改ざんされると、児童の端末で任意のコードが動いてしまう
 *        （integrity 属性も付いていなかった）
 *     2. 学校のフィルタリングが CDN のドメインを塞いでいると、アプリが起動しない
 *     3. 外部ドメインからスクリプトを読む前提だと CSP を厳しくできない
 *   同じ配信元（自分のサイト）から配ることで、3つとも同時に解決する。
 *
 * なぜ public/vendor/ を git にコミットしないか：
 *   合計 2MB 近くあり、リポジトリが重くなる。package.json にバージョンを
 *   固定してあるので、npm ci → このスクリプト、でいつでも同じものが再現できる。
 */
import { existsSync, mkdirSync, copyFileSync, statSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'vendor');

// [node_modules からの相対パス, 出力ファイル名]
// 出力ファイル名は、以前 CDN から読んでいた URL の末尾と揃えてある。
const FILES = [
    ['pdfjs-dist/build/pdf.min.js', 'pdf.min.js'],
    ['pdfjs-dist/build/pdf.worker.min.js', 'pdf.worker.min.js'],
    ['fabric/dist/fabric.min.js', 'fabric.min.js'],
    ['idb-keyval/dist/umd.js', 'idb-keyval.umd.js'],
    ['jsqr/dist/jsQR.js', 'jsQR.js'],
    ['peerjs/dist/peerjs.min.js', 'peerjs.min.js'],
    ['qrcode/build/qrcode.js', 'qrcode.min.js'],
];

// 古いファイルが残っていると、バージョンを上げたのに古い方が
// 配られる事故が起きる。毎回まるごと作り直す。
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let total = 0;
const missing = [];

for (const [from, to] of FILES) {
    const src = join(ROOT, 'node_modules', from);
    if (!existsSync(src)) {
        missing.push(from);
        continue;
    }
    copyFileSync(src, join(OUT, to));
    total += statSync(src).size;
}

if (missing.length > 0) {
    console.error('[sync-vendor] 次のファイルが見つかりませんでした:');
    for (const m of missing) console.error('  - node_modules/' + m);
    console.error('[sync-vendor] `npm ci` を実行してから、もう一度試してください。');
    process.exit(1);
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('[sync-vendor] public/vendor/ に ' + readdirSync(OUT).length + ' 本コピーしました (合計 ' + kb(total) + ')');

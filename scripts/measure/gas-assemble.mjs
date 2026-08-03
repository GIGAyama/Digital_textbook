/**
 * GAS のウェブアプリを、ローカルのブラウザで開ける1枚の HTML に組み立てる。
 *
 * 本番（script.google.com）へはこの作業環境から到達できない。
 * しかし GAS が返す画面は index.html + css.html + js.html を貼り合わせたものなので、
 * 同じ貼り合わせを手元でやれば、**表示まわりは本物と同じものを測れる**。
 *
 * サーバー側（google.script.run）は差し替えのダミーを入れる。
 * 見た目・コントラスト・タップ領域・安全領域は、これで実測できる。
 * サーバーの戻り値に依存する画面は測れないので、その旨を出力に残す。
 *
 *   node gas-assemble.mjs /workspace/<repo> [出力先ディレクトリ]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const root = process.argv[2];
const outDir = process.argv[3] || '/tmp/gasserve';
if (!root) { console.error('使い方: node gas-assemble.mjs /workspace/<repo> [出力先]'); process.exit(2); }

const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null);

let html = read('index.html');
if (!html) { console.error('index.html がありません'); process.exit(2); }

// <?!= include('css'); ?> を実体に置き換える
const included = [];
html = html.replace(/<\?!?=?\s*include\s*\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*\?>/g, (m, name) => {
    const body = read(name + '.html');
    if (body === null) return `<!-- include('${name}') は見つからなかった -->`;
    included.push(name + '.html');
    return body;
});

// 残っているスクリプトレット（<?= isSetup ?> など）は、初期設定が済んだ状態として畳む
const scriptlets = [...html.matchAll(/<\?[\s\S]*?\?>/g)].map((m) => m[0].slice(0, 60));
html = html.replace(/<\?[\s\S]*?\?>/g, '');

/*
 * google.script.run のダミー。
 * GAS の本物は「サーバーの関数名を呼ぶと非同期で結果が返る」だけなので、
 * 同じ形にしておけば画面は最後まで描画される。
 * 返り値は空にしてあるので、データが要る画面は「0件」の見た目になる。
 */
const stub = `
<script>
window.__gasCalls = [];
(function () {
  const make = (handlers) => new Proxy({}, {
    get(_, name) {
      if (name === 'withSuccessHandler') return (fn) => make({ ...handlers, ok: fn });
      if (name === 'withFailureHandler') return (fn) => make({ ...handlers, ng: fn });
      if (name === 'withUserObject') return () => make(handlers);
      return (...args) => {
        window.__gasCalls.push({ fn: String(name), args });
        setTimeout(() => { try { handlers.ok && handlers.ok(null); } catch (e) { console.warn(e); } }, 0);
      };
    },
  });
  window.google = window.google || {};
  window.google.script = { run: make({}), host: { close() {}, setHeight() {}, setWidth() {} }, url: { getLocation(f){ f({parameter:{}}); } } };
})();
</script>
`;
html = html.replace(/<\/body>/i, stub + '</body>');

/*
 * この作業環境では jsDelivr へ出られない（プロキシが塞いでいる）。
 * そのままだと Bootstrap が当たらない素の HTML を測ることになり、
 * コントラストもタップ領域も本物とまったく別の数字になる。
 * npm から取った同じ版をローカルに置いて、そこへ向け直す。
 * **書き換えるのはこの検査用の複製だけで、リポジトリには手を入れない。**
 */
const MIRROR = process.env.CDN_MIRROR || 'http://127.0.0.1:8990';
html = html.replace(/https:\/\/cdn\.jsdelivr\.net/g, MIRROR);

mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'index.html');
writeFileSync(outFile, html);

console.log(JSON.stringify({
    リポジトリ: basename(root),
    出力: outFile,
    取り込んだファイル: included,
    畳んだスクリプトレット: scriptlets,
    バイト数: Buffer.byteLength(html),
}, null, 2));

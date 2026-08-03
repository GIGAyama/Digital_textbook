# 実測用の道具

GIGA Standard v4 の点検を「読んで判断する」から「測って判断する」に変えるための道具。
57本のリポジトリを1本ずつ回すので、**1回の投資で全部に効く**ものだけをここに置く。

このディレクトリは Digital_textbook のビルドには関与しない。
どのリポジトリに対しても外から実行する。

---

## なぜ必要か

**読むだけでは分からないことが多すぎる。** 実際に取りこぼした例：

- `sw.js` は正しく書かれているのに、登録側の書き方のせいで一度も登録されない
- Tailwind v4 は色を `oklch()` で返すので、素朴なコントラスト計算が全部壊れる
- CDN が学校のフィルタリングで塞がれていると、Bootstrap が当たらない
  **素の HTML を測ってしまい、まったく別の数字が出る**
- `frame-ancestors` は `<meta>` では無視される（書いても意味がない）

---

## `audit-repo.mjs` — リポジトリを1本ずつ実測する

```bash
node scripts/measure/audit-repo.mjs /workspace/<repo>
```

型（A/B/C/C+/D）を判定し、法務・セキュリティ・堅牢性・表示・PWA・a11y・画像を
JSON で出す。**判定できないものは `null` を返し、勝手に ✅ を付けない。**

AUDIT.md はこの出力をもとに書く。

## `probe-a11y.js` — ブラウザの中で走らせる測定関数

コントラスト比とタップ領域を、**実際に描画された色と寸法**から測る。
Playwright の `page.evaluate()` に文字列として渡して使う。

落とし穴を3つ踏んであるので、そのまま使うこと。

1. **`oklch()`** — Tailwind v4 の色。数字だけ拾うと
   `oklch(0.554 0.046 257.417)` を `rgb(0.554, 0.046, 257.417)` と読み違え、
   どの要素も「ほぼ真っ黒」と判定されて比が 1.0 付近になる。
   `ctx.fillStyle` に代入して読み返しても `oklch` のまま返るので、
   **1px 実際に塗って `getImageData` で読む。**
2. **グラデーション背景** — `backgroundColor` が透明になる。
   `backgroundImage` を見ないと「白の上の白（比 1.0）」という誤報になる。
3. **絵文字** — フォント自身の色で描かれ、CSS の `color` は効かない。除外しないと誤報。

タップ領域は、疑似要素（`.tap-44::after`）で当たり判定だけ広げている場合と、
チェックボックスが `<label>` に包まれている場合を考慮して測る。

## `gas-assemble.mjs` — GAS のウェブアプリを手元で開ける形にする

```bash
node scripts/measure/gas-assemble.mjs /workspace/<repo> /tmp/gasserve
cd /tmp/gasserve && python3 -m http.server 8975
```

本番（`script.google.com`）へは作業環境から到達できない。
しかし GAS が返す画面は `index.html` + `css.html` + `js.html` を貼り合わせたものなので、
**同じ貼り合わせを手元でやれば、表示まわりは本物と同じものを測れる。**

- `<?!= include('css'); ?>` を実体に置き換える
- 残ったスクリプトレットは畳む
- `google.script.run` のダミーを入れて、画面が最後まで描画されるようにする

**測れないもの**：サーバーの戻り値に依存する画面。ダミーは空を返すので「0件」の見た目になる。

## `gas-measure.mjs` — 組み立てた画面を測る

```bash
node scripts/measure/gas-measure.mjs http://127.0.0.1:8975/ shot.png
```

---

## CDN のローカル控え（重要）

この作業環境は `cdn.jsdelivr.net` へ出られない。
**そのまま測ると Bootstrap が当たらない素の HTML を測ることになり、数字が意味を失う。**
実際、体育ノートでは控えを用意する前が「コントラスト6件・タップ6件」、
用意したあとが「2件・1件」だった。**前者は全部でたらめ。**

npm から同じ版を取って、jsDelivr と同じ形のパスで並べる。

```bash
mkdir -p /tmp/cdnmirror/npm && cd /tmp/cdnlocal
for p in bootstrap@5.3.0 bootstrap-icons@1.11.3 chart.js sweetalert2@11; do npm pack $p; done
# 展開して /tmp/cdnmirror/npm/<パッケージ>/... へ配置し
cd /tmp/cdnmirror && python3 -m http.server 8990
```

`gas-assemble.mjs` が `https://cdn.jsdelivr.net` を `$CDN_MIRROR`（既定 `http://127.0.0.1:8990`）
へ向け直す。**書き換えるのは検査用の複製だけで、リポジトリには手を入れない。**

Google Fonts はこの環境では塞がれたままにしてある。
**フィルタリングされた学校とまったく同じ状態で測れる**ので、そのほうが都合がよい。

---

## 測ったあとにやること

数字は AUDIT.md に、直し方は各リポジトリのコードに、
**他のリポジトリでも効く知見は [ROLLOUT.md](../../ROLLOUT.md) に**書く。

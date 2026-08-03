# GIGA Standard v4 ロールアウト記録

## 進捗

| リポジトリ | 型 | P0 | P1(表示/PWA) | P2 | P3 | ゲート | 備考 |
|---|---|:--:|:--:|:--:|:--:|:--:|---|
| Digital_textbook | B | ✅ | ✅ | ✅ | ✅ | ✅ | 第3群。CDN自己ホスト化＋CSP まで実施 |

## Digital_textbook でやったこと

診断は [AUDIT.md](./AUDIT.md) に、改修後の再実測も同じファイルの後半にある。

| フェーズ | コミット | 内容 |
|---|---|---|
| 監査 | `audit:` | 実測のみ。コードは変更していない |
| P0 | `p0(legal):` | LICENSE / dependabot / `.env` の追跡停止 / `npm audit fix` |
| P1 | `p1(display/pwa):` | CDN 自己ホスト化・CSP・safe-area・fluid type・DPR補正・44px・reduced-motion・提示モード・印刷・インストールボタン・更新通知・offline.html・a11y |
| P2 | `p2(perf):` | アイコン 704KB → 128KB、maskable-192 追加、`<img>` に width/height |
| P3+P4 | `p3(docs)+p4(gate):` | MANUAL.md / README 追補 / 品質ゲート＋CI |

## このリポジトリで分かった、他にも効きそうな知見

### 1. CDN 依存は「セキュリティ」より先に「起動しない」問題として現れる

このアプリは pdf.js など7本を cdnjs / jsDelivr から実行時に読んでいた。
SRI が無いのでサプライチェーンの穴でもあるが、現場で先に効くのは
**学校のフィルタリングが CDN ドメインを塞いでいると起動すらしない**という点。
自己ホスト化すると、この問題と CSP の両方が同時に片付く。

npm でバージョンを固定 → `scripts/sync-vendor.mjs` で `public/vendor/` へ展開 →
`.gitignore` で除外、という形にした。**この構成は他の A型・B型にもそのまま移植できる。**

### 2. vendor は先読みキャッシュに入れてはいけない

`public/vendor/` は合計2MB ある。workbox の `globPatterns` にそのまま任せると
先読みキャッシュが 2MB を超え、40人が同時に開く校内Wi-Fiで初回表示が止まる。
`globIgnores: ['vendor/**']` で外し、同一オリジンの `/vendor/` に対する
`CacheFirst` の runtimeCaching を1本足すのが正解。
実測で、オフライン起動・オフラインでの PDF 取り込みまで問題なく動いた。

### 3. タップ領域44pxは「ボタンを大きくする」と必ずレイアウトが壊れる

ツールバーが密に組まれているアプリで `min-height: 44px` をボタンに直接当てると、
折り返しが起きて別の破綻を生む。**疑似要素で当たり判定だけを広げる**と、
見た目を一切変えずに要件を満たせる。

```css
button::after {
  content: ""; position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 100%; height: 100%; min-width: 44px; min-height: 44px;
}
```

### 4. `Esc` は既存の「戻る」処理に接続するのが安全

このアプリには、重なったモーダル・メニュー・全画面を上から1つずつ閉じる
`handleBackNavigation` がすでにあった（スマホの戻るジェスチャー用）。
`Esc` を新規に実装せずここへ繋ぐと、**挙動が戻る操作と完全に一致**し、
実装量も数行で済む。同種の作りがある他アプリでも同じ手が使える。

### 5. PDF の描画倍率は「取り込んだ端末の DPR」で決めてはいけない

P2P で別の端末へ配るアプリでは、取り込んだ端末の `devicePixelRatio` は
配布先で当てにならない。固定値（このアプリでは 2）で決め打つのが正しい。
1.5 では2倍表示の Chromebook・iPad で教科書の細い文字がぼやけ、
3 にすると1ページの面積が4倍になってメモリ4GB機が落ちる。

### 6. 品質ゲートは正本を一字も変えずにコピーし、差分は別ファイルに置く

`SchoolPlan_Editor/scripts/lib/project-quality.mjs` は GAS 向けなので、
静的サイト型のリポジトリでは書き換えたくなる。しかしそれをやると、
正本が更新されたときに 57 リポジトリ分の差分を手で解く羽目になる。

**正本はバイト単位でコピー（md5 一致を確認）し、
Part I の検査は `scripts/lib/giga-v4-checks.mjs` に分ける。**
`check-project.mjs` が両者を合成する。この形なら正本の更新は丸ごと差し替えで済む。

なお正本は `package-lock.json` を「大きすぎるファイル」として警告するため、
`quality.config.json` の `maintainability.ignoreLargeFiles` で除外できるようにした。

### 7. ゲートは必ず「わざと壊して」通ることを確認する

検査を書いたら、対象を意図的に壊して error が出るか確かめる。
今回 6か所壊して 5件を検知し、終了コード1で落ちることを確認した
（残る1件は、より上位の `CSP_MISSING` が先に出るため。想定どおり）。
**「0 error でした」だけでは、検査が動いているのか何も見ていないのか区別できない。**

## 次に着手するときに人間が決めること（未決）

- `School_plan_note` と `SchoolPlan_Editor` のどちらを正本にするか
- `online-manuscript-paper` / `-lite` / `-pro` / `Online-Publisher-pro` の4系統の整理方針
- `studyLog.js` の正本をどのリポジトリに置くか
- `scripts/lib/giga-v4-checks.mjs` を、どのリポジトリに正本として置くか
  （静的サイト型が多いので、GAS 向け正本とは別に1本必要になる）

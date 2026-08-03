# ✅ GIGA Standard v4 監査：デジタル教科書メーカー

- **リポジトリ**：`GIGAyama/Digital_textbook`
- **監査日**：2026-08-03
- **アーキテクチャ判定**：**B型（Vite + React）** — `vite.config.js` あり／`base: '/Digital_textbook/'` 設定済み
- **規模**：`src/App.jsx` 3,112行 / 169KB（単一ファイル）、ビルド後 JS 258KB（gzip 76KB）
- **監査方法**：実測のみ（`grep` / `npm run build` / `npm audit` / PNG ヘッダ解析）。推測値は「未検証」と明記した。

> このドキュメントはコードを一切変更していない時点の記録である。

---

## 判定記号

| 記号 | 意味 |
|:--:|---|
| ✅ | 基準を満たす |
| ⚠️ | 部分的・条件付きで満たす（要改善） |
| ❌ | 満たさない |
| — | 該当しない（N/A） |

---

## A. 法務・配布

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| A1 | LICENSE 実ファイル | ❌ | ファイル無し。`README.md:248` に「MIT License」と記載があるだけで、実体が無い | **P0** |
| A2 | .gitignore | ⚠️ | 存在するが `.env` が列挙されていない → **`.env` がコミット済み**（`git log` → `ed25ef3 Add Google Client ID to environment variables`） | **P0** |
| A3 | dependabot.yml | ❌ | `.github/dependabot.yml` 無し（`.github/workflows/deploy.yml` のみ） | **P0** |
| A4 | README.md / MANUAL.md 両方 | ⚠️ | `README.md` は充実（10.5KB）。`MANUAL.md`（先生向け・専門用語ゼロ）が**無い** | **P3** |

---

## B. セキュリティ

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| B1 | CSP（connect-src が最小） | ❌ | `Content-Security-Policy` を含む HTML **0件** | **P1-9** |
| B2 | 秘密情報・IDの直書きなし | ⚠️ | ① `.env`（1変数）がリポジトリに追跡されている ② `src/App.jsx:40` に同じ値がフォールバックとして直書き。<br>※値の性質上ブラウザに露出する種類の識別子であり「鍵」ではないが、`.env` を追跡する運用は事故の温床。**値は本書に転記しない** | **P0** |
| B3 | OAuthスコープ最小 | ✅ | `src/App.jsx:41` → `https://www.googleapis.com/auth/drive.file` のみ。`auth/drive`（全体）・`https://mail.google.com/` は**不使用** | — |
| B4 | postMessage の宛先が `*` でない | ✅ | 該当箇所 0件 | — |
| B5 | サーバー側5段ガード | — | サーバーを持たない設計（P2P + ローカル保存）のため対象外 | — |
| **B6** | **外部スクリプトの完全性検証** | ❌ | `src/App.jsx:522-529` で **CDN から7本を実行時ロード**（pdf.js / pdf.worker / fabric.js / idb-keyval / jsQR / peerjs / qrcode）。`integrity`（SRI）**なし**。CDN が汚染された場合、児童の端末で任意コードが走る。オフライン初回起動も不可 | **P1-9** |

---

## C. 堅牢性

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| C1 | LockService + try/finally | — | GAS 不使用 | — |
| C2 | 自動復旧（シート再生成） | — | GAS 不使用 | — |
| C3 | pagehide で記録確定 | ✅ | `src/App.jsx:1591-1592` で `visibilitychange` + `pagehide` の両方を購読し flush。Chromebook のタブ破棄対策として適切 | — |
| C4 | 通信失敗時のリトライと明示 | ⚠️ | CDN 読込失敗はエラー画面に出るが（`src/App.jsx:531-533`）、**リトライ機構なし**。校内 Wi-Fi が詰まると起動できない | **P1-9** |
| C5 | localStorage.clear() を使っていない | ✅ | 該当箇所 0件。すべて `digital_textbook*` 接頭辞のキー単位で操作 | — |

---

## D. 表示（Part I §2）

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| D1 | viewport に `viewport-fit=cover` | ✅ | `index.html:8` 完全一致。`user-scalable=no` も付いていない（拡大可能＝良い） | — |
| D2 | `100dvh` を使用 | ✅ | `h-dvh` 3箇所・`max-h-[90dvh]` 1箇所。`100vh` の単独使用 **0件** | — |
| D3 | safe-area-inset を適用 | ❌ | `safe-area-inset` **0件**。iPad 横向きのノッチ側、iPhone のホームバー下で UI が欠ける | **P1-3** |
| D4 | clamp() による fluid type | ❌ | `clamp(` **0件**。Tailwind の固定サイズのみ。行間も `1.8` を確保していない | **P1-5** |
| D5 | Canvas に DPR 補正（上限2） | ⚠️ | `devicePixelRatio` の記述 **0件**。<br>・書き込み用 fabric キャンバス（`:1647`）は fabric v5 の `enableRetinaScaling` 既定 true で救われているが、**上限2のクランプが無く**、3倍端末で 9倍面積を確保しメモリ4GB機が落ちうる<br>・PDF ページ描画（`:1108`）は `scale: 1.5` 固定＋`toDataURL('image/jpeg', 0.8)` で、高DPI機では**教科書の文字がぼやける**<br>・QR 解析用の生 Canvas（`:751` `:771`）は補正なし | **P1-4** |
| D6 | 320px 幅で横スクロールが出ない | ⚠️ | **未検証**（実機/DevTools 確認が必要）。ホーム画面のボタン群（`:2361-2375`）が `flex-wrap` で組まれている一方、編集画面のツールバーは横並び要素が多く、リスクあり | **P1-6** |
| D7 | 画像に width/height、150KB以下 | ❌ | `<img>` は 1箇所のみで `width`/`height`/`loading` **なし**。`public/` の PNG は下表のとおり全て基準超過 | **P2** |
| D8 | コントラスト 4.5:1 以上 | ⚠️ | **未計測**。`text-slate-400`（#94a3b8、白背景で 2.8:1）が本文級の情報（最終保存日時など `:2404`）に使われており、Chromebook の安価な液晶では読みにくい | **P1-5** |
| D9 | タップ領域 44px 以上・touch-action | ❌ | `py-1.5`（≈30px 高）・`p-1.5`（≈33px）のボタンが多数（`:594` `:597` `:606-608` ほか）。`touch-action` の指定 **0件** | **P1-6** |
| D10 | prefers-reduced-motion 対応 | ❌ | **0件**。`animate-spin` `animate-pulse` `animate-in zoom-in-95` が常時動く。感覚過敏の児童への配慮が無い | **P1-7** |
| D11 | 提示モード | ❌ | フルスクリーンAPI はあるが、**文字を大きくする提示モードは無い**。電子黒板で後方席から読めない | **P1** |
| D12 | 印刷CSS | ❌ | `@media print` **0件**。書き込んだプリントを紙で配れない | **P1** |

### `public/` 画像の実測

| ファイル | 寸法 | 現在 | 基準 | 判定 |
|---|---|---:|---:|:--:|
| `favicon.png` | 512×512 | **109KB** | 30KB | ❌ |
| `pwa-192x192.png` | 192×192 | **82KB** | — | ❌ |
| `pwa-512x512.png` | 512×512 | **124KB** | 60KB | ❌ |
| `pwa-maskable-512x512.png` | 512×512 | **337KB** | 60KB | ❌ |
| `apple-touch-icon.png` | 180×180 | **52KB** | — | ⚠️ |
| **合計** | | **704KB** | | |

> favicon が 512×512 なのは過剰。アイコンだけで初回転送 704KB を占め、**総アセット 1MB 制限（実測 1,002KiB）をほぼ使い切っている**。

---

## E. PWA（Part I §3）

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| E1 | manifest の id/scope/start_url がリポジトリ名絶対パス | ✅ | `vite.config.js` → `id`/`scope`/`start_url` すべて `/Digital_textbook/`。ビルド後の `dist/manifest.webmanifest` でも確認済み。**コピー元の値の残留なし** | — |
| E2 | アイコン4種 + apple-touch-icon | ⚠️ | 192(any) / 512(any) / 512(maskable) / apple-touch-icon は有り。**`maskable-192` が欠落** | **P2** |
| E3 | beforeinstallprompt を head 最上部で捕捉 | ❌ | 捕捉スクリプト **0件**。通信の遅い端末で合図を取りこぼす | **P1-8** |
| E4 | インストールボタンをアプリ内に設置 | ❌ | 無し。README はアドレスバーのアイコンから入れるよう案内しており、児童には見つけられない | **P1-8** |
| E5 | sw.js が自アプリ接頭辞のキャッシュのみ削除 | ✅ | workbox 生成。`caches.keys()` の全削除 **なし**。他アプリのキャッシュを壊していない | — |
| E6 | sw.js が localStorage に触れていない | ✅ | `dist/sw.js` 内の `localStorage` 参照 **0件** | — |
| E7 | 更新通知 | ❌ | `registerType: 'autoUpdate'`（`src/main.jsx:8`）で**黙って**更新される。「あたらしい バージョンが あります」のトーストが無く、書き込み中に突然リロードされうる | **P1-8** |
| E8 | offline.html | ❌ | 無し。圏外の初回アクセスで白画面 | **P1-8** |
| E9 | APP_VERSION を今回のリリース値に更新 | ⚠️ | workbox の revision ハッシュに依存。`package.json` の `version` は `1.0.0` に据え置きで、リリース手順が文書化されていない | **P3** |
| E10 | iOS の「ホーム画面に追加」手順を MANUAL に記載 | ❌ | MANUAL.md 自体が無い | **P3** |

---

## F. アクセシビリティ・性能

| # | 項目 | 判定 | 実測 | 対応 |
|---|---|:--:|---|:--:|
| F1 | alt / aria-label / aria-live | ❌ | `<button>` **70個**に対し `aria-label` **0件**。アイコンのみのボタンが多数（`:597` の×ボタンなど）。`aria-live` 0件（トースト・保存完了が読み上げられない）。`role="dialog"` / `aria-modal` **0件**（モーダル6箇所） | **P1** |
| F2 | キーボードのみで全機能に到達 | ⚠️ | ショートカットは充実（README に一覧あり）。ただし **`Escape` のハンドラが 0件**でモーダルを閉じられず、フォーカストラップも無い | **P1** |
| F3 | 初回JS 300KB以下 | ✅ | `dist/assets/index-*.js` **258KB**（gzip 76KB）＋ workbox 5.7KB。基準内 | — |
| F4 | 1ファイル 5,000行 / 400KB 以内 | ✅ | `src/App.jsx` 3,112行 / 169KB。基準内（ただし単一ファイルに全機能が入っており保守性は低い） | **P3で提案のみ** |

### 総アセット

| 指標 | 実測 | 目標 | 判定 |
|---|---:|---:|:--:|
| 初回 JS（gzip前） | 264KB | 300KB | ✅ |
| プリキャッシュ総量 | **1,002KiB** | 1MB | ⚠️ ほぼ上限 |
| うち PNG アイコン | 704KB | — | ❌ |

---

## G. 学習ログ（`study.v1`）

| # | 項目 | 判定 | 備考 |
|---|---|:--:|---|
| G1 | study.v1 準拠・個人情報を持たない | — | 教材オーサリング／閲覧ツールであり、正誤や学習時間を採点・記録するアプリではないため対象外 |
| G2 | 中断記録・5分ルール | — | 同上 |

> なお `localStorage` に保存しているのは `digital_textbooks_v3` / `digital_textbook_drawings_v3` / `digital_textbook_mystamps` / `digital_textbook_last_opened` / `digital_textbook_view_mode` / `digital_textbook_page_history` / `digital_textbook_drive_*` の各キーのみ。**氏名・出席番号・メールアドレスは保持していない。**

---

## 依存関係

```
npm audit → 7 vulnerabilities (1 low, 1 moderate, 5 high)
  postcss   <=8.5.17   high   XSS / パストラバーサル / 情報漏えい
  picomatch            high
  ほか
```

- すべて **devDependencies（ビルド時のみ）** に属し、配布物には含まれない。
- `npm audit fix`（マイナー更新のみ）で解消可能。**`--force` は使わない。**

---

## ❌ の総括と対応方針

| フェーズ | 内容 | 破壊リスク | 件数 |
|---|---|:--:|:--:|
| **P0** | LICENSE / .gitignore（`.env` 追跡の停止）/ dependabot | なし | 4 |
| **P1** | safe-area / fluid type / DPR補正 / タップ44px / reduced-motion / 提示モード / 印刷CSS / PWA一式（install・更新通知・offline）/ a11y（aria・Esc・focus trap）/ CSP＋CDN自己ホスト化 | 小〜中 | 20 |
| **P2** | PNG 圧縮（704KB → 目標 120KB前後）/ maskable-192 追加 / `<img>` の width・height | 小 | 4 |
| **P3** | MANUAL.md / README 追補 / リリース手順 / App.jsx 分割の**提案** | なし | 4 |
| **P4** | 品質ゲート `scripts/check-project.mjs` + `quality.config.json` + CI 組み込み | なし | 1 |

### 特に重い3点

1. **`.env` がリポジトリに追跡されている（A2 / B2）** — 今回の値は性質上ブラウザに露出する識別子だが、この運用のままでは次に本物の鍵を置いた瞬間に漏れる。**履歴の書き換えは行わず、追跡停止と `.gitignore` 追加まで**を P0 で実施し、履歴の扱いは人間の判断を仰ぐ。
2. **CDN 7本を SRI なしで実行時ロード（B6）** — 供給元が汚染されれば児童端末で任意コードが走る。加えてオフライン初回起動が不可能で、PWA を名乗る前提が崩れている。CSP 投入（P1-9）と不可分なので、**自己ホスト化とセットで扱う**。
3. **PNG アイコン 704KB（D7 / P2）** — 総アセットが 1,002KiB と上限ぎりぎり。40人同時アクセスの校内 Wi-Fi では初回表示が遅い。

### 停止条件に触れた項目

- **`.env` の履歴** — 秘密情報がコミット履歴に含まれるケースに該当。履歴書き換え（`filter-repo` 等）は**行わず**、人間に判断を求める。
- **CSP 投入後の検証** — `npx serve` でコンソールに `Refused to` が 0件であることを確認できなければ、投入せず手順書として残す。

---

## 作業ブランチ

本ロールアウトは指定ブランチ **`claude/rollout-jrcug1`** 上で、フェーズごとに独立したコミットとして積む
（`giga-v4/p0-legal` 等の分割は、指定ブランチ運用のためコミット単位に読み替える）。
`main` への直接コミット・`--force` push・`reset --hard` は行わない。

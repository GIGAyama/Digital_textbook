# GIGA Standard v4 ロールアウト記録

## 進捗

| リポジトリ | 型 | P0 | P1(表示/PWA) | P2 | P3 | ゲート | 備考 |
|---|---|:--:|:--:|:--:|:--:|:--:|---|
| Digital_textbook | B | ✅ | ✅ | ✅ | ✅ | ✅ | 第3群。CDN自己ホスト化＋CSP、コントラスト0件、maskable 修正、ESLint 導入まで実施 |
| Townmap_Mikke | C+ | ✅ | ✅ | — | 🔜 | — | 第1群。docs/ のみ。**sw.js が他アプリのキャッシュを全削除していた問題を修正**。GAS 本体は scriptId 待ち。CSP は手順書として添付 |
| Reflection_Journal | C+ | ✅ | ✅ | ✅ | 🔜 | — | 第1群。docs/ のみ。**同じ sw.js の不具合**＋maskable がセーフゾーンの 91.64% を侵していた問題を修正。GAS 本体は scriptId 待ち |
| Homework_barcordreader | B | ✅ | ✅ | ✅ | ✅ | ✅ | 第1群。**完了・マージ済み**（#19 / #28）。コントラスト63→0件、タップ42→0件、画像 493→100KB、offline.html、更新通知、CSP |
| PhysicalEducation_note | C | ✅ | ✅ | — | ✅ | — | 第1群。**ふりがなが青いボタンの上で比 1.28**（低学年ほど読めない）。Bootstrap 既定色 4件も基準未満。CDN 4本に SRI＋版固定。OAuth スコープは提案のみ（PR #1・未マージ） |
| Ice_slide-puzzle | A | ✅ | ✅ | ✅ | ✅ | — | **完了・マージ済み**（#3）。拡大禁止を解除、黄色の上の白文字 1.53、画像 1321→44KB、CSP でゲームが止まったので本体を app.js へ切り出し |
| Digital-Newspaper | C | ✅ | ✅ | — | ✅ | — | 第1群。**送信ボタンのふりがなが比 1.47**。5件→0件（PR #1・未マージ） |

## Digital_textbook でやったこと

診断は [AUDIT.md](./AUDIT.md) に、改修後の再実測も同じファイルの後半にある。

| フェーズ | コミット | 内容 |
|---|---|---|
| 監査 | `audit:` | 実測のみ。コードは変更していない |
| P0 | `p0(legal):` | LICENSE / dependabot / `.env` の追跡停止 / `npm audit fix` |
| P1 | `p1(display/pwa):` | CDN 自己ホスト化・CSP・safe-area・fluid type・DPR補正・44px・reduced-motion・提示モード・印刷・インストールボタン・更新通知・offline.html・a11y |
| P2 | `p2(perf):` | アイコン 704KB → 128KB、maskable-192 追加、`<img>` に width/height |
| P3+P4 | `p3(docs)+p4(gate):` | MANUAL.md / README 追補 / 品質ゲート＋CI |
| 追加 | `p2(icon)+p1(contrast):` | maskable の作り直し / コントラストを全画面で 4.5:1 以上に |
| 追加 | `p3(split):` | App.jsx から状態を持たない部分を切り出し、ESLint を導入 |

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

### 8. 「maskable」と名前が付いていても、中身が maskable とは限らない

このリポジトリの `pwa-maskable-512x512.png` は、実体が「白い余白のついた角丸アイコン」だった。
ファイル名と manifest の `purpose` だけを見ていると気づけない。

**画素を数えて確かめること。** 中央80%の円の外側に「絵の中身」が何％あるかを測る。
このとき、アイコン自身の下地（このアプリでは青い角丸四角）と、
本当に欠けては困る中身（本・えんぴつ・歯車）を色で区別する。
下地は切り抜かれても構わないので、これを一緒に数えると実態より深刻に見える
（このアプリでは 21.1% と出たが、中身だけなら 1.24% だった）。

直し方は「絵を小さくする」より「**下地を端まで伸ばす**」ほうがよい。
青が青に切られるだけになり、アイコンを小さくせずに済む。
`scripts/make-maskable.mjs` がこの手順（外側の白だけ透明化 → 下地を全面に →
中身が収まる倍率を自動探索）を実装している。**他アプリにも流用できる。**

### 9. コントラストは「実際に描画された色」で測る

Tailwind のクラス名を目で追っても分からない。実ブラウザで全要素を走査し、
`getComputedStyle` の `color` と、親をたどって解決した背景色から比を計算する。
このとき2つの落とし穴がある。

- **グラデーション背景**は `backgroundColor` が透明になる。`backgroundImage` を
  見ないと「白の上の白（比 1.0）」という誤報になる
- **絵文字**はフォント自身の色で描かれ、CSS の `color` は効かない。除外しないと誤報になる

このアプリでは 21件が基準未満だった。修正は「色相を変えず、面または文字を
1〜2段濃くする」だけで済む。見た目の印象はほとんど変わらない。

### 10. 分割するなら ESLint を先に入れる

`App.jsx` を6ファイルへ分けたとき、`createPremiumStamp` の import が抜けたまま
**Vite のビルドが通った**。実際にその機能を使ったときに初めて壊れる。

`no-undef` はこれを確実に止める。ただし `eslint-plugin-react` の
`jsx-uses-vars` を入れないと、JSX の中でしか使わない名前（`<Header />` など）が
すべて「未使用」と誤報される。両方セットで入れること。

`window.fabric` のように `public/vendor/` から生えるグローバルは、
設定の `globals` に宣言しておく。

### 11. 依存を足したら、必ずクリーンクローンで `npm ci` を通す

`--legacy-peer-deps` で入れた依存は、手元では動くが **CI の `npm ci` では必ず落ちる**。
`npm ci` は package-lock.json を厳格に解決するため。
このリポジトリでも `@eslint/js` がバージョン未指定で v10 になり、eslint 9 と衝突していた。

```bash
git clone <repo> /tmp/clean && cd /tmp/clean && npm ci && npm run check && npm run build
```

**これを最後に一度回すだけで防げる。** 57リポジトリに展開するなら手順書に入れるべき。

### 12. `sw.js` の全キャッシュ削除は、フリート全体に効く一撃

`Townmap_Mikke` の `docs/sw.js` が `activate` で自分以外のキャッシュを
全部消していた。同一オリジンを共有する**他のすべての GIGA アプリ**が、
このアプリを1回開かれるだけでオフライン起動できなくなる。

**この1点だけは、他リポジトリでも真っ先に grep すべき。**

```bash
grep -n "caches.keys()" $(git ls-files '*sw.js')
```

修正は数行だが、効果は「そのアプリ」ではなく「同じ端末の全アプリ」に及ぶ。
検証も再現しやすい —— 同一オリジンに他アプリのキャッシュを2つ置いてから
Service Worker を有効化し、残っているか数えるだけ。
修正前後を並べた表は、そのまま PR の説得材料になる。

### 13. GAS リポジトリは `docs/` と GAS 本体を必ず分けて出す

`.clasp.json` が無いリポジトリでは、**本番の GAS とコードの差分を確認できない**。
差分がある場合は本番側が正である可能性が高く、`.gs` を直すのは事故になる。

一方 `docs/`（GitHub Pages シェル）は GitHub が唯一の正本なので、
この制約を受けない。**最優先項目が `docs/` 側にあるなら、そこだけで
1本の PR にできる。** `Townmap_Mikke` では `sw.js` がまさにそれで、
GAS に一切触れずにフリートへの被害を止められた。

`.gs` に着手するには `scriptId` の共有が要る。PR で明示的に求めること。

### 14. C+型では CSP を安易に入れない

GAS のウェブアプリは、実際の中身を `*.googleusercontent.com` の
**入れ子 iframe** で配信する。`frame-src` にこれを入れ忘れると画面が真っ白になる。
GIS サインインも `accounts.google.com` を script / frame / connect の
3か所で要求する。

これらを実地で確かめられない環境なら、標準の定めどおり
**投入せず手順書として PR に添える**。誤った CSP は全児童のログインを止める。

### 15. `manifest` の `id` 明示は、多くの場合そのまま入れてよい

`id` を省略したときの既定値は `start_url`。したがって
`start_url: "."` を `/{リポジトリ名}/` に解決した値と同じものを `id` に書けば、
**計算される識別子は変わらない**＝インストール済みの端末で別アプリにならない。

「`id` 変更は停止条件」と身構えがちだが、**変えているのは表記だけで
同一性は不変**というケースが大半。判断の根拠を PR に書けば止まらずに済む。

### 16. `sw.js` の不具合はテンプレート由来。1件ずつ回すより先に一括で洗う

`Townmap_Mikke` と `Reflection_Journal` は、**まったく同じ形の
`caches.keys()` 全削除**を持っていた。コメントの書き方まで似ており、
同じシェルのテンプレートから複製されたことが明らかだった。

つまりこれは「そのリポジトリの不具合」ではなく「**テンプレートの不具合が
横展開されたもの**」で、C+型の他のリポジトリも同じ状態である可能性が高い。

**1件ずつ P0〜P4 を回すより、まずこの1点だけを全リポジトリで洗うほうが
被害の止まり方が速い。** 判定は1行で済む。

```bash
grep -n "caches.keys()" $(git ls-files '*sw.js')
```

修正も定型で、`CACHE_NAME` を `CACHE_PREFIX + APP_VERSION` に分け、
`activate` のフィルタに `k.startsWith(CACHE_PREFIX) &&` を足すだけ。
検証も同じスクリプトが使い回せる。

### 17. `purpose:"maskable"` に通常アイコンを流用しているケースが多い

`Reflection_Journal` は `icon-512.png`（角丸アイコン）を `any` と
`maskable` の両方に指定していた。セーフゾーン外の **91.64%** が絵柄で、
Android が円で切り抜くと大きく欠ける。

manifest を目で見るだけでは気づけない（`src` が同じファイルなだけ）。
**画素を数えること。** 判定は Digital_textbook の
`scripts/make-maskable.mjs` の検査部分がそのまま使える。

### 18. Service Worker の登録を React の effect に移すと、黙って登録されなくなる

`Homework_barcordreader` を直しているとき、自分で入れた退行で気づいた。
**元のコードは正しく動いていた。** 実測で確かめた3通りの結果がこれ。

| 登録を書いた場所 | 登録される |
|---|---|
| `main.jsx` の一番外側（元のコード）で `load` を待つ | ✅ される |
| React の `useEffect` の中で `load` を待つ | ❌ **されない** |
| React の `useEffect` の中で `readyState` を見てから待つ | ✅ される |

```js
// これは動く。module script は load より前に走るので、リスナーが間に合う。
window.addEventListener('load', () => { navigator.serviceWorker.register(...) });

// これは動かない。effect は描画のあとに走り、そのとき load は終わっている。
useEffect(() => {
  window.addEventListener('load', () => { navigator.serviceWorker.register(...) });
}, []);
```

登録と「あたらしい版があります」の案内は一体で扱いたくなるので、
**登録を React 側へ持っていく改修は自然に発生する。** そのとき静かに壊れる。

必ずこう書く。

```js
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
```

**そして、直したあとに必ずブラウザへ問い合わせて確かめること。**
ビルドは通るし、`sw.js` を読んでも分からない。

```js
const reg = await navigator.serviceWorker.getRegistration();  // ← これだけ
```

なお `addEventListener('load'` で Service Worker を登録している形は
53リポジトリ中 21本にあるが、**いずれも読み込み直後に走る位置にあるので問題ない。**
危ないのは「あとから走るところへ移したとき」だけ。

### 19. Tailwind v4 は色を `oklch()` で書く。コントラスト計測が壊れる

`getComputedStyle` の `color` が `oklch(0.554 0.046 257.417)` で返ってくる。
数字だけ拾う実装だと `rgb(0.554, 0.046, 257.417)` と読み違え、
**どの要素も「ほぼ真っ黒」と判定されて比が 1.0 付近になる。**

`ctx.fillStyle` に代入して読み返しても `oklch` のまま返る（Chrome は色空間を保つ）。
**1px 実際に塗って `getImageData` で読む**のが確実。

```js
ctx.fillStyle = s; ctx.fillRect(0, 0, 1, 1);
const d = ctx.getImageData(0, 0, 1, 1).data;   // ← sRGB の実値
```

これを直したら、誤報だった件が消え、本当に足りていない63件が見えた。
**Tailwind v3 のリポジトリでは起きない。v4 に上げてあるものだけ注意。**

### 20. コントラストの一括置換は、濃い面の上の文字を壊す

`text-slate-400` → `text-slate-500` のような一括置換をかけると、
**濃いグラデーションのカードの上に置いた薄い文字まで濃く**なり、逆に読めなくなる。
実測で3件が悪化していた（比 2.66）。

同じ行に `bg-slate-900` があるかどうかで避けようとしたが、
面と文字が別の行にあるので効かない。**一括置換のあとに必ず測り直すこと。**

### 21. `apple-touch-icon` に透明のある画像を指すと、iPad で四隅が黒くなる

`icon-192.png`（角丸の外が透明）をそのまま指しているリポジトリが多い。
iOS は apple-touch-icon の透明部分を**黒**で埋めるため、
ホーム画面でアイコンの四隅だけが黒く出る。
透明を持たない専用画像（180×180）を1枚作れば済む。

### 22. `frame-ancestors` は `<meta>` では効かない

書いても無視され、読み込みのたびにコンソールに警告が出るだけ。
GitHub Pages ではヘッダーを足せないので、**書かないのが正しい**。
`index.html` に「独自ドメインや CDN を挟むときに設定すること」とコメントを残す。

### 23. フォントの CDN は、実行コードの CDN とは別に考える

Digital_textbook では pdf.js などを自己ホストに寄せた。あれは**無いと起動しない実行コード**。
フォントは違う。止まっても字の形が変わるだけで、動作には影響しない。

`Homework_barcordreader` で自己ホスト化を検討し、測ったうえで**やめた**。

| 方式 | 初回の転送 | リポジトリの重さ |
|---|---|---|
| Google Fonts | 必要なサブセットだけ | 0 |
| 日本語サブセット一括 | **4.2MB** | 4.2MB |
| 分割サブセット | 必要な分だけ | **6.6MB**（354ファイル） |

一括自己ホストは、**校内Wi-Fiで40人が同時に開くという、いちばん避けたい状況を自分で作る。**
代わりに端末側の日本語フォントを後ろに並べ、塞がれても崩れないようにした。

なおこの作業環境では `fonts.googleapis.com` が塞がれているため、
**フィルタリングされた学校とまったく同じ状態で全画面を測れる。** これは使える。

### 24. 共通の検査そのものに不具合が3件あった

`scripts/lib/giga-v4-checks.mjs` は全リポジトリに配るものなので、
ここの取りこぼしは全部に効く。わざと壊す試験で見つけた。

1. **`SW_CACHE_WIPE` が取りこぼす。** 削除する式を正規表現で追っていたため、
   `(k) => caches.delete(k)` のように引数を括弧で囲む書き方を見落としていた。
   **「消す式」ではなく「`startsWith` で自アプリに絞る式があるか」を見る**形に変えた。
   `CACHE_PREFIX` という定数の有無は根拠にしない（名前だけ定義して全部消すコードが実在した）。
2. **`SW_LOCALSTORAGE` が誤検知。** 「localStorage は操作しない」という注意書きに反応していた。
3. **`VIEWPORT_100VH` が誤検知。** `@supports not (height: 100dvh) { ... 100vh }` の形を見ていなかった。

**わざと壊す試験をしなければ、3件とも「0件でした」で通り過ぎていた。**

### 25. 測る道具は `scripts/measure/` に置いた

57本を1本ずつ回すので、**1回の投資で全部に効く道具**だけを作って置いてある。
使い方は [scripts/measure/README.md](./scripts/measure/README.md)。

| 道具 | 何をするか |
|---|---|
| `audit-repo.mjs` | リポジトリの型を判定し、A〜G の観点を JSON で出す |
| `probe-a11y.js` | ブラウザの中でコントラストとタップ領域を実測する |
| `gas-assemble.mjs` | GAS のウェブアプリを手元で開ける1枚の HTML に組み立てる |
| `gas-measure.mjs` | 組み立てた画面を測る |

### 26. C型（GAS）でも表示は実測できる

本番（`script.google.com`）へは作業環境から到達できない。
しかし GAS が返す画面は `index.html` + `css.html` + `js.html` を貼り合わせたものなので、
**同じ貼り合わせを手元でやれば、表示まわりは本物と同じものを測れる。**
`google.script.run` はダミーに差し替える。

測れないのは「サーバーの戻り値に依存する画面」だけ。
**「GAS だから測れない」は正しくない。表示は測れる。**

### 27. CDN が塞がれた環境で測ると、数字が意味を失う

この作業環境は `cdn.jsdelivr.net` へ出られない。
そのまま測ると **Bootstrap が当たらない素の HTML** を測ることになる。

体育ノートでの実測。

| | コントラスト | タップ |
|---|---:|---:|
| CDN の控えを用意する前 | 6件 | 6件 |
| 用意したあと | **2件** | **1件** |

**前者は全部でたらめだった。** npm から同じ版を取って jsDelivr と同じパスで並べ、
検査用の複製だけ向け直す。リポジトリには手を入れない。

なお **Google Fonts はわざと塞がれたままにしてある。**
フィルタリングされた学校とまったく同じ状態で測れるので、そのほうが都合がよい。

### 28. C型は「表示は直せる・マージできる」「OAuth スコープは触らない」

`script.google.com` へ到達できないため、**スコープの変更は検証できない。**
間違えると全教員で認可が通らなくなり、教室が止まる。

`PhysicalEducation_note` の `appsscript.json` には
`https://www.googleapis.com/auth/drive`（Drive 全体）があり、規格上は ❌ にあたる。
ただしコードを読むと `DriveApp.searchFiles()` で
**先生のドライブ全体からお手本の画像・動画を探す**機能があり、
`drive.file` に落とすとこの機能が壊れる。carelessness ではなく設計上の要求だった。

**候補は `drive.readonly` + `drive.file` の組み合わせ**（全体を読めるが、
書けるのはアプリが作ったものだけ）。ただし Apps Script の `DriveApp` は
スコープの粒度が粗く、実際に通るかは**デプロイして確かめないと分からない。**

→ **直さずに AUDIT.md へ書き、PR で提案するだけにする。マージしない。**

### 29. Bootstrap の既定色は、4つとも基準に届いていない

体育ノートで出たのは**このアプリ固有の配色ではなく、Bootstrap 5.3 の既定色**だった。
白地・14px での実測。

| クラス | 色 | 比 |
|---|---|---:|
| `.text-primary` | `#0d6efd` | 4.27 |
| `.text-danger` | `#dc3545` | 4.30 |
| `.text-secondary` | `#6c757d` | 4.45 |
| `.btn-outline-info` | `#0dcaf0` | **1.96** |

**Bootstrap を使っているリポジトリでは、まったく同じ4件が出るはず。**
個別に直すより、この上書きを丸ごと持っていくほうが速い。

```css
:root {
  --bs-primary-text-emphasis: #0a58ca;
  --bs-danger-text-emphasis: #b02a37;
  --bs-info-text-emphasis: #087990;
}
.text-primary { color: #0a58ca !important; }
.text-danger { color: #b02a37 !important; }
.text-secondary { color: #5c636a !important; }
.btn-outline-info { --bs-btn-color: #087990; --bs-btn-border-color: #087990; }
```

`Google Blue #1a73e8` を主色にしているアプリも要注意。**4.27 で、
白抜き文字を載せたときも 4.27。表にも裏にも届いていない。**
`#1967d2`（Blue 700）に1段濃くすると両方 5.0 になる。

### 30. ふりがな（`rt`）の色を決め打ちすると、低学年ほど読めなくなる

体育ノートは `rt { color: #666 }` としていた。
そのため**青いボタンの上に置いたふりがなが濃い灰色のまま重なり、比 1.28**。

ふりがなが要るのは低学年の児童なので、
**いちばん読めなくて困る人がいちばん読めない**形になっていた。

```css
.btn rt, .badge rt, .nav-link rt, [class*="bg-primary"] rt { color: inherit; }
```

**`<ruby>` を使っているアプリは全部見ること。** この一群には多い。

### 31. `viewport-fit=cover` は、GAS では2か所直さないと効かない

GAS は画面を iframe で包む。`index.html` の `<meta>` だけ直しても、
外枠側が古いままで安全領域が使えるようにならない。

```js
// code.gs の doGet でも同じものを指定する
.addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
```

### 32. SRI は「付けた」だけでは意味がない。版の固定とセット

体育ノートは CDN を4本、SRI 無しで読んでいた。**うち2本は版も浮いていた。**

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>   <!-- 版が浮いている -->
```

版が浮いていると SRI を付けられない（中身が変わるため）。
そのうえ**メジャー版が上がると勝手に追随し、ある日突然壊れる。**
ファイルを明示して版を固定してから、ハッシュを付ける。

ハッシュは**記憶で書かない。** npm から同じ版を取って実バイトから計算する。
間違えると、そのファイルは読み込まれず**アプリが起動しなくなる**。

```bash
npm pack bootstrap@5.3.0
openssl dgst -sha384 -binary package/dist/css/bootstrap.min.css | openssl base64 -A
```

効いていることの確かめ方は「ミラー上のファイルに1バイト足す」。
弾かれると、スタイルシートの枚数が減り、`Failed to find a valid digest` が出る。
**SRI の失敗は `requestfailed` に出ない**（要求は成功し、検査だけが落ちるため）。
読み込み失敗の一覧だけ見ていると、効いていなくても気づけない。

### 33. ミラーには CORS ヘッダーが要る

`crossorigin="anonymous"` を付けた資産は、CORS 応答でないとブラウザが弾く。
ローカルの控えを `python3 -m http.server` で出すと**ハッシュが正しくても全部失敗する**。
`Access-Control-Allow-Origin: *` を返す小さなサーバーにすること。

### 34. `controllerchange` をそのまま受けると、初回訪問が必ず1回リロードされる

更新の案内を実装するとき、こう書きたくなる。

```js
navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
```

**これは初回訪問でも発火する。** Service Worker が `activate` で `clients.claim()`
を呼ぶと、それまで管理下になかったページが管理下に入り、この合図が出るため。

実測すると初回の画面遷移が **2回**（1回が正常）になる。
ゲームなら並べたばかりの盤面が、入力画面なら打ちかけの文字が消える。

**「もともと管理下だったか」で分ける直し方は、別の形で壊れる。**
入れた直後に更新を押した場合、切り替わったのに読み込み直されなくなる（実測で踏んだ）。

見るべきは**利用者が押したかどうか**だけ。

```js
let userAskedUpdate = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!userAskedUpdate || reloading) return;
  reloading = true; location.reload();
});
```

確かめ方は簡単で、**まっさらな状態で1回開き、画面遷移の回数を数える**だけ。

### 35. CSP は「入れた」だけでは終わらない。入れたら動かすこと

`Ice_slide-puzzle` に `script-src 'self'` を入れた直後、**ゲームが起動しなくなった。**

```
駒の数: 0 / ターン表示: null
```

本体が `index.html` にインラインで書かれ、ボタンも `onclick=` だったため。
どちらも `'self'` では実行されない。

**`'unsafe-inline'` を足せば直るが、それでは CSP を入れた意味がほとんど無くなる。**
440行を外部ファイルへ切り出し、`onclick=` を `addEventListener` に繋ぎ替えた。

**ビルドも静的解析も通る。動かさないと絶対に気づけない。**
この一群には「1枚の HTML に全部書く」形が多いので、A型では必ず起きる。

### 36. `<ruby>` を使うアプリは、ほぼ確実に同じ穴を持っている

これまでに見た3本すべてで、`rt` の色を決め打ちしていた。

| リポジトリ | 色 | 色のついた面での比 |
|---|---|---:|
| PhysicalEducation_note | `#666` | **1.28** |
| Digital-Newspaper | `#555` | **1.47** |
| Ice_slide-puzzle | `#666` | 4.44（白地のみ・面の上には無かった） |

`Digital-Newspaper` は**タグのラベルについてだけ気づいて手当てしてあった**。
気づいていたのに、送信ボタンのほうは漏れていた。
**1か所ずつ潰すのではなく、まとめて色を継がせるのが正しい。**

```css
rt { color: #5f6368; }
button rt, .badge rt, .nav-link rt, [class*="bg-"] rt, [class*="btn"] rt { color: inherit; }
```

### 37. 「設定が終わっていない人向けの文言」がいちばん読みにくいことがある

`Digital-Newspaper` の「タグ設定がありません」は `color: red`（比 4.00）だった。
**先生の設定が終わっていないときにだけ出る文**で、
いちばん困っている人に向けた案内が、いちばん読みにくい色になっていた。

エラー文・警告文・空状態の文言は、装飾ではなく**本文として**測ること。

## 次にやること（第1群の残り）

- **`Haiku-meeting`（C型）は重い。** 実測すると次の状態だった。
  - **`<meta name="viewport">` が無い**（スマホ・タブレットで 980px 幅として描画される）
  - Tailwind を `cdn.tailwindcss.com` から読んでいる（本番利用は非推奨の版。
    ブラウザ内で CSS を生成する）
  - React / ReactDOM / **Babel standalone** を unpkg から読み、
    **JSX をブラウザで毎回コンパイルしている**
  - 学校のフィルタリングでこれらが塞がれると、**画面が一切出ない**
  → 自己ホスト化と事前コンパイルが要る。構成の変更なので、まとめて1本の PR にする。
- `Class_tweet` / `Moral_note` / `Slide_Guild` / `Online-Publisher-pro` /
  `MIRAI-Compass` / `MIRAI-Passport` / `Gamification` / `SchoolPlan_Editor` /
  `Townmap_Mikke` / `Reflection_Journal` / `School_plan_note`

## 次に着手するときに人間が決めること（未決）

- `School_plan_note` と `SchoolPlan_Editor` のどちらを正本にするか
- `online-manuscript-paper` / `-lite` / `-pro` / `Online-Publisher-pro` の4系統の整理方針
- `studyLog.js` の正本をどのリポジトリに置くか
- `scripts/lib/giga-v4-checks.mjs` を、どのリポジトリに正本として置くか
  （静的サイト型が多いので、GAS 向け正本とは別に1本必要になる）

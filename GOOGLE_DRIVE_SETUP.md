# Googleドライブ同期のセットアップ

このアプリは、**各先生ご自身のGoogleドライブ**に教科書・書き込み・マイスタンプを直接保存し、
別の端末で同じGoogleアカウントに接続するだけでデータを同期できます。

- サーバー・データベースは一切不要（アプリの理念そのまま）
- 保存先は「あなた自身のGoogleドライブ」だけ
- アプリが使うのは **`drive.file`** スコープ（＝このアプリが作った1つのファイルにしかアクセスできません。あなたの他のドライブのファイルは一切読み書きしません）

この機能を有効にするには、Google Cloud で **OAuth クライアントID** を1回だけ発行し、アプリに設定します。
（発行は無料です。設定は管理者／公開者が1回行うだけで、利用する先生は「接続」ボタンを押すだけです。）

---

## 1. Google Cloud プロジェクトを作る

1. https://console.cloud.google.com/ にアクセスしてログイン
2. 上部のプロジェクト選択 →「新しいプロジェクト」→ 名前を付けて作成
   （例: `digital-textbook`）

## 2. Google Drive API を有効化する

1. 左メニュー →「API とサービス」→「ライブラリ」
2. 「Google Drive API」を検索して開き、「**有効にする**」をクリック

## 3. OAuth 同意画面を設定する

1. 「API とサービス」→「OAuth 同意画面」
2. User Type は **外部（External）** を選択して作成
3. アプリ名・サポートメール・デベロッパー連絡先を入力
4. スコープ画面では、`.../auth/drive.file` を追加（未追加でも接続時に同意できます）
5. 「テスト」段階のままでも動作します。多くの先生に使ってもらう場合は「**公開（本番環境に push）**」してください
   - `drive.file` は機微（sensitive）扱いにならないため、通常は Google の審査なしで公開できます

## 4. OAuth クライアントID（ウェブアプリ）を作る

1. 「API とサービス」→「認証情報」→「認証情報を作成」→「**OAuth クライアント ID**」
2. アプリケーションの種類：**ウェブアプリケーション**
3. 「**承認済みの JavaScript 生成元**」に、アプリを公開しているURLの**オリジン**を追加します。
   このリポジトリの GitHub Pages 公開先の場合は：

   ```
   https://gigayama.github.io
   ```

   ※ 末尾にパス（`/Digital_textbook/`）は付けません。オリジン（`https://ドメイン`）だけを入れます。
   ※ 手元で `npm run dev` を試す場合は `http://localhost:5173` も追加しておくと便利です。
4. 「リダイレクト URI」は空のままで構いません（このアプリはトークン方式のため不要です）
5. 作成すると表示される「**クライアント ID**」（`xxxxxxxx.apps.googleusercontent.com`）をコピーします

## 5. アプリにクライアントIDを設定する

次のどちらかの方法で設定します。

### 方法A：環境変数で設定（おすすめ）

ビルド時に環境変数を渡します。GitHub Actions で公開している場合は、リポジトリの
**Settings → Secrets and variables → Actions → Variables** に

- 名前: `VITE_GOOGLE_CLIENT_ID`
- 値: 発行したクライアントID

を追加し、ワークフローのビルドステップに `env: VITE_GOOGLE_CLIENT_ID: ${{ vars.VITE_GOOGLE_CLIENT_ID }}` を渡します。

ローカルでビルドする場合は、プロジェクト直下に `.env` を作成：

```
VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

### 方法B：ソースに直接書く

`src/App.jsx` の先頭付近にある次の行の `""` にクライアントIDを貼り付けてビルドします。

```js
const GOOGLE_CLIENT_ID =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) || "";
```

↓ 例

```js
const GOOGLE_CLIENT_ID =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID)
  || "xxxxxxxx.apps.googleusercontent.com";
```

## 6. 使い方

1. アプリのホーム画面に「**Googleドライブ同期**」パネルが表示されます
   （クライアントID未設定の場合は表示されず、従来どおりJSONファイルのバックアップのみ使えます）
2. 「**Googleドライブに接続**」を押して、Googleアカウントでログイン・許可
3. 「**ドライブに保存**」で現在のデータを自分のドライブへ保存
4. 別の端末で同じアプリを開き、同じGoogleアカウントで接続 →「**ドライブから復元**」で同期
5. 「**自動保存**」をオンにしておくと、書き込みや変更を少し待ってから自動でドライブへ保存します

> データはドライブ内に `digital-textbook-backup.json` という名前で保存されます。
> `drive.file` スコープのため、このファイルの中身が見えるのはこのアプリからだけです。

---

## よくある質問

**Q. クライアントIDを設定しないとどうなりますか？**
A. 同期パネルは表示されず、アプリはこれまでどおり動作します。手動のJSONバックアップ（書き出す／取り込む）はいつでも使えます。

**Q. 教科書のPDFが大きくても保存できますか？**
A. レジューム可能アップロードを使っているため、数十MB程度でも保存できます（各ページはJPEGに変換して保存されます）。

**Q. 他人のドライブや他のファイルにアクセスされませんか？**
A. しません。`drive.file` スコープはこのアプリが作成したファイルのみが対象です。

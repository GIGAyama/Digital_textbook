/**
 * アプリ全体で使う定数。
 *
 * 画面の見た目にも、保存データの互換性にも関わる値をここにまとめる。
 * とくに DB_KEY_* は、値を変えると既存の書き込みが読めなくなるので触らない。
 */


export const APP_NAME = "デジタル教科書メーカー";
export const DEVELOPER_NAME = "GIGA山";
export const SNS_LINK = "https://note.com/cute_borage86";

export const DB_KEY_TEXTBOOKS = "digital_textbooks_v3";
export const DB_KEY_DRAWINGS = "digital_textbook_drawings_v3";
export const DB_KEY_MYSTAMPS = "digital_textbook_mystamps";
export const DB_KEY_LAST_OPENED = "digital_textbook_last_opened";
export const DB_KEY_VIEW_MODE = "digital_textbook_view_mode";

export const BACKUP_FORMAT = "digital-textbook-backup";
export const BACKUP_VERSION = 1;

// ==========================================
// Googleドライブ同期の設定
// Google Cloud で発行した OAuth クライアントID を設定すると、
// アプリから直接 Googleドライブ にデータを保存・復元できるようになります。
// 設定方法は「GOOGLE_DRIVE_SETUP.md」を参照してください。
//   ・ビルド時の環境変数  VITE_GOOGLE_CLIENT_ID  を設定するか
//   ・下の "" の中に直接クライアントIDを貼り付けてください
// 未設定の場合でもアプリは通常どおり動作し、同期パネルのみ非表示になります。
//
// ⚠️ この「クライアントID」は秘密の鍵ではない。
//    OAuth の Web クライアントIDは、どのみちブラウザの通信に出てくる公開の識別子で、
//    これを知られてもデータは読めない。なりすましを防いでいるのは
//    Google Cloud 側の「承認済みの JavaScript 生成元」の設定であって、この値の秘匿ではない。
//    そのため公開先ドメインを Google Cloud に必ず登録すること（GOOGLE_DRIVE_SETUP.md 参照）。
//    一方で「クライアントシークレット」は本物の鍵なので、この値の隣に置かないこと。
// ==========================================
export const GOOGLE_CLIENT_ID =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) || "521749104068-2455o6p38or3tnerqjmllsjrnoc4kqq3.apps.googleusercontent.com";
export const GDRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GDRIVE_FILE_NAME = "digital-textbook-backup.json";
export const GIS_SRC = "https://accounts.google.com/gsi/client";

export const DB_KEY_DRIVE_FILE_ID = "digital_textbook_drive_file_id";
export const DB_KEY_DRIVE_AUTOSAVE = "digital_textbook_drive_autosave";
export const DB_KEY_DRIVE_LAST_SYNC = "digital_textbook_drive_last_sync";

export const COLORS = ['#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
export const STICKY_COLORS = ['#fff740', '#ffccff', '#ccffff', '#ccffcc'];

// スマホ・タブレットでの「戻る」スワイプ(ジェスチャー操作)の判定値
export const EDGE_SWIPE_ZONE = 28;       // 画面の左右の端からこの範囲(px)で始まったスワイプを対象にする
export const EDGE_SWIPE_DISTANCE = 64;   // 中央方向へこれ以上(px)動いたら「戻る」とみなす
export const EDGE_SWIPE_MAX_SLOPE = 60;  // 縦方向のずれ(px)がこれを超えたらスクロール操作とみなして中止する
export const BACK_NAV_INTERVAL = 400;    // 「戻る」が二重に処理されるのを防ぐ最小間隔(ms)

// 選択モードでの「ページ送り」スワイプの判定値
export const PAGE_SWIPE_SLOP = 12;       // この距離(px)動いた時点で、ページ送りか縦スクロールかを見分ける
export const PAGE_SWIPE_DISTANCE = 80;   // 横方向へこれ以上(px)動いたらページを送る
export const OBJECT_GRAB_MARGIN = 24;    // 選択中の図形のこの範囲(px)内から始めた操作は、図形の移動を優先する

// PDF を取り込むときの描画倍率。
// ここで決めた解像度が、そのまま「全端末での見え方の上限」になる。
// P2P で別の端末に配ると、取り込んだ端末の解像度は当てにならないので、
// 端末ごとの devicePixelRatio ではなく固定値にしてある。
// 1.5 では 2倍表示の Chromebook・iPad で教科書の細い文字がぼやけた。
// かといって 3 にすると1ページの面積が 4倍になり、メモリ4GBの Chromebook が
// タブごと落ちる。2 あれば肉眼では十分きれいなので、ここで頭打ちにする。
export const PDF_RENDER_SCALE = 2;

// 画面に出す Canvas 用の実効 devicePixelRatio。
// 3倍端末で 9倍の面積を描くとメモリ4GBの Chromebook が落ちるため 2 で頭打ちにする。
export const effectiveDpr = () => Math.min(window.devicePixelRatio || 1, 2);

// ライブラリはすべて自分のサイトから配る（public/vendor/。中身は npm から
// scripts/sync-vendor.mjs が生成する）。
export const VENDOR = (name) => `${import.meta.env.BASE_URL}vendor/${name}`;

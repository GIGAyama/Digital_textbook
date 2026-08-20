/**
 * アプリ全体で使う定数。
 *
 * 画面の見た目にも、保存データの互換性にも関わる値をここにまとめる。
 * とくに DB_KEY_* は、値を変えると既存の書き込みが読めなくなるので触らない。
 */


// 「デジタル教科書」は学校教育法第34条第2項に基づく制度上の呼び名で、
// 検定教科書と結びついた「学習者用デジタル教科書」のことを指す。
// このアプリは手元のPDFに書き込むだけの道具なので、その呼び名は表示に使わない。
// 取り違えられないよう、画面にもドキュメントにも下の注記をそえる。
export const APP_NAME = "教材プリントメーカー";
export const APP_DISCLAIMER =
  "本アプリは、学校教育法第34条第2項に定める「学習者用デジタル教科書」ではありません。教科書発行者とは関係のない、個人が作成した教材ビューアです。";
// 取り込んでよい資料の範囲。初回だけ画面に出し、READMEにも同じ内容を書いてある。
export const COPYRIGHT_NOTICE =
  "取り込めるのは、自分で作った資料や、権利処理が済んでいる資料です。教科書・ドリル・ワークブックなど市販の教材を丸ごと取り込んで配ることは、著作権法第35条の範囲を超えます。";
export const DEVELOPER_NAME = "GIGA山";
export const SNS_LINK = "https://note.com/cute_borage86";

export const DB_KEY_TEXTBOOKS = "digital_textbooks_v3";
export const DB_KEY_DRAWINGS = "digital_textbook_drawings_v3";
export const DB_KEY_MYSTAMPS = "digital_textbook_mystamps";
export const DB_KEY_LAST_OPENED = "digital_textbook_last_opened";
export const DB_KEY_VIEW_MODE = "digital_textbook_view_mode";
// 著作権の注意を読んだかどうか（一度読んだら次からは出さない）
export const DB_KEY_NOTICE_SEEN = "digital_textbook_notice_seen";

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

// ==========================================
// P2P共有（先生 → 児童生徒）の安全装置
//
// PeerJS が配る接続用のIDは、URLとQRコードに入って教室の外へも簡単に出ていく。
// IDだけを頼りにすると、URLを手に入れた誰でも、何人でも受け取れてしまう。
// そこで「合言葉」「有効期限」「人数の上限」の3つで受け渡しを囲う。
// ==========================================

// 合言葉に使う文字。見まちがえやすい 0/O と 1/I/L は入れない。
export const SHARE_PASSCODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
// 合言葉の文字数。板書して読み上げられる長さにする。
// 31文字から5文字なので約2900万通り。1回の接続に3回までしか試せないので総当たりはできない。
export const SHARE_PASSCODE_LENGTH = 5;
// 合言葉を何回まちがえたら、その接続を切るか
export const SHARE_MAX_AUTH_ATTEMPTS = 3;
// 共有の有効期限（分）。授業1コマで配り終わる想定で30分を既定にする。
export const SHARE_EXPIRY_OPTIONS = [10, 30, 60];
export const SHARE_DEFAULT_EXPIRY_MIN = 30;
// 配れる人数の上限。学級の規模に合わせて40人を既定にする。
export const SHARE_MAX_RECEIVERS_OPTIONS = [5, 10, 40, 80];
export const SHARE_DEFAULT_MAX_RECEIVERS = 40;

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
// 1.5 では 2倍表示の Chromebook・iPad で教材の細い文字がぼやけた。
// かといって 3 にすると1ページの面積が 4倍になり、メモリ4GBの Chromebook が
// タブごと落ちる。2 あれば肉眼では十分きれいなので、ここで頭打ちにする。
export const PDF_RENDER_SCALE = 2;

// 画面に出す Canvas 用の実効 devicePixelRatio。
// 3倍端末で 9倍の面積を描くとメモリ4GBの Chromebook が落ちるため 2 で頭打ちにする。
export const effectiveDpr = () => Math.min(window.devicePixelRatio || 1, 2);

// ライブラリはすべて自分のサイトから配る（public/vendor/。中身は npm から
// scripts/sync-vendor.mjs が生成する）。
export const VENDOR = (name) => `${import.meta.env.BASE_URL}vendor/${name}`;

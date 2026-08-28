import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 独自ドメインに移り、アプリは digital-textbook.giga-school.com の直下で配信される。
// 以前は gigayama.github.io を多数のアプリで共有しており、取り違えを防ぐために
// リポジトリ名の絶対パスを使っていたが、いまはアプリごとにオリジンが分かれている。
// リポジトリ名の絶対パス（旧 /Digital_textbook/）のままだと、資産がすべて 404 になり、
// manifest の scope もページの URL を含まなくなって PWA としてインストールできない。
// base / id / scope / start_url / navigateFallback がここ 1 か所から決まる。
const BASE = './'

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            // autoUpdate だと書き込みの途中でも黙ってリロードされてしまう。
            // 新しい版が用意できたことを画面で知らせ、押してもらってから切り替える。
            registerType: 'prompt',
            includeAssets: ['favicon.png', 'apple-touch-icon.png'],
            // 開発サーバー（npm run dev）でも PWA を組み立てる。
            //
            // 既定では vite-plugin-pwa は本番ビルドのときにしか
            // manifest.webmanifest と Service Worker を出さない。
            // つまり npm run dev で開いている間は
            //   ・<link rel="manifest"> が index.html に入らない
            //   ・/sw.js を叩いても index.html が返る（SPA フォールバック）
            // という状態で、ブラウザから見ると「インストールできるサイト」の
            // 条件を満たさない。結果、Chrome のアドレスバー右端に出る
            // インストールボタンが開発中はいつまでも出ず、
            // beforeinstallprompt も飛ばないのでアプリ内の
            // 「アプリを入れる」ボタンも出ない。
            //
            // 直せるのは設定だけなので、開発時も本番と同じ形を配る。
            // type: 'module' は、開発用の Service Worker が Vite の
            // ES モジュールのまま配信されるため（classic だと import で落ちる）。
            devOptions: {
                enabled: true,
                type: 'module',
                navigateFallback: 'index.html',
                // 開発用の Service Worker は中身を先読みキャッシュしないので、
                // workbox の「precache が空」という警告が毎回出る。実害はない。
                suppressWarnings: true,
            },
            manifest: {
                id: BASE,
                // 「デジタル教科書」は学校教育法第34条第2項の制度用語なので名乗らない。
                // ホーム画面に並ぶ名前だけでも取り違えられないようにする。
                name: '教材プリントメーカー（学習者用デジタル教科書ではありません）',
                short_name: '教材メーカー',
                description: 'PDFを読み込んで書き込みができる、先生と子どものための教材プリントアプリ。本アプリは、学校教育法第34条第2項に定める「学習者用デジタル教科書」ではありません。教科書発行者とは関係のない、個人が作成した教材ビューアです。',
                lang: 'ja',
                dir: 'ltr',
                start_url: BASE + '?source=pwa',
                scope: BASE,
                display: 'standalone',
                display_override: ['standalone', 'fullscreen', 'minimal-ui'],
                launch_handler: { client_mode: ['navigate-existing', 'auto'] },
                orientation: 'any',
                background_color: '#fffbeb',
                theme_color: '#f59e0b',
                categories: ['education', 'kids'],
                icons: [
                    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: 'pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
                    { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                // 書体（woff2）は先読みに入れない。vendor/ と同じ理由で、
                // 実際に画面が出た時点で取りにいき、下の runtimeCaching が控えを持つ。
                globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
                // vendor/ は合計2MBある。ここを先読みキャッシュに入れると
                // 初回アクセスで2MBを一気に取りに行き、40人が同時に開く
                // 校内Wi-Fiでは表示が止まる。実際に使う時点で取りに行き、
                // 一度取れたら以降はキャッシュから出す（下の runtimeCaching）。
                globIgnores: ['vendor/**'],
                // 圏外で画面遷移したときはキャッシュ済みのアプリ本体を返す。
                navigateFallback: BASE + 'index.html',
                navigateFallbackDenylist: [/(^|\/)vendor\//],
                cleanupOutdatedCaches: true,
                // pdf.worker.min.js が約1MBあるため、既定の2MBのままにしておく
                maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
                runtimeCaching: [
                    {
                        // 自分のサイトの vendor/。一度読めたらずっと使い回す。
                        // バージョンを上げるとファイル内容が変わるので、
                        // キャッシュ名も上げること。
                        urlPattern: ({ url }) =>
                            url.origin === self.location.origin && url.pathname.includes('/vendor/'),
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'digital-textbook-vendor-v1',
                            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        // 自分のところから配る書体。先読みには入れず、画面が出た時点で
                        // 取りにきたものをここで控える。2 回目からはオフラインでも出る。
                        //
                        // ⚠️ 以前ここには Google Fonts の規則が 2 本あり、
                        //    「自前で持つとサブセットを切ったときに豆腐（□）になる恐れ」と
                        //    書いてあった。実際には Google が返す unicode-range をそのまま
                        //    使うので、収録外の字は端末内蔵フォントへ落ちるだけで
                        //    豆腐にはならない。読む先が無くなったので規則ごと消した。
                        urlPattern: ({ request, sameOrigin }) =>
                            sameOrigin && request.destination === 'font',
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'self-hosted-fonts',
                            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
        }),
    ],
    base: BASE,
    build: {
        rollupOptions: {
            // プライバシーポリシーと利用規約を、ビルドの入口として明示する。
            //
            // Vite は既定で index.html しか入口として扱わない。
            // privacy.html と terms.html をリポジトリ直下に置いただけでは
            // dist に入らず、公開先（GitHub Pages）では 404 になる。
            // さらに Service Worker の navigateFallback が index.html を
            // 返すため、404 のかわりにアプリ本体が開いてしまい、
            // giga-school.com からの「プライバシーポリシー」「利用規約」の
            // リンクがアプリのページに化けていた。
            // ここに並べておくと dist に出力され、precache にも入るので、
            // 圏外でも規約を読める。
            input: {
                index: fileURLToPath(new URL('./index.html', import.meta.url)),
                privacy: fileURLToPath(new URL('./privacy.html', import.meta.url)),
                terms: fileURLToPath(new URL('./terms.html', import.meta.url)),
            },
        },
    },
})

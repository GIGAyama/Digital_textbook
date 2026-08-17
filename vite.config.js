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
            manifest: {
                id: BASE,
                name: 'デジタル教科書メーカー',
                short_name: 'デジタル教科書',
                description: 'PDFを読み込んで書き込みができる、先生と子どものためのデジタル教科書アプリ',
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
                        // 日本語フォントは Google Fonts の unicode-range 分割に任せている。
                        // 自前で持つと全字形で数MBになり、逆にサブセットを切ると
                        // 児童が入力した漢字が豆腐（□）になる恐れがあるため。
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'google-fonts-stylesheets',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
        }),
    ],
    base: BASE,
})

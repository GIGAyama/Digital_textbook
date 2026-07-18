import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.png', 'apple-touch-icon.png'],
            manifest: {
                id: '/Digital_textbook/',
                name: 'デジタル教科書メーカー',
                short_name: 'デジタル教科書',
                description: 'PDFを読み込んで書き込みができる、先生と子どものためのデジタル教科書アプリ',
                lang: 'ja',
                start_url: '/Digital_textbook/',
                scope: '/Digital_textbook/',
                display: 'standalone',
                orientation: 'any',
                background_color: '#fffbeb',
                theme_color: '#f59e0b',
                icons: [
                    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
                // CDNライブラリ(pdf.js, fabric.js等)とWebフォントをキャッシュしてオフラインでも起動できるようにする
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'cdn-libraries',
                            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
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
                            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
        }),
    ],
    base: '/Digital_textbook/',
})

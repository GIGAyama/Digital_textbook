import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

/**
 * 新しい版が用意できたことを知らせる帯を出す。
 *
 * 以前は autoUpdate で黙って更新していたが、それだと書き込みの途中で
 * 突然リロードがかかり、直前の操作が消えたように見えることがあった。
 * 押してもらってから切り替える。文言は低学年でも読めるひらがな中心にする。
 *
 * React の外で素の DOM として作っているのは、この帯を出す時点では
 * アプリ本体がどの画面を出しているか分からないため（起動直後にも
 * 教材の編集中にも出うる）。どの画面の上にも同じように乗せられる。
 */
const showUpdateBanner = (onApply) => {
    if (document.getElementById('sw-update-banner')) return;

    const bar = document.createElement('div');
    bar.id = 'sw-update-banner';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.className = 'sw-update-banner';
    bar.innerHTML = `
    <span class="sw-update-banner__text">あたらしい バージョンが あります</span>
    <button type="button" class="sw-update-banner__apply">さいしんに する</button>
    <button type="button" class="sw-update-banner__close" aria-label="あとにする">あとで</button>
  `;

    bar.querySelector('.sw-update-banner__apply').addEventListener('click', () => {
        bar.remove();
        onApply();
    });
    bar.querySelector('.sw-update-banner__close').addEventListener('click', () => bar.remove());

    document.body.appendChild(bar);
};

const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
        showUpdateBanner(() => updateSW(true));
    },
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

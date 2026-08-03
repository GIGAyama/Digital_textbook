#!/usr/bin/env node
/**
 * 任意のリポジトリを GIGA Standard v4 の観点で実測する。
 *
 *   node audit-repo.mjs /workspace/<repo>
 *
 * 出力は JSON。AUDIT.md はこの数値をもとに書く。
 * 「推測で書かない」ための道具なので、判定できないものは null を返し、
 * 勝手に ✅ を付けない。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.argv[2];
if (!root || !fs.existsSync(root)) {
    console.error('使い方: node audit-repo.mjs /workspace/<repo>');
    process.exit(2);
}

const git = (cmd) => {
    try { return execSync(`git -C "${root}" ${cmd}`, { encoding: 'utf8' }); }
    catch { return ''; }
};
const files = git('ls-files').split('\n').filter(Boolean);
const read = (rel) => {
    const p = path.join(root, rel);
    try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
};
const has = (rel) => files.includes(rel);
const size = (rel) => { try { return fs.statSync(path.join(root, rel)).size; } catch { return null; } };

// --- 型の判定 -----------------------------------------------------------
const gsFiles = files.filter((f) => f.endsWith('.gs'));
const docsFiles = files.filter((f) => f.startsWith('docs/'));
const viteConfig = files.find((f) => /^vite\.config\.(js|ts|mjs)$/.test(f));
let type = 'A型';
if (gsFiles.length > 0) type = docsFiles.length > 0 ? 'C+型' : 'C型';
if (viteConfig) type = 'B型';
if (files.some((f) => /manifest\.json$/.test(f) && (read(f) || '').includes('manifest_version'))) type = 'D型';

// --- 画面まわりのファイルを集める ---------------------------------------
const textExt = /\.(html|css|js|jsx|ts|tsx)$/;
const skipDir = /^(node_modules|dist|dev-dist|public\/vendor|\.assets-original)\//;
const uiFiles = files.filter((f) => textExt.test(f) && !skipDir.test(f));
const uiText = uiFiles.map((f) => read(f) || '').join('\n');

// エントリ HTML の候補（PWA のシェルになりうるもの）
const entryCandidates = ['docs/index.html', 'public/index.html', 'pwa/index.html', 'index.html']
    .filter((f) => has(f));
const entry = entryCandidates[0] || null;
const entryText = entry ? read(entry) : null;

// --- Service Worker -----------------------------------------------------
const swFiles = files.filter((f) => /(^|\/)sw\.js$/.test(f));
const swReport = swFiles.map((f) => {
    const t = read(f) || '';
    const usesKeys = /caches\.keys\(\)/.test(t);
    const hasPrefix = /startsWith\s*\(/.test(t);
    return {
        file: f,
        全キャッシュ削除: usesKeys && !hasPrefix,
        localStorage参照: /localStorage/.test(t),
        skipWaiting即時: /install[\s\S]{0,400}skipWaiting/.test(t),
        更新通知: /SKIP_WAITING/.test(t),
    };
});

// --- manifest -----------------------------------------------------------
const manifestFile = files.find((f) => /manifest\.webmanifest$/.test(f));
let manifest = null;
if (manifestFile) { try { manifest = JSON.parse(read(manifestFile)); } catch { manifest = 'JSON壊れ'; } }
// B型は vite.config に manifest が埋まっていることがある
const viteText = viteConfig ? read(viteConfig) : null;

// --- 画像 ---------------------------------------------------------------
const images = files
    .filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f) && !skipDir.test(f))
    .map((f) => ({ file: f, KB: +(size(f) / 1024).toFixed(1) }))
    .sort((a, b) => b.KB - a.KB);

// --- 大きいファイル -----------------------------------------------------
const bigFiles = files
    .filter((f) => textExt.test(f) && !skipDir.test(f))
    .map((f) => {
        const t = read(f) || '';
        return { file: f, 行: t.split('\n').length, KB: +(Buffer.byteLength(t) / 1024).toFixed(1) };
    })
    .filter((x) => x.行 > 1500 || x.KB > 150)
    .sort((a, b) => b.行 - a.行);

const count = (re) => (uiText.match(re) || []).length;

const report = {
    リポジトリ: path.basename(root),
    型: type,
    ファイル数: files.length,

    A_法務: {
        LICENSE: has('LICENSE'),
        gitignore: has('.gitignore'),
        dependabot: files.some((f) => /dependabot\.yml$/.test(f)),
        README: has('README.md'),
        MANUAL: has('MANUAL.md'),
        AUDIT: has('AUDIT.md'),
        秘密の混入: files.filter((f) => /\.clasp\.json$|(^|\/)\.env$/.test(f)),
    },

    B_セキュリティ: {
        CSP: entryText ? /Content-Security-Policy/.test(entryText) : null,
        localStorage_clear: (uiText.match(/localStorage\s*\.\s*clear\s*\(/g) || []).length,
        postMessage_wildcard: (uiText.match(/postMessage\s*\([\s\S]{0,300}?,\s*['"]\*['"]\s*\)/g) || []).length,
        外部スクリプト: [...new Set((uiText.match(/https:\/\/(cdn|unpkg|cdnjs)[a-z0-9.\-]*/gi) || []))],
        oauthスコープ: (() => {
            const a = read('appsscript.json');
            if (!a) return null;
            try { return JSON.parse(a).oauthScopes || []; } catch { return 'JSON壊れ'; }
        })(),
    },

    C_堅牢性: {
        pagehide: /pagehide/.test(uiText),
        LockService: /LockService/.test(gsFiles.map(read).join('\n')),
    },

    D_表示: {
        viewport一覧: [...new Set((uiText.match(/<meta[^>]*name=["']viewport["'][^>]*>/gi) || []))],
        '100vh単独': count(/(?:min-height|max-height|height)\s*:\s*100vh/g) - count(/100dvh/g) > 0
            ? count(/(?:min-height|max-height|height)\s*:\s*100vh/g) : 0,
        dvh: count(/dvh/g),
        safe_area: count(/safe-area-inset/g),
        clamp: count(/clamp\s*\(/g),
        prefers_reduced_motion: count(/prefers-reduced-motion/g),
        forced_colors: count(/forced-colors/g),
        touch_action: count(/touch-action/g),
        media_print: count(/@media\s+print/g),
        canvas2d: count(/getContext\s*\(\s*['"]2d['"]/g),
        devicePixelRatio: count(/devicePixelRatio/g),
        提示モード: /presentation|提示モード/.test(uiText),
    },

    E_PWA: {
        エントリ: entry,
        manifestファイル: manifestFile || (viteText && /VitePWA/.test(viteText) ? `${viteConfig} 内` : null),
        manifest: manifest,
        vite_manifest: viteText ? {
            id: (viteText.match(/\bid:\s*(.+)/) || [])[1]?.trim(),
            scope: (viteText.match(/\bscope:\s*(.+)/) || [])[1]?.trim(),
            start_url: (viteText.match(/start_url:\s*(.+)/) || [])[1]?.trim(),
            base: (viteText.match(/\bbase:\s*(.+)/) || [])[1]?.trim(),
        } : null,
        serviceWorker: swReport,
        beforeinstallprompt: count(/beforeinstallprompt/g),
        offline_html: files.filter((f) => /offline\.html$/.test(f)),
        アイコン: images.filter((f) => /icon|favicon|apple-touch/i.test(f.file)),
    },

    F_a11y性能: {
        aria_label: count(/aria-label/g),
        aria_live: count(/aria-live/g),
        role_dialog: count(/role=["']dialog["']/g),
        Escape処理: count(/['"]Escape['"]/g),
        button数: count(/<button/g),
        img数: count(/<img/g),
        大きいファイル: bigFiles,
    },

    G_画像: {
        '150KB超': images.filter((i) => i.KB > 150),
        合計KB: +images.reduce((s, i) => s + i.KB, 0).toFixed(1),
    },
};

console.log(JSON.stringify(report, null, 2));

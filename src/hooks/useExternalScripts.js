/**
 * 外部ライブラリ（pdf.js / fabric.js など）を読み込むフック。
 *
 * ライブラリはすべて自分のサイトから配る（public/vendor/。中身は npm から
 * scripts/sync-vendor.mjs が生成する）。以前は cdnjs / jsDelivr から読んでいたが、
 *   ・配信元が改ざんされると児童の端末で任意のコードが動く（SRI も無かった）
 *   ・学校のフィルタリングが CDN を塞ぐと、そもそもアプリが起動しない
 *   ・外部からスクリプトを読む前提だと CSP を厳しくできない
 * という3つの問題があったため、同一オリジンに寄せた。
 */
import { useState, useEffect } from 'react';
import { VENDOR, effectiveDpr } from '../constants.js';

export const useExternalScripts = () => {
  const [status, setStatus] = useState({ loaded: false, error: null });

  useEffect(() => {
    let cancelled = false;

    const loadScript = (src) => new Promise((resolve, reject) => {
      let script = document.querySelector(`script[data-vendor="${src}"]`);
      if (script) {
        if (script.getAttribute('data-loaded') === 'true') {
          return resolve();
        } else {
          script.addEventListener('load', resolve);
          script.addEventListener('error', () => reject(new Error(`読み込み失敗: ${src}`)));
          return;
        }
      }
      script = document.createElement('script');
      script.src = src;
      script.setAttribute('data-vendor', src);
      script.onload = () => {
        script.setAttribute('data-loaded', 'true');
        resolve();
      };
      script.onerror = () => {
        // 失敗したタグを残すと、次の試行が「読み込み中の既存タグ」と誤認して
        // 永久に待ち続ける。取り除いてからやり直せるようにする。
        script.remove();
        reject(new Error(`読み込み失敗: ${src}`));
      };
      document.head.appendChild(script);
    });

    // 40人が一斉に開くと校内Wi-Fiが詰まって取りこぼすことがある。
    // すぐ諦めず、間隔を空けて3回まで試す。
    const loadWithRetry = async (src, attempts = 3) => {
      let lastError;
      for (let i = 0; i < attempts; i++) {
        if (cancelled) return;
        try {
          return await loadScript(src);
        } catch (error) {
          lastError = error;
          if (i < attempts - 1) {
            await new Promise((r) => setTimeout(r, 600 * (i + 1)));
          }
        }
      }
      throw lastError;
    };

    const init = async () => {
      try {
        await loadWithRetry(VENDOR('pdf.min.js'));
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = VENDOR('pdf.worker.min.js');

        await loadWithRetry(VENDOR('fabric.min.js'));
        // fabric は既定で端末の devicePixelRatio をそのまま使う。
        // 3倍端末では 9倍の面積を確保することになり、メモリ4GBの Chromebook が
        // タブごと落ちる。2 で頭打ちにする（肉眼では 2 で十分きれい）。
        window.fabric.devicePixelRatio = effectiveDpr();

        await loadWithRetry(VENDOR('idb-keyval.umd.js'));
        await loadWithRetry(VENDOR('jsQR.js'));
        await loadWithRetry(VENDOR('peerjs.min.js'));
        await loadWithRetry(VENDOR('qrcode.min.js'));

        if (cancelled) return;
        setStatus({ loaded: true, error: null });
      } catch (error) {
        if (cancelled) return;
        console.error("ライブラリ読み込みエラー:", error);
        setStatus({ loaded: false, error: error.message });
      }
    };
    init();

    return () => { cancelled = true; };
  }, []);

  return status;
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Pencil, Eraser, Trash2, ChevronLeft, ChevronRight, Smile, Type,
  ZoomIn, ZoomOut, MousePointer2, BookOpen, Plus,
  Highlighter, Square, Circle, Minus, ArrowRight,
  StickyNote, Timer,
  Link as LinkIcon, Volume2, Settings, X,
  Undo2, Redo2, AlertCircle, CheckCircle2, Info, QrCode,
  Share2, Copy, Loader2, Download, Upload, Cloud,
  Maximize, Minimize, Columns, Check, PenTool, ChevronUp,
  Presentation, Printer, Smartphone
} from 'lucide-react';

// 定数・スタンプのデータ・fabric まわりの道具・画面の枠は別ファイルへ分けてある。
// このファイルには「アプリの流れ」だけを残す。
import {
  APP_NAME,
  DB_KEY_TEXTBOOKS, DB_KEY_DRAWINGS, DB_KEY_MYSTAMPS, DB_KEY_LAST_OPENED, DB_KEY_VIEW_MODE,
  BACKUP_FORMAT, BACKUP_VERSION,
  GOOGLE_CLIENT_ID, GDRIVE_SCOPE, GDRIVE_FILE_NAME, GIS_SRC,
  DB_KEY_DRIVE_FILE_ID, DB_KEY_DRIVE_AUTOSAVE, DB_KEY_DRIVE_LAST_SYNC,
  COLORS, STICKY_COLORS,
  EDGE_SWIPE_ZONE, EDGE_SWIPE_DISTANCE, EDGE_SWIPE_MAX_SLOPE, BACK_NAV_INTERVAL,
  PAGE_SWIPE_SLOP, PAGE_SWIPE_DISTANCE, OBJECT_GRAB_MARGIN,
  PDF_RENDER_SCALE,
} from './constants.js';
import { STAMP_CATEGORIES, STAMPS_DATA } from './data/stamps.js';
import { StampPreview, createPremiumStamp } from './data/sealStamps.jsx';
import { serializeCanvas, isSafeUrl, applyCanvasMode, createMathShape } from './lib/fabricHelpers.js';
import { useExternalScripts } from './hooks/useExternalScripts.js';
import { Header, Footer, TimerPanel } from './components/Chrome.jsx';

// ==========================================
// メインアプリケーション
// ==========================================
export default function App() {
  const { loaded: scriptsLoaded, error: scriptError } = useExternalScripts();
  
  // App States
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [textbooks, setTextbooks] = useState([]);
  const [currentTextbookId, setCurrentTextbookId] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageHistory, setPageHistory] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  const currentTextbook = textbooks.find(tb => tb.id === currentTextbookId);
  const currentPages = currentTextbook ? currentTextbook.pages : [];
  
  // P2P Share States
  const [shareMode, setShareMode] = useState('none'); // 'none', 'hosting', 'receiving'
  const [shareUrl, setShareUrl] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const qrCanvasRef = useRef(null);

  // Editor States
  // 開いた直後の誤書き込みを防ぐため、初期モードは「選択」にする
  const [mode, setMode] = useState('select');
  const [color, setColor] = useState(COLORS[0]);
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState(null); // キャンバスの内部ピクセルサイズ
  const [fitScale, setFitScale] = useState(1); // 画面サイズに合わせた表示倍率

  // 表示モード: 'full' = ページ全体 / 'half' = 縦画面向けにページを中央で分割して半分ずつ表示
  const [viewMode, setViewMode] = useState('full');
  const [halfOrder, setHalfOrder] = useState('ltr'); // 'ltr' = 左から先 / 'rtl' = 右から先 (国語など右開きの教科書用)
  const [halfSide, setHalfSide] = useState('left'); // 現在表示している側
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [historyTrigger, setHistoryTrigger] = useState(0); // Undo/Redo UI更新用
  
  // UI States
  const [showStampMenu, setShowStampMenu] = useState(false);
  const [stampTab, setStampTab] = useState('eval');
  const [myStamps, setMyStamps] = useState([]);
  const [showMyStampCreator, setShowMyStampCreator] = useState(false);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showStickyMenu, setShowStickyMenu] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPageJump, setShowPageJump] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  // 教科書画面ではツールバーを常時表示せず、必要なときだけ呼び出せるようにする
  const [showToolbar, setShowToolbar] = useState(false);
  // 提示モード（電子黒板で一斉授業に使うとき、教室の後ろの席から読める大きさにする）
  const [isPresentation, setIsPresentation] = useState(false);
  // 「アプリを入れる」ボタンを出してよいか（Chrome から合図が来たときだけ true）
  const [canInstall, setCanInstall] = useState(false);

  // Custom Dialog & Toast
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);

  // Refs
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const containerRef = useRef(null);
  const canvasScrollRef = useRef(null); // キャンバスを包むスクロール領域(ページ送りスワイプの判定に使う)
  const drawingsRef = useRef({});
  
  // History & Debounce Refs
  const historyRef = useRef([]);
  const redoStackRef = useRef([]);
  const isHistoryProcessing = useRef(false);
  const saveTimeoutRef = useRef(null);
  const modeRef = useRef(mode);
  const colorRef = useRef(color);
  // fabric.js のイベントハンドラはキャンバス生成時に一度だけ登録されるため、
  // ページ切替後も常に最新の値を参照できるよう ref 経由でアクセスする
  const currentTextbookIdRef = useRef(currentTextbookId);
  const currentPageRef = useRef(currentPage);
  const scanQRCodeRef = useRef(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { currentTextbookIdRef.current = currentTextbookId; }, [currentTextbookId]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // --- Utility Functions ---
  const toastTimeoutRef = useRef(null);
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const showConfirm = useCallback((title, message, onConfirm, confirmText = "実行する", isDestructive = false) => {
    setDialog({ title, message, onConfirm, confirmText, isDestructive });
  }, []);

  const closeAllMenus = useCallback(() => {
    setShowStampMenu(false); setShowShapeMenu(false); setShowStickyMenu(false); setShowLinkMenu(false); setShowPageJump(false); setShowViewMenu(false);
  }, []);

  // 教科書画面から一覧(ホーム)へ戻る。ボタンと「戻る」操作で共通に使う
  const goToLibrary = useCallback(() => {
    closeAllMenus();
    setShowTimer(false);
    setShowToolbar(false);
    setIsFullscreen(false);
    setCurrentTextbookId(null);
  }, [closeAllMenus]);

  // 枠で囲んだ範囲、または画面全体をスキャンする
  const scanQRCode = useCallback(async (rect) => {
    const fCanvas = fabricRef.current;
    if (!fCanvas) return;
    showToast("QRコードを解析中...", "info");

    // 1つの画像候補を BarcodeDetector → jsQR(白黒反転も試行) の順で解析する
    const decodeCanvas = async (cv) => {
      if (!cv || cv.width < 12 || cv.height < 12) return null;
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(cv);
          if (barcodes.length > 0 && barcodes[0].rawValue) return barcodes[0].rawValue;
        } catch (e) { console.warn("BarcodeDetector error", e); }
      }
      if (window.jsQR) {
        try {
          const ctx = cv.getContext('2d');
          const imageData = ctx.getImageData(0, 0, cv.width, cv.height);
          const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
          if (code && code.data) return code.data;
        } catch (e) { console.error("jsQR error", e); }
      }
      return null;
    };

    const loadImage = (src) => new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });

    const drawToCanvas = (source, sx, sy, sw, sh, scale = 1) => {
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(sw * scale));
      cv.height = Math.max(1, Math.round(sh * scale));
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      return cv;
    };

    try {
      const hasRect = rect && rect.width > 10 && rect.height > 10;
      // 解析候補は必要になった時点で生成する(遅延評価でメモリ節約)
      const candidateFns = [];

      // 1. 表示用に縮小される前の「元のページ画像」を最優先で解析する(最も高精細)
      const pageImg = await loadImage(currentPages[currentPage]);
      if (pageImg) {
        const ratioX = pageImg.width / fCanvas.width;
        const ratioY = pageImg.height / fCanvas.height;
        if (hasRect) {
          const pad = 40;
          const sx = Math.max(0, rect.left * ratioX - pad);
          const sy = Math.max(0, rect.top * ratioY - pad);
          const sw = Math.min(pageImg.width - sx, rect.width * ratioX + pad * 2);
          const sh = Math.min(pageImg.height - sy, rect.height * ratioY + pad * 2);
          if (sw > 12 && sh > 12) {
            candidateFns.push(() => drawToCanvas(pageImg, sx, sy, sw, sh, 1));
            // 小さなQRコードは拡大版も試して認識率を上げる
            candidateFns.push(() => drawToCanvas(pageImg, sx, sy, sw, sh, Math.max(sw, sh) < 500 ? 3 : 1.5));
          }
        }
        candidateFns.push(() => drawToCanvas(pageImg, 0, 0, pageImg.width, pageImg.height, 1));
        if (pageImg.width > 1600) {
          candidateFns.push(() => drawToCanvas(pageImg, 0, 0, pageImg.width, pageImg.height, 1200 / pageImg.width));
        }
      }

      // 2. 書き込みやスタンプで貼られたQRも読めるよう、現在のキャンバス表示も解析する
      const snapshot = await loadImage(fCanvas.toDataURL({ format: 'png', multiplier: 2 }));
      if (snapshot) {
        if (hasRect) {
          const pad = 60;
          const sx = Math.max(0, rect.left * 2 - pad);
          const sy = Math.max(0, rect.top * 2 - pad);
          const sw = Math.min(snapshot.width - sx, rect.width * 2 + pad * 2);
          const sh = Math.min(snapshot.height - sy, rect.height * 2 + pad * 2);
          if (sw > 12 && sh > 12) candidateFns.push(() => drawToCanvas(snapshot, sx, sy, sw, sh, 1));
        }
        candidateFns.push(() => drawToCanvas(snapshot, 0, 0, snapshot.width, snapshot.height, 1));
      }

      let decodedUrl = null;
      for (const makeCandidate of candidateFns) {
        decodedUrl = await decodeCanvas(makeCandidate());
        if (decodedUrl) break;
      }

      if (decodedUrl) {
        if (isSafeUrl(decodedUrl)) {
          window.open(decodedUrl, '_blank', 'noopener');
          showToast("QRコードを読み取りました", "success");
        } else {
          showToast(`QRコードの内容: ${decodedUrl}`, "info");
        }
      } else {
        showToast("QRコードが見つかりません。QRコードの周囲を少し広めに囲んでみてください。", "error");
      }
    } finally {
      setMode('select');
    }
  }, [showToast, currentPages, currentPage]);

  useEffect(() => { scanQRCodeRef.current = scanQRCode; }, [scanQRCode]);

  // --- Initialization ---
  useEffect(() => {
    // スタンプ・テキストの描画で使うWebフォントを先読みしておく
    // (未ロードのままだと fabric.js の文字幅計算がずれるため)
    if (document.fonts && document.fonts.load) {
      document.fonts.load("700 40px 'Zen Maru Gothic'");
      document.fonts.load("400 40px 'Zen Maru Gothic'");
    }

    const savedMyStamps = localStorage.getItem(DB_KEY_MYSTAMPS);
    if (savedMyStamps) { try { setMyStamps(JSON.parse(savedMyStamps)); } catch(e){} }

    // 表示モード(全体/半ページ・左右どちらが先か)の復元
    const savedView = localStorage.getItem(DB_KEY_VIEW_MODE);
    if (savedView) {
      try {
        const v = JSON.parse(savedView);
        const order = v.order === 'rtl' ? 'rtl' : 'ltr';
        setHalfOrder(order);
        setHalfSide(order === 'rtl' ? 'right' : 'left');
        if (v.mode === 'half') setViewMode('half');
      } catch(e){}
    }
  }, []);

  // 表示モードの保存
  useEffect(() => {
    localStorage.setItem(DB_KEY_VIEW_MODE, JSON.stringify({ mode: viewMode, order: halfOrder }));
  }, [viewMode, halfOrder]);

  // --- 提示モード（電子黒板・一斉授業） ---
  // 教室のいちばん後ろの席から読めることが要件。CSS 側で <body> に付いた
  // .presentation を見て、文字とボタンをまとめて大きくする。
  useEffect(() => {
    document.body.classList.toggle('presentation', isPresentation);
    return () => document.body.classList.remove('presentation');
  }, [isPresentation]);

  // --- 「アプリを入れる」ボタン ---
  // 合図そのものは index.html の最上部（public/pwa-install-hook.js）で
  // 受け取り済み。ここでは、その結果をボタンの表示に反映するだけ。
  useEffect(() => {
    // ホーム画面から起動しているときは、もう入れる必要がないので出さない
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return;

    if (window.__deferredInstallPrompt) setCanInstall(true);

    const onInstallable = () => setCanInstall(true);
    const onInstalled = () => setCanInstall(false);
    window.addEventListener('pwa-installable', onInstallable);
    window.addEventListener('pwa-installed', onInstalled);
    return () => {
      window.removeEventListener('pwa-installable', onInstallable);
      window.removeEventListener('pwa-installed', onInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = window.__deferredInstallPrompt;
    if (!prompt) return;
    window.__deferredInstallPrompt = null;
    setCanInstall(false);
    try {
      prompt.prompt();
      await prompt.userChoice;
    } catch (e) {
      // 合図は一度きりしか使えない。失敗しても再表示はしない（二重に出ると混乱する）
      console.warn('インストールの案内を出せませんでした', e);
    }
  }, []);

  // --- 印刷 ---
  // 画面はスクロールを止めて1画面に収める作りなので、そのまま印刷すると
  // 表示中の一部しか出ない。印刷したい領域に .print-target を付け、
  // 向きだけ <body> のクラスで切り替える（@page は普通のセレクタで書けないため）。
  const handlePrint = useCallback(() => {
    const canvas = fabricRef.current;
    // 横長のページは横向きで刷らないと、まわりが大きく余ってしまう
    const landscape = !!canvas && canvas.width > canvas.height;
    document.body.classList.toggle('print-landscape', landscape);
    const cleanup = () => {
      document.body.classList.remove('print-landscape');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }, []);

  // --- 全画面表示 ---
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      // ブラウザのフルスクリーンAPIはベストエフォート
      // (iPhoneのSafari等では未対応のため、その場合もUIを隠す「集中モード」として動作する)
      setIsFullscreen(true);
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) { try { const p = req.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    } else {
      setIsFullscreen(false);
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) { try { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
      }
    }
  }, [isFullscreen]);

  // Escキー等でブラウザ側のフルスクリーンが解除されたときに状態を同期する
  useEffect(() => {
    const onChange = () => {
      if (!(document.fullscreenElement || document.webkitFullscreenElement)) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  useEffect(() => {
    if (!scriptsLoaded) return;
    const initDB = async () => {
      try {
        const savedBooks = await window.idbKeyval.get(DB_KEY_TEXTBOOKS);
        const savedDrawings = await window.idbKeyval.get(DB_KEY_DRAWINGS);
        if (savedBooks) setTextbooks(savedBooks);
        if (savedDrawings) drawingsRef.current = savedDrawings;
        
        // 各教科書のページ履歴のロード
        const savedHistory = localStorage.getItem('digital_textbook_page_history');
        let parsedHistory = {};
        if (savedHistory) {
          try { parsedHistory = JSON.parse(savedHistory); setPageHistory(parsedHistory); } catch(e){}
        }

        // 前回開いていた状態の復元
        if (savedBooks && savedBooks.length > 0) {
          const lastOpenedId = localStorage.getItem(DB_KEY_LAST_OPENED);
          if (lastOpenedId && savedBooks.find(tb => tb.id === lastOpenedId)) {
            setCurrentTextbookId(lastOpenedId);
            setCurrentPage(parsedHistory[lastOpenedId] || 0);
          }
        }
      } catch (e) { console.error("データ読み込み失敗", e); } 
      finally { setIsDataLoaded(true); }
    };
    initDB();
  }, [scriptsLoaded]);

  // 開いている教科書・ページの保存
  useEffect(() => {
    if (!isDataLoaded) return;
    if (currentTextbookId !== null) {
      localStorage.setItem(DB_KEY_LAST_OPENED, currentTextbookId);
      setPageHistory(prev => {
        const next = { ...prev, [currentTextbookId]: currentPage };
        localStorage.setItem('digital_textbook_page_history', JSON.stringify(next));
        return next;
      });
    } else {
      localStorage.removeItem(DB_KEY_LAST_OPENED);
    }
  }, [currentTextbookId, currentPage, isDataLoaded]);

  // --- P2P Share Logic ---
  // 受信側の処理（URLに ?host=ID がある場合）
  useEffect(() => {
    if (!isDataLoaded || !scriptsLoaded || !window.Peer) return;
    const urlParams = new URLSearchParams(window.location.search);
    const hostId = urlParams.get('host');
    
    if (hostId && shareMode === 'none') {
      setShareMode('receiving');
      setShareStatus('ホストに接続しています...');
      
      const peer = new window.Peer();
      peer.on('open', () => {
        const conn = peer.connect(hostId, { reliable: true });
        
        conn.on('open', () => {
          setShareStatus('データをダウンロード中...');
        });
        
        conn.on('data', async (data) => {
          setShareStatus('データを保存中...');
          try {
            const newId = 'tb_' + Date.now();
            const newTb = { 
              id: newId, 
              title: data.title + ' (共有)', 
              coverImage: data.pages[0], 
              pages: data.pages 
            };
            
            // 既存データとマージして保存
            const updatedTextbooks = await window.idbKeyval.get(DB_KEY_TEXTBOOKS) || [];
            const newTextbooks = [...updatedTextbooks, newTb];
            await window.idbKeyval.set(DB_KEY_TEXTBOOKS, newTextbooks);
            
            const updatedDrawings = await window.idbKeyval.get(DB_KEY_DRAWINGS) || {};
            updatedDrawings[newId] = data.drawings;
            await window.idbKeyval.set(DB_KEY_DRAWINGS, updatedDrawings);
            
            // 状態の更新
            setTextbooks(newTextbooks);
            drawingsRef.current = updatedDrawings;
            setCurrentTextbookId(newId);
            setCurrentPage(0);
            
            // URLからパラメータを削除してクリーンにする
            window.history.replaceState({}, document.title, window.location.pathname);
            
            showToast("共有データを受信しました！", "success");
          } catch(e) {
            showToast("データの保存に失敗しました", "error");
          } finally {
            setShareMode('none');
            peer.destroy();
          }
        });
        
        conn.on('error', () => {
          showToast("接続エラーが発生しました", "error");
          setShareMode('none');
        });
      });

      // ホストが見つからない・シグナリングサーバーに繋がらない場合など
      // (これがないと受信モーダルが永久に閉じられなくなる)
      peer.on('error', (err) => {
        console.error("Peer接続エラー:", err);
        showToast("ホストに接続できませんでした。共有元の画面が開いているか確認してください。", "error");
        window.history.replaceState({}, document.title, window.location.pathname);
        setShareMode('none');
        peer.destroy();
      });
    }
  }, [isDataLoaded, scriptsLoaded, showToast, shareMode]);

  // ホスト側（先生）の処理
  const startHosting = () => {
    if (!currentTextbookId || !window.Peer) return;
    
    // 描画データを最新にするため強制セーブ
    if(fabricRef.current) {
      if (!drawingsRef.current[currentTextbookId]) drawingsRef.current[currentTextbookId] = {};
      drawingsRef.current[currentTextbookId][currentPage] = serializeCanvas(fabricRef.current);
    }

    setShareMode('hosting');
    setShareStatus('共有用のURLを作成中...');
    
    const peer = new window.Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      const url = new URL(window.location.href);
      url.searchParams.set('host', id);
      setShareUrl(url.toString());
      setShareStatus('待機中... URLを共有してください。');
    });

    peer.on('connection', (conn) => {
      connRef.current = conn;
      setShareStatus('受信者と接続しました。データを送信中...');
      
      conn.on('open', () => {
        const dataToShare = {
          title: currentTextbook.title,
          pages: currentTextbook.pages,
          drawings: drawingsRef.current[currentTextbookId] || {}
        };
        // 大容量データ送信
        conn.send(dataToShare);
        setShareStatus('送信完了！ (複数人に送る場合はこのまま待機してください)');
      });
    });

    peer.on('error', (err) => {
      console.error(err);
      setShareStatus('エラーが発生しました: ' + err.type);
    });
  };

  const stopHosting = () => {
    if (peerRef.current) peerRef.current.destroy();
    setShareMode('none');
    setShareUrl('');
  };

  // URLが変わったらQRコードを生成
  useEffect(() => {
    if (shareMode === 'hosting' && shareUrl && qrCanvasRef.current && window.QRCode) {
      window.QRCode.toCanvas(qrCanvasRef.current, shareUrl, {
        width: 160,
        margin: 2,
        color: {
          dark: '#1e293b', // slate-800
          light: '#ffffff'
        }
      }, (error) => {
        if (error) console.error("QRコード生成エラー:", error);
      });
    }
  }, [shareUrl, shareMode]);

  // --- PDF Handlers ---
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !scriptsLoaded || !isDataLoaded) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
      const numPages = pdf.numPages;
      const newPages = [];
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        // JPEG は透明を扱えない。白で塗ってから描かないと、背景が透明な
        // PDF が黒くつぶれて出ることがある。
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        newPages.push(canvas.toDataURL('image/jpeg', 0.85));
        // 大きなページを何十枚も続けて描くとメモリを使い切るため、
        // 1枚ごとに描画用のピクセルを手放す（Chromebook のタブ破棄対策）。
        canvas.width = 0; canvas.height = 0;
        page.cleanup();
      }
      pdf.destroy();
      const newId = 'tb_' + Date.now();
      const newTextbook = { id: newId, title: file.name.replace(/\.[^/.]+$/, ""), coverImage: newPages[0], pages: newPages };
      const newTextbooks = [...textbooks, newTextbook];
      await window.idbKeyval.set(DB_KEY_TEXTBOOKS, newTextbooks);
      setTextbooks(newTextbooks);
      setCurrentTextbookId(newId);
      setCurrentPage(0);
      setZoom(1);
      showToast("PDFを読み込みました", "success");
    } catch (error) { showToast("PDFの読み込みに失敗しました", "error"); } 
    finally { setIsProcessing(false); e.target.value = null; }
  };

  // --- Backup (Export / Import) ---
  const [isExporting, setIsExporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // { fileName, data, summary }
  const importFileInputRef = useRef(null);

  // --- Googleドライブ同期 ---
  const driveEnabled = !!GOOGLE_CLIENT_ID;
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveBusy, setDriveBusy] = useState(null); // null | 'connecting' | 'saving' | 'loading'
  const [driveAutoSave, setDriveAutoSave] = useState(() => localStorage.getItem(DB_KEY_DRIVE_AUTOSAVE) === '1');
  const [driveLastSync, setDriveLastSync] = useState(() => localStorage.getItem(DB_KEY_DRIVE_LAST_SYNC) || '');
  const gisTokenClientRef = useRef(null);
  const driveTokenRef = useRef({ token: null, expiresAt: 0 });
  const driveFileIdRef = useRef(localStorage.getItem(DB_KEY_DRIVE_FILE_ID) || null);
  const driveAutoSaveTimerRef = useRef(null);

  // 現在編集中のキャンバスを保存したうえでバックアップ用のデータを組み立てる
  // (ファイル書き出し・Googleドライブ保存の両方で共有する)
  const buildBackupPayload = useCallback(async () => {
    if (fabricRef.current && currentTextbookId !== null) {
      if (!drawingsRef.current[currentTextbookId]) drawingsRef.current[currentTextbookId] = {};
      drawingsRef.current[currentTextbookId][currentPage] = serializeCanvas(fabricRef.current);
      try { await window.idbKeyval.set(DB_KEY_DRAWINGS, drawingsRef.current); } catch (e) {}
    }
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      appName: APP_NAME,
      textbooks,
      drawings: drawingsRef.current || {},
      myStamps,
    };
  }, [textbooks, myStamps, currentTextbookId, currentPage]);

  const handleExportBackup = useCallback(async () => {
    if (!isDataLoaded) return;
    if (textbooks.length === 0) {
      showToast("エクスポートする教科書がありません", "error");
      return;
    }
    setIsExporting(true);
    try {
      const payload = await buildBackupPayload();
      const json = JSON.stringify(payload);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
      a.href = url;
      a.download = `digital-textbook-backup-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("バックアップファイルをダウンロードしました", "success");
    } catch (err) {
      console.error(err);
      showToast("エクスポートに失敗しました", "error");
    } finally {
      setIsExporting(false);
    }
  }, [isDataLoaded, textbooks, buildBackupPayload, showToast]);

  // バックアップデータから取り込み確認モーダルを開く
  // (ファイル選択・Googleドライブからの復元の両方で共有する)
  const openImportPreview = useCallback((data, sourceName) => {
    if (!data || data.format !== BACKUP_FORMAT || !Array.isArray(data.textbooks)) {
      showToast("このデータはバックアップ形式ではありません", "error");
      return false;
    }
    const tbCount = data.textbooks.length;
    const pageCount = data.textbooks.reduce((sum, tb) => sum + (Array.isArray(tb.pages) ? tb.pages.length : 0), 0);
    const stampCount = Array.isArray(data.myStamps) ? data.myStamps.length : 0;
    const exportedAt = data.exportedAt ? new Date(data.exportedAt).toLocaleString('ja-JP') : "不明";
    setImportPreview({
      fileName: sourceName,
      data,
      summary: { tbCount, pageCount, stampCount, exportedAt },
    });
    return true;
  }, [showToast]);

  const handleImportFileSelected = useCallback(async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = null;
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      openImportPreview(data, file.name);
    } catch (err) {
      console.error(err);
      showToast("ファイルの読み込みに失敗しました", "error");
    }
  }, [openImportPreview, showToast]);

  const applyImport = useCallback(async (mode) => {
    if (!importPreview) return;
    const { data } = importPreview;
    setIsProcessing(true);
    try {
      const incomingBooks = Array.isArray(data.textbooks) ? data.textbooks : [];
      const incomingDrawings = data.drawings && typeof data.drawings === 'object' ? data.drawings : {};
      const incomingStamps = Array.isArray(data.myStamps) ? data.myStamps : [];

      let newTextbooks;
      let newDrawings;
      let newMyStamps;

      if (mode === 'replace') {
        newTextbooks = incomingBooks;
        newDrawings = incomingDrawings;
        newMyStamps = incomingStamps;
      } else {
        const existingIds = new Set(textbooks.map(tb => tb.id));
        const idRemap = {};
        const merged = [...textbooks];
        for (const tb of incomingBooks) {
          let newId = tb.id;
          if (existingIds.has(newId)) {
            newId = 'tb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            idRemap[tb.id] = newId;
          }
          existingIds.add(newId);
          merged.push({ ...tb, id: newId, title: idRemap[tb.id] ? `${tb.title} (取込)` : tb.title });
        }
        newTextbooks = merged;

        newDrawings = { ...(drawingsRef.current || {}) };
        for (const [origId, pages] of Object.entries(incomingDrawings)) {
          const targetId = idRemap[origId] || origId;
          newDrawings[targetId] = pages;
        }

        const stampKey = (s) => `${s.text}|${s.color}|${s.shape}`;
        const existingKeys = new Set(myStamps.map(stampKey));
        const mergedStamps = [...myStamps];
        for (const s of incomingStamps) {
          if (s && typeof s === 'object' && !existingKeys.has(stampKey(s))) {
            mergedStamps.push(s);
            existingKeys.add(stampKey(s));
          }
        }
        newMyStamps = mergedStamps;
      }

      await window.idbKeyval.set(DB_KEY_TEXTBOOKS, newTextbooks);
      await window.idbKeyval.set(DB_KEY_DRAWINGS, newDrawings);
      localStorage.setItem(DB_KEY_MYSTAMPS, JSON.stringify(newMyStamps));

      drawingsRef.current = newDrawings;
      setTextbooks(newTextbooks);
      setMyStamps(newMyStamps);

      if (mode === 'replace') {
        setCurrentTextbookId(null);
        setCurrentPage(0);
      }

      showToast(mode === 'replace' ? "データを置き換えました" : "データを追加で取り込みました", "success");
    } catch (err) {
      console.error(err);
      showToast("インポートに失敗しました", "error");
    } finally {
      setIsProcessing(false);
      setImportPreview(null);
    }
  }, [importPreview, textbooks, myStamps, showToast]);

  // ==========================================
  // Googleドライブ同期のロジック
  // Google Identity Services (GIS) でアクセストークンを取得し、
  // Drive REST API を直接呼び出して自分のドライブにバックアップを保存/復元する。
  // スコープは drive.file (このアプリが作成したファイルのみ) なので、
  // 他のドライブ内ファイルには一切アクセスしない。
  // ==========================================

  // GIS スクリプトを必要になったタイミングで読み込む
  const ensureGisLoaded = useCallback(() => new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      resolve(); return;
    }
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GIS読み込み失敗')));
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('GIS読み込み失敗'));
    document.head.appendChild(s);
  }), []);

  // 有効なアクセストークンを取得する (期限切れ・未取得なら要求する)
  const getDriveToken = useCallback(async (interactive) => {
    const now = Date.now();
    if (driveTokenRef.current.token && driveTokenRef.current.expiresAt - 60000 > now) {
      return driveTokenRef.current.token;
    }
    await ensureGisLoaded();
    if (!gisTokenClientRef.current) {
      gisTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GDRIVE_SCOPE,
        callback: () => {}, // 呼び出しごとに差し替える
      });
    }
    return new Promise((resolve, reject) => {
      gisTokenClientRef.current.callback = (resp) => {
        if (resp && resp.error) { reject(new Error(resp.error)); return; }
        driveTokenRef.current = {
          token: resp.access_token,
          expiresAt: Date.now() + ((resp.expires_in || 3600) * 1000),
        };
        setDriveConnected(true);
        resolve(resp.access_token);
      };
      try {
        gisTokenClientRef.current.requestAccessToken({ prompt: interactive ? '' : 'none' });
      } catch (err) { reject(err); }
    });
  }, [ensureGisLoaded]);

  // Drive API 呼び出し用のラッパー (401 のときは一度だけ再認証して再試行)
  const driveFetch = useCallback(async (url, opts = {}, retry = true) => {
    const token = await getDriveToken(false);
    const res = await fetch(url, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 && retry) {
      driveTokenRef.current = { token: null, expiresAt: 0 };
      return driveFetch(url, opts, false);
    }
    return res;
  }, [getDriveToken]);

  // このアプリが作成したバックアップファイルのIDを探す
  const findDriveFileId = useCallback(async () => {
    if (driveFileIdRef.current) {
      // 保存済みIDがまだ有効か軽く確認する
      const check = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileIdRef.current}?fields=id,trashed`
      );
      if (check.ok) {
        const info = await check.json();
        if (!info.trashed) return driveFileIdRef.current;
      }
      driveFileIdRef.current = null;
      localStorage.removeItem(DB_KEY_DRIVE_FILE_ID);
    }
    const q = encodeURIComponent(`name='${GDRIVE_FILE_NAME}' and trashed=false`);
    const res = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`
    );
    if (!res.ok) throw new Error('ドライブの検索に失敗しました');
    const json = await res.json();
    const found = json.files && json.files[0];
    if (found) {
      driveFileIdRef.current = found.id;
      localStorage.setItem(DB_KEY_DRIVE_FILE_ID, found.id);
      return found.id;
    }
    return null;
  }, [driveFetch]);

  // バックアップをドライブに保存する (新規作成 or 上書き)。レジューム可能アップロードで大容量PDFにも対応。
  const uploadToDrive = useCallback(async (payload) => {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const existingId = await findDriveFileId();
    const metadata = existingId
      ? {}
      : { name: GDRIVE_FILE_NAME, mimeType: 'application/json', description: 'デジタル教科書メーカーのバックアップ' };
    const initUrl = existingId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=resumable`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`;
    const initRes = await driveFetch(initUrl, {
      method: existingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(metadata),
    });
    if (!initRes.ok) throw new Error('アップロードの開始に失敗しました');
    const sessionUri = initRes.headers.get('Location');
    if (!sessionUri) throw new Error('アップロードセッションを取得できませんでした');
    // セッションURIへは Authorization ヘッダー不要 (URI自体に認可が含まれる)
    const putRes = await fetch(sessionUri, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: blob,
    });
    if (!putRes.ok) throw new Error('データのアップロードに失敗しました');
    const info = await putRes.json();
    if (info && info.id) {
      driveFileIdRef.current = info.id;
      localStorage.setItem(DB_KEY_DRIVE_FILE_ID, info.id);
    }
    const stamp = new Date().toLocaleString('ja-JP');
    localStorage.setItem(DB_KEY_DRIVE_LAST_SYNC, stamp);
    setDriveLastSync(stamp);
  }, [driveFetch, findDriveFileId]);

  // ドライブに接続する (トークンを取得)
  const handleDriveConnect = useCallback(async () => {
    if (!driveEnabled) return;
    setDriveBusy('connecting');
    try {
      await getDriveToken(true);
      showToast('Googleドライブに接続しました', 'success');
    } catch (err) {
      console.error(err);
      showToast('Googleドライブへの接続に失敗しました', 'error');
    } finally {
      setDriveBusy(null);
    }
  }, [driveEnabled, getDriveToken, showToast]);

  const handleDriveDisconnect = useCallback(() => {
    const token = driveTokenRef.current.token;
    if (token && window.google && window.google.accounts && window.google.accounts.oauth2) {
      try { window.google.accounts.oauth2.revoke(token, () => {}); } catch (e) {}
    }
    driveTokenRef.current = { token: null, expiresAt: 0 };
    setDriveConnected(false);
    showToast('Googleドライブとの接続を解除しました', 'success');
  }, [showToast]);

  // 手動でドライブに保存する
  const handleDriveSave = useCallback(async () => {
    if (!driveEnabled || !isDataLoaded) return;
    if (textbooks.length === 0) {
      showToast('保存する教科書がありません', 'error');
      return;
    }
    setDriveBusy('saving');
    try {
      const payload = await buildBackupPayload();
      await uploadToDrive(payload);
      showToast('Googleドライブに保存しました', 'success');
    } catch (err) {
      console.error(err);
      showToast('Googleドライブへの保存に失敗しました', 'error');
    } finally {
      setDriveBusy(null);
    }
  }, [driveEnabled, isDataLoaded, textbooks, buildBackupPayload, uploadToDrive, showToast]);

  // ドライブから復元する (取り込み確認モーダルを開く)
  const handleDriveLoad = useCallback(async () => {
    if (!driveEnabled) return;
    setDriveBusy('loading');
    try {
      await getDriveToken(true);
      const fileId = await findDriveFileId();
      if (!fileId) {
        showToast('ドライブに保存されたバックアップが見つかりません', 'error');
        return;
      }
      const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
      if (!res.ok) throw new Error('ダウンロードに失敗しました');
      const data = await res.json();
      openImportPreview(data, `Googleドライブ (${GDRIVE_FILE_NAME})`);
    } catch (err) {
      console.error(err);
      showToast('Googleドライブからの読み込みに失敗しました', 'error');
    } finally {
      setDriveBusy(null);
    }
  }, [driveEnabled, getDriveToken, findDriveFileId, driveFetch, openImportPreview, showToast]);

  const handleToggleAutoSave = useCallback(async () => {
    const next = !driveAutoSave;
    setDriveAutoSave(next);
    localStorage.setItem(DB_KEY_DRIVE_AUTOSAVE, next ? '1' : '0');
    if (next && !driveConnected) {
      try { await getDriveToken(true); } catch (e) { /* 接続失敗時もトグルは維持し次回に再試行 */ }
    }
    showToast(next ? '自動保存をオンにしました' : '自動保存をオフにしました', 'success');
  }, [driveAutoSave, driveConnected, getDriveToken, showToast]);

  // 自動保存: 接続中かつ自動保存オンのとき、データ変更を検知して少し待ってからドライブへ保存する。
  // historyTrigger を含めることで、ページへの書き込み(お絵かき)も検知できる。
  useEffect(() => {
    if (!driveEnabled || !driveAutoSave || !driveConnected || !isDataLoaded) return;
    if (textbooks.length === 0) return;
    if (driveAutoSaveTimerRef.current) clearTimeout(driveAutoSaveTimerRef.current);
    driveAutoSaveTimerRef.current = setTimeout(async () => {
      try {
        const payload = await buildBackupPayload();
        await uploadToDrive(payload);
      } catch (e) { console.error('ドライブ自動保存に失敗しました', e); }
    }, 4000); // 4秒デバウンス
    return () => { if (driveAutoSaveTimerRef.current) clearTimeout(driveAutoSaveTimerRef.current); };
  }, [textbooks, myStamps, historyTrigger, driveEnabled, driveAutoSave, driveConnected, isDataLoaded]);

  const deleteTextbook = (id, e) => {
    e.stopPropagation();
    showConfirm(
      "教科書の削除", 
      "この教科書とすべての書き込みデータを完全に削除します。よろしいですか？", 
      async () => {
        const newTextbooks = textbooks.filter(tb => tb.id !== id);
        setTextbooks(newTextbooks);
        await window.idbKeyval.set(DB_KEY_TEXTBOOKS, newTextbooks);
        if (drawingsRef.current[id]) {
          delete drawingsRef.current[id];
          await window.idbKeyval.set(DB_KEY_DRAWINGS, drawingsRef.current);
        }
        setPageHistory(prev => {
          const next = { ...prev };
          delete next[id];
          localStorage.setItem('digital_textbook_page_history', JSON.stringify(next));
          return next;
        });
        showToast("教科書を削除しました", "success");
      },
      "削除する",
      true
    );
  };

  // --- History & AutoSave System ---
  const saveHistory = useCallback(() => {
    if (isHistoryProcessing.current || !fabricRef.current) return;
    const json = serializeCanvas(fabricRef.current);
    historyRef.current.push(JSON.stringify(json));
    redoStackRef.current = [];
    if (historyRef.current.length > 30) historyRef.current.shift();
    setHistoryTrigger(prev => prev + 1);
  }, []);

  // 保存待ちのページ情報。ページ切り替え時に「切り替え後の内容が前のページに
  // 保存されてしまう」事故を防ぐため、予約時点の対象を記録しておく
  const pendingSaveRef = useRef(null);

  // 保存待ちがあれば「今すぐ」保存する(ページ切替・アプリ離脱時に呼ぶ)
  const commitPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) { clearTimeout(saveTimeoutRef.current); saveTimeoutRef.current = null; }
    const target = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!target || !fabricRef.current || !window.idbKeyval) return;
    if (!drawingsRef.current[target.tbId]) drawingsRef.current[target.tbId] = {};
    drawingsRef.current[target.tbId][target.page] = serializeCanvas(fabricRef.current);
    try { window.idbKeyval.set(DB_KEY_DRAWINGS, drawingsRef.current); } catch (e) { }
  }, []);

  // ref 経由で現在のページを参照することで関数の同一性を保ち、
  // キャンバス生成時に登録されたイベントハンドラからも常に正しいページへ保存される
  const triggerAutoSave = useCallback(() => {
    const tbId = currentTextbookIdRef.current;
    if (!tbId) return;
    pendingSaveRef.current = { tbId, page: currentPageRef.current };
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      commitPendingSave();
    }, 800); // 800ms debounce
  }, [commitPendingSave]);

  // タブを閉じる・アプリを切り替えるときに保存待ちを確実に書き込む
  useEffect(() => {
    const flush = () => commitPendingSave();
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [commitPendingSave]);

  // 履歴データには背景画像が含まれないため、復元後に元の背景を再設定する
  const restoreCanvasState = useCallback((state) => {
    const canvas = fabricRef.current;
    const bg = canvas.backgroundImage;
    canvas.loadFromJSON(state, () => {
      if (bg) canvas.setBackgroundImage(bg, () => {});
      canvas.renderAll();
      isHistoryProcessing.current = false;
      setHistoryTrigger(prev => prev + 1);
      triggerAutoSave();
    });
  }, [triggerAutoSave]);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length <= 1 || !fabricRef.current) return;
    isHistoryProcessing.current = true;
    const currentState = historyRef.current.pop();
    redoStackRef.current.push(currentState);
    const previousState = historyRef.current[historyRef.current.length - 1];
    restoreCanvasState(previousState);
  }, [restoreCanvasState]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0 || !fabricRef.current) return;
    isHistoryProcessing.current = true;
    const nextState = redoStackRef.current.pop();
    historyRef.current.push(nextState);
    restoreCanvasState(nextState);
  }, [restoreCanvasState]);

  // --- Fabric.js Setup ---
  useEffect(() => {
    // ページ・教科書の切り替え前に、書きかけの保存を必ず確定させる
    // (この時点のキャンバスにはまだ「前のページ」の内容が残っている)
    commitPendingSave();

    if (!currentTextbookId) {
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
      setCanvasSize(null);
      return;
    }

    if (!scriptsLoaded || !isDataLoaded || currentPages.length === 0) return;

    if (!fabricRef.current && canvasRef.current) {
      fabricRef.current = new window.fabric.Canvas(canvasRef.current, { preserveObjectStacking: true, selection: true });

      // 初期化時に現在のモードを強制的に適用
      applyCanvasMode(fabricRef.current, modeRef.current, colorRef.current);

      // Events for History & Save
      fabricRef.current.on('path:created', () => { saveHistory(); triggerAutoSave(); });
      fabricRef.current.on('object:modified', () => { saveHistory(); triggerAutoSave(); });
      fabricRef.current.on('object:added', (e) => { 
        if(e.target && !e.target.isTemp) { saveHistory(); triggerAutoSave(); }
      });
      fabricRef.current.on('object:removed', (e) => { 
        // テンポラリの枠が削除された場合は保存をトリガーしない
        if(e.target && e.target.isTemp) return;
        saveHistory(); triggerAutoSave(); 
      });

      // Interactions (Links & Text)
      fabricRef.current.on('mouse:dblclick', (o) => {
        if (!o.target) return;
        if (o.target.linkType === 'url') { if (isSafeUrl(o.target.linkTarget)) window.open(o.target.linkTarget, '_blank', 'noopener'); }
        else if (o.target.linkType === 'audio') new window.Audio(o.target.linkTarget).play().catch(() => showToast("音声を再生できませんでした", "error"));
        else if (o.target.type === 'i-text' || o.target.type === 'textbox') { o.target.enterEditing(); o.target.selectAll(); }
      });

      // Drawing Shapes
      let isMouseDown = false;
      let activeShape = null;
      let startPoint = null;

      fabricRef.current.on('mouse:down', (o) => {
        const canvas = fabricRef.current;
        // 前回の中断された枠が残っていれば確実に削除する
        if (activeShape) {
          canvas.remove(activeShape);
          activeShape = null;
        }
        
        isMouseDown = true;
        const ptr = canvas.getPointer(o.e);
        const cMode = modeRef.current;

        if (cMode === 'eraser' && o.target && o.target !== canvas.backgroundImage) {
          canvas.remove(o.target);
        } else if (cMode === 'qr') {
          startPoint = ptr;
          activeShape = new window.fabric.Rect({
            left: ptr.x, top: ptr.y, width: 0, height: 0,
            fill: 'rgba(59, 130, 246, 0.2)', stroke: '#3b82f6', strokeWidth: 2,
            selectable: false, evented: false, 
            isTemp: true, excludeFromExport: true // 保存対象から確実に除外
          });
          canvas.add(activeShape);
        } else if (['rect', 'circle', 'line', 'arrow'].includes(cMode)) {
          startPoint = ptr;
          const strokeOpts = { 
            stroke: colorRef.current, strokeWidth: 4, fill: 'transparent', 
            isTemp: true, excludeFromExport: true 
          };
          
          if (cMode === 'rect') activeShape = new window.fabric.Rect({ left: ptr.x, top: ptr.y, width: 0, height: 0, ...strokeOpts });
          else if (cMode === 'circle') activeShape = new window.fabric.Ellipse({ left: ptr.x, top: ptr.y, rx: 0, ry: 0, ...strokeOpts });
          else if (cMode === 'line' || cMode === 'arrow') activeShape = new window.fabric.Line([ptr.x, ptr.y, ptr.x, ptr.y], strokeOpts);
          if (activeShape) canvas.add(activeShape);
        }
      });

      fabricRef.current.on('mouse:move', (o) => {
        if (!isMouseDown || !activeShape) return;
        const ptr = fabricRef.current.getPointer(o.e);
        const cMode = modeRef.current;

        if (cMode === 'rect' || cMode === 'qr') activeShape.set({ left: Math.min(ptr.x, startPoint.x), top: Math.min(ptr.y, startPoint.y), width: Math.abs(ptr.x - startPoint.x), height: Math.abs(ptr.y - startPoint.y) });
        else if (cMode === 'circle') activeShape.set({ rx: Math.abs(ptr.x - startPoint.x)/2, ry: Math.abs(ptr.y - startPoint.y)/2, left: Math.min(ptr.x, startPoint.x), top: Math.min(ptr.y, startPoint.y) });
        else if (cMode === 'line' || cMode === 'arrow') activeShape.set({ x2: ptr.x, y2: ptr.y });
        fabricRef.current.requestRenderAll();
      });

      fabricRef.current.on('mouse:up', () => {
        isMouseDown = false;
        if (activeShape) {
           activeShape.isTemp = false; // 確定
           const cMode = modeRef.current;
           if (cMode === 'qr') {
             const rectData = activeShape ? { left: activeShape.left, top: activeShape.top, width: activeShape.width, height: activeShape.height } : null;
             
             // QRの選択枠をキャンバスから完全に削除し、即座に画面を再描画する
             if (activeShape) {
               fabricRef.current.remove(activeShape);
               fabricRef.current.requestRenderAll(); // ここで画面を更新して枠を消す
             }
             
             activeShape = null; 
             startPoint = null;
             
             // 枠が消えた後にスキャン処理を開始 (常に最新ページを参照するため ref 経由で呼ぶ)
             setTimeout(() => {
                if (scanQRCodeRef.current) scanQRCodeRef.current(rectData);
             }, 10); // 描画の反映を待つためにわずかに遅延させる
             return;
           } else if (cMode === 'arrow') {
             const x1 = activeShape.x1, y1 = activeShape.y1, x2 = activeShape.x2, y2 = activeShape.y2;
             const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
             const head = new window.fabric.Triangle({ left: x2, top: y2, width: 20, height: 20, fill: colorRef.current, originX: 'center', originY: 'center', angle: angle + 90 });
             const group = new window.fabric.Group([activeShape, head], { excludeFromExport: false });
             fabricRef.current.remove(activeShape);
             fabricRef.current.add(group);
           } else { 
             activeShape.excludeFromExport = false; // 通常の図形は保存対象に戻す
             activeShape.setCoords(); 
           }
           saveHistory();
           triggerAutoSave();
        }
        activeShape = null; startPoint = null;
      });
    }

    let isCancelled = false; // 描画の競合(上書き)を防ぐためのフラグ

    // Load Background & Data
    const canvas = fabricRef.current;
    window.fabric.Image.fromURL(currentPages[currentPage], (img) => {
      if (isCancelled) return;
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      const containerHeight = containerRef.current?.clientHeight || window.innerHeight;
      const scale = Math.min(containerWidth / img.width, containerHeight / img.height);
      const renderWidth = img.width * scale;
      const renderHeight = img.height * scale;

      canvas.setWidth(renderWidth); canvas.setHeight(renderHeight);
      setCanvasSize({ w: renderWidth, h: renderHeight });
      img.scaleToWidth(renderWidth); img.scaleToHeight(renderHeight);

      // Ensure background is not selectable
      img.selectable = false;
      img.evented = false;
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));

      const loadData = () => {
        isHistoryProcessing.current = true;
        historyRef.current = [JSON.stringify(serializeCanvas(canvas))];
        redoStackRef.current = [];
        setHistoryTrigger(prev => prev + 1);
        isHistoryProcessing.current = false;
      };

      const savedDrawing = drawingsRef.current[currentTextbookId]?.[currentPage];
      if (savedDrawing) {
        canvas.loadFromJSON(savedDrawing, () => {
          if (isCancelled) return;
          // 別の画面サイズの端末で保存されたデータは、現在のキャンバス幅に
          // 合わせて位置・大きさをスケーリングし直す
          const savedWidth = savedDrawing.canvasWidth;
          if (savedWidth > 0 && Math.abs(savedWidth - renderWidth) > 1) {
            const ratio = renderWidth / savedWidth;
            canvas.getObjects().forEach(obj => {
              obj.set({
                left: obj.left * ratio,
                top: obj.top * ratio,
                scaleX: obj.scaleX * ratio,
                scaleY: obj.scaleY * ratio,
              });
              obj.setCoords();
            });
          }
          // 保存データに背景画像は含まれないため、読み込み後に再設定する
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
          canvas.renderAll();
          loadData();
        });
      } else {
        canvas.clear();
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
        loadData();
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [scriptsLoaded, isDataLoaded, currentTextbookId, currentPages, currentPage, saveHistory, triggerAutoSave, commitPendingSave]);

  // --- Tool Modes ---
  useEffect(() => {
    if (!fabricRef.current) return;
    applyCanvasMode(fabricRef.current, mode, color);
  }, [mode, color]);

  // --- 画面サイズへの自動フィット ---
  // 端末の回転やウィンドウリサイズ時に、ページ全体が常に収まる表示倍率を計算する
  useEffect(() => {
    if (!currentTextbookId || !canvasSize) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const pad = 24;
      // 半ページ表示では「ページの半分の幅」が画面に収まるように倍率を計算する
      const effectiveW = viewMode === 'half' ? canvasSize.w / 2 : canvasSize.w;
      const s = Math.min(
        (el.clientWidth - pad) / effectiveW,
        (el.clientHeight - pad) / canvasSize.h
      );
      setFitScale(Math.min(2, Math.max(0.1, s)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentTextbookId, canvasSize, viewMode]);

  // --- Add Objects ---
  const addObjectToCenter = useCallback((obj, autoEdit = false) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;

    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    let centerX = (-vpt[4] + canvas.getWidth() / 2) / zoom;
    const centerY = (-vpt[5] + canvas.getHeight() / 2) / zoom;
    // 半ページ表示中は、見えている側の中央に配置する
    if (viewMode === 'half') centerX = canvas.getWidth() * (halfSide === 'left' ? 0.25 : 0.75);

    obj.set({ left: centerX, top: centerY });
    canvas.add(obj); 
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    
    if (autoEdit && obj.enterEditing) {
      obj.enterEditing(); obj.selectAll();
    }
    setMode('select'); closeAllMenus();
    saveHistory(); triggerAutoSave();
  }, [closeAllMenus, saveHistory, triggerAutoSave, viewMode, halfSide]);

  const addTextOrStamp = (textValue, isStamp = false) => {
    const obj = new window.fabric.IText(textValue, {
      fontSize: isStamp ? 80 : 36, fill: isStamp ? undefined : color,
      fontFamily: 'Zen Maru Gothic', originX: 'center', originY: 'center',
      transparentCorners: false, cornerColor: '#f59e0b', cornerStyle: 'circle'
    });
    addObjectToCenter(obj, !isStamp);
  };

  const addPresetStampToCanvas = useCallback((stamp) => {
    let obj;
    if (stamp.type === 'premium' && stamp.subtype) {
       obj = createPremiumStamp(stamp.subtype);
    } else if (stamp.type === 'math' && stamp.subtype) {
       obj = createMathShape(stamp.subtype, 0, 0);
    } else {
       const content = stamp.type === 'vertical' ? stamp.text : stamp.icon;
       obj = new window.fabric.Text(content, {
         fontSize: stamp.type === 'vertical' ? 36 : 80,
         fill: stamp.color,
         fontFamily: 'Zen Maru Gothic',
         textAlign: 'center',
         lineHeight: 1.1,
         originX: 'center', originY: 'center',
         transparentCorners: false, cornerColor: '#f59e0b', cornerStyle: 'circle',
         backgroundColor: stamp.type === 'vertical' ? 'rgba(255,255,255,0.8)' : undefined
       });
    }
    if (obj) {
      obj.set({ stampType: stamp.type }); 
      addObjectToCenter(obj);
    }
  }, [addObjectToCenter]);

  const addCustomStampToCanvas = (stamp) => {
    const textObj = new window.fabric.Text(stamp.text, { fontSize: 80, fill: stamp.color, fontFamily: 'Zen Maru Gothic', originX: 'center', originY: 'center' });
    let shapeObj = null;
    const p = 20;
    if (stamp.shape !== 'none') {
      const size = Math.max(textObj.width + p*2, textObj.height + p*2);
      if (stamp.shape === 'circle') shapeObj = new window.fabric.Circle({ radius: size/2, fill: '', stroke: stamp.color, strokeWidth: 8, originX: 'center', originY: 'center' });
      else if (stamp.shape === 'square') shapeObj = new window.fabric.Rect({ width: textObj.width + p*2, height: textObj.height + p*2, fill: '', stroke: stamp.color, strokeWidth: 8, originX: 'center', originY: 'center' });
    }
    const finalObj = shapeObj ? new window.fabric.Group([shapeObj, textObj], { originX: 'center', originY: 'center', scaleX: 0.5, scaleY: 0.5 }) : textObj.set({ scaleX: 0.5, scaleY: 0.5 });
    addObjectToCenter(finalObj);
  };

  const deleteMyStamp = (idx) => {
    const newStamps = myStamps.filter((_, i) => i !== idx);
    setMyStamps(newStamps);
    localStorage.setItem(DB_KEY_MYSTAMPS, JSON.stringify(newStamps));
    showToast("マイスタンプを削除しました", "success");
  };

  const addStickyNote = (bgColor) => {
    const sticky = new window.fabric.Textbox('メモ', {
      width: 200, fontSize: 24, fill: '#000', fontFamily: 'Zen Maru Gothic',
      backgroundColor: bgColor, padding: 15, textAlign: 'left', originX: 'center', originY: 'center',
      shadow: new window.fabric.Shadow({ color: 'rgba(0,0,0,0.2)', blur: 15, offsetX: 5, offsetY: 5 }),
      transparentCorners: false, cornerColor: '#f59e0b', cornerStyle: 'circle'
    });
    addObjectToCenter(sticky, true);
  };

  const addLinkOrAudio = (type) => {
    closeAllMenus();
    const isUrl = type === 'url';
    let url = window.prompt(isUrl ? 'リンク先のURLを入力してください' : '音声ファイルのURLを入力してください');
    if (!url) return;
    url = url.trim();
    if (!isSafeUrl(url)) url = 'https://' + url;

    const textObj = new window.fabric.Text(isUrl ? '🔗' : '🔊', { fontSize: 24, originX: 'center', originY: 'center' });
    const circleObj = new window.fabric.Circle({ radius: 24, fill: isUrl ? '#e0f2fe' : '#fce7f3', stroke: isUrl ? '#0284c7' : '#db2777', strokeWidth: 2, originX: 'center', originY: 'center', shadow: new window.fabric.Shadow({ color: 'rgba(0,0,0,0.1)', blur: 5, offsetY: 2 }) });
    const group = new window.fabric.Group([circleObj, textObj], { originX: 'center', originY: 'center', linkType: type, linkTarget: url });
    addObjectToCenter(group);
    showToast(isUrl ? "リンクを配置しました。ダブルクリックで開きます。" : "音声を配置しました。ダブルクリックで再生します。");
  };

  // 半ページ表示のとき、設定した読み順で最初に表示する側と後に表示する側
  const halfFirstSide = halfOrder === 'rtl' ? 'right' : 'left';
  const halfSecondSide = halfOrder === 'rtl' ? 'left' : 'right';

  const changePage = useCallback((delta) => {
    // 半ページ表示では「前半分 → 後半分 → 次ページの前半分」の順に進む
    if (viewMode === 'half' && delta !== 0) {
      if (delta > 0) {
        if (halfSide === halfFirstSide) { setHalfSide(halfSecondSide); return; }
        if (currentPage < currentPages.length - 1) {
          setCurrentPage(currentPage + 1);
          setHalfSide(halfFirstSide);
          setZoom(1);
        }
      } else {
        if (halfSide === halfSecondSide) { setHalfSide(halfFirstSide); return; }
        if (currentPage > 0) {
          setCurrentPage(currentPage - 1);
          setHalfSide(halfSecondSide);
          setZoom(1);
        }
      }
      return;
    }
    const newPage = currentPage + delta;
    if (newPage >= 0 && newPage < currentPages.length) {
      setCurrentPage(newPage);
      setZoom(1);
    }
  }, [currentPage, currentPages.length, viewMode, halfSide, halfFirstSide, halfSecondSide]);

  const canGoPrev = viewMode === 'half' ? (currentPage > 0 || halfSide !== halfFirstSide) : currentPage > 0;
  const canGoNext = viewMode === 'half'
    ? (currentPage < currentPages.length - 1 || halfSide !== halfSecondSide)
    : currentPage < currentPages.length - 1;

  const selectViewMode = (mode, order) => {
    setViewMode(mode);
    if (mode === 'half') {
      const ord = order || halfOrder;
      setHalfOrder(ord);
      setHalfSide(ord === 'rtl' ? 'right' : 'left');
    }
    setShowViewMenu(false);
  };

  const clearCurrentPage = () => {
    showConfirm("ページの消去", "このページの書き込みをすべて消去しますか？", async () => {
      if (!fabricRef.current) return;
      fabricRef.current.clear();
      window.fabric.Image.fromURL(currentPages[currentPage], (img) => {
        img.scaleToWidth(fabricRef.current.width); img.scaleToHeight(fabricRef.current.height);
        img.selectable = false; img.evented = false;
        fabricRef.current.setBackgroundImage(img, fabricRef.current.renderAll.bind(fabricRef.current));
      });
      saveHistory(); triggerAutoSave();
      showToast("ページをクリアしました", "success");
    }, "消去する", true);
  };

  // --- キーボードショートカット ---
  useEffect(() => {
    if (!currentTextbookId) return;

    const handleKeyDown = (e) => {
      // 入力フォームやテキスト編集中はショートカットを無効化
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }

      // Undo (Ctrl+Z / Cmd+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      
      // Redo (Ctrl+Y / Cmd+Y)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          changePage(1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          changePage(-1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setZoom(prev => Math.min(3, prev + 0.2));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setZoom(prev => Math.max(0.5, prev - 0.2));
          break;
        case 'Delete':
        case 'Backspace':
          // 選択モードでオブジェクトが選ばれている時のみ削除
          if (fabricRef.current && modeRef.current === 'select') {
            const activeObjects = fabricRef.current.getActiveObjects();
            if (activeObjects.length > 0) {
              e.preventDefault();
              activeObjects.forEach(obj => fabricRef.current.remove(obj));
              fabricRef.current.discardActiveObject();
              saveHistory();
              triggerAutoSave();
            }
          }
          break;
        case 'v': case 'V': setMode('select'); break;
        case 'p': case 'P': setMode('pencil'); break;
        case 'e': case 'E': setMode('eraser'); break;
        case 'h': case 'H': setMode('highlighter'); break;
        case 'q': case 'Q': setMode('qr'); break;
        case 'f': case 'F': toggleFullscreen(); break;
        default: break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTextbookId, changePage, handleUndo, handleRedo, saveHistory, triggerAutoSave, toggleFullscreen]);

  // ==========================================
  // --- スマホ・タブレットの「戻る」操作 ---
  // Androidのナビゲーションバーの「戻る」や、画面の端から中央へのスワイプ
  // (ジェスチャー操作)で、1つ前の階層へ戻れるようにする。
  // 履歴に常に「戻り先」を1件積んでおくことで、ブラウザの戻る操作でページを
  // 離れてしまったり、ホーム画面から起動したアプリが終了したりするのを防ぐ。
  // ==========================================

  // 重なっているものを上から順に1つだけ閉じる(= 1階層だけ戻る)
  const handleBackNavigation = () => {
    // 共有データの受信中は処理を中断させない
    if (shareMode === 'receiving') return;

    // 1. モーダル(最前面にあるものから順に)
    if (dialog) { setDialog(null); return; }
    if (importPreview) { setImportPreview(null); return; }
    if (showMyStampCreator) { setShowMyStampCreator(false); return; }
    if (showShortcuts) { setShowShortcuts(false); return; }
    if (shareMode === 'hosting') { stopHosting(); return; }

    // 2. ツールバーから開いたメニュー・パネル
    if (showStampMenu || showShapeMenu || showStickyMenu || showLinkMenu || showPageJump || showViewMenu) {
      closeAllMenus(); return;
    }
    if (showTimer) { setShowTimer(false); return; }
    if (showToolbar) { closeAllMenus(); setShowToolbar(false); return; }

    // 3. 全画面表示 → 通常表示
    if (isFullscreen) { toggleFullscreen(); return; }

    // 4. 教科書の画面 → 一覧
    if (currentTextbookId) { goToLibrary(); return; }

    // 5. 一覧が最初の画面。アプリを終了させないため、ここでは何もせず知らせるだけ
    showToast("ここが最初の画面です", "info");
  };

  // イベントリスナーは一度だけ登録するため、常に最新の処理を ref 経由で呼ぶ
  const backNavigationRef = useRef(handleBackNavigation);
  useEffect(() => { backNavigationRef.current = handleBackNavigation; });

  // ナビゲーションバーの「戻る」とスワイプが同時に反応して2階層戻ってしまうのを防ぐ
  const lastBackAtRef = useRef(0);
  const requestBackNavigation = useCallback(() => {
    const now = Date.now();
    if (now - lastBackAtRef.current < BACK_NAV_INTERVAL) return;
    lastBackAtRef.current = now;
    backNavigationRef.current();
  }, []);

  // Esc でも「1階層だけ戻る」。
  // マウスが使えない・使いにくい人はモーダルを閉じられずに詰んでしまうため、
  // 画面のどこにいても効くように、ショートカット全体とは別に登録する。
  useEffect(() => {
    const onEscape = (e) => {
      if (e.key !== 'Escape') return;
      // 文字を入力している最中は、入力の取り消しが優先されるので邪魔しない
      const t = e.target;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      requestBackNavigation();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [requestBackNavigation]);

  // 履歴に「戻り先」を1件積む(常に1件残しておくのが基本方針)
  const pushHistoryGuard = useCallback(() => {
    try { window.history.pushState({ dtBackGuard: true }, ''); } catch (e) {}
  }, []);

  const historyGuardReadyRef = useRef(false);
  useEffect(() => {
    if (!historyGuardReadyRef.current) {
      historyGuardReadyRef.current = true;
      if (!(window.history.state && window.history.state.dtBackGuard)) pushHistoryGuard();
    }

    const onPopState = () => {
      // 先に履歴を積み直すことで、ブラウザの戻る(ページ離脱・アプリ終了)を確実に防ぐ
      pushHistoryGuard();
      requestBackNavigation();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [pushHistoryGuard, requestBackNavigation]);

  // 画面の左右の端から中央へ向かうスワイプを「戻る」として扱う。
  // iPhone・iPadでホーム画面に追加した場合など、システムの戻るジェスチャーが
  // 使えない環境でも同じ操作で戻れるようにする。
  useEffect(() => {
    // 指で操作する端末(スマホ・タブレット)のみ有効にする
    const isTouchDevice =
      (window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches) || 'ontouchstart' in window;
    if (!isTouchDevice) return;

    let swipe = null;

    // ボタンや入力欄の操作は妨げない
    const isInteractive = (el) =>
      !!(el && el.closest && el.closest('button, a, input, select, textarea, label, [role="button"]'));

    const onTouchStart = (e) => {
      swipe = null; // 2本目の指が触れたとき(ピンチ操作など)も中止する
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.touchType === 'stylus') return; // ペンでの書き込みは妨げない
      const fromLeft = t.clientX <= EDGE_SWIPE_ZONE;
      const fromRight = t.clientX >= window.innerWidth - EDGE_SWIPE_ZONE;
      if (!fromLeft && !fromRight) return;
      if (isInteractive(e.target)) return;
      swipe = { id: t.identifier, x: t.clientX, y: t.clientY, dir: fromLeft ? 1 : -1 };
      // キャンバスに線が引かれてしまわないよう、ここで伝播を止める
      e.stopPropagation();
    };

    const onTouchMove = (e) => {
      if (!swipe) return;
      const t = Array.prototype.find.call(e.touches, (touch) => touch.identifier === swipe.id);
      if (!t) { swipe = null; return; }
      const moved = (t.clientX - swipe.x) * swipe.dir;
      // 縦方向の動きが大きいときはスクロール操作とみなす
      if (Math.abs(t.clientY - swipe.y) > EDGE_SWIPE_MAX_SLOPE) { swipe = null; return; }
      e.stopPropagation();
      if (moved >= EDGE_SWIPE_DISTANCE) {
        swipe = null;
        if (e.cancelable) e.preventDefault();
        requestBackNavigation();
      }
    };

    const onTouchEnd = () => { swipe = null; };

    // capture フェーズで受け取り、キャンバス(fabric.js)より先に判定する
    const opts = { capture: true, passive: false };
    window.addEventListener('touchstart', onTouchStart, opts);
    window.addEventListener('touchmove', onTouchMove, opts);
    window.addEventListener('touchend', onTouchEnd, opts);
    window.addEventListener('touchcancel', onTouchEnd, opts);
    return () => {
      window.removeEventListener('touchstart', onTouchStart, opts);
      window.removeEventListener('touchmove', onTouchMove, opts);
      window.removeEventListener('touchend', onTouchEnd, opts);
      window.removeEventListener('touchcancel', onTouchEnd, opts);
    };
  }, [requestBackNavigation]);

  // 選択モード(既定のモード)のとき、キャンバスを横にスワイプしてページを送れるようにする。
  // えんぴつなどの書き込みモードでは線が引けなくなってしまうため、選択モードだけで有効にする。
  useEffect(() => {
    if (!currentTextbookId || mode !== 'select') return;

    // 指で操作する端末(スマホ・タブレット)のみ有効にする
    const isTouchDevice =
      (window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches) || 'ontouchstart' in window;
    if (!isTouchDevice) return;

    const scrollEl = canvasScrollRef.current;
    if (!scrollEl) return;

    let swipe = null;

    // ボタンや入力欄の操作は妨げない
    const isInteractive = (el) =>
      !!(el && el.closest && el.closest('button, a, input, select, textarea, label, [role="button"]'));

    // 図形・付箋などを掴んでいるときは、ページ送りではなく移動・変形を優先する
    const isOnObject = (e) => {
      const canvas = fabricRef.current;
      if (!canvas) return false;
      try {
        if (canvas.findTarget(e)) return true;
        const active = canvas.getActiveObject();
        if (active) {
          // 拡大・回転のハンドルは図形の外側にあるため、少し広めに判定する
          const r = active.getBoundingRect();
          const p = canvas.getPointer(e);
          if (p.x >= r.left - OBJECT_GRAB_MARGIN && p.x <= r.left + r.width + OBJECT_GRAB_MARGIN &&
              p.y >= r.top - OBJECT_GRAB_MARGIN && p.y <= r.top + r.height + OBJECT_GRAB_MARGIN) return true;
        }
      } catch (err) { /* 判定できないときはスワイプを許可する */ }
      return false;
    };

    const onTouchStart = (e) => {
      swipe = null; // 2本目の指が触れたとき(ピンチ操作など)も中止する
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.touchType === 'stylus') return;             // ペンでの操作は妨げない
      if (isInteractive(e.target)) return;
      // 画面の端から始まるスワイプは「戻る」操作なので、ここでは扱わない
      if (t.clientX <= EDGE_SWIPE_ZONE || t.clientX >= window.innerWidth - EDGE_SWIPE_ZONE) return;
      // 拡大して横にはみ出しているときは、スクロールして見る操作を優先する
      if (scrollEl.scrollWidth > scrollEl.clientWidth + 1) return;
      if (isOnObject(e)) return;
      swipe = { id: t.identifier, x: t.clientX, y: t.clientY, active: false };
    };

    const onTouchMove = (e) => {
      if (!swipe) return;
      if (e.touches.length !== 1) { swipe = null; return; }
      const t = Array.prototype.find.call(e.touches, (touch) => touch.identifier === swipe.id);
      if (!t) { swipe = null; return; }

      const dx = t.clientX - swipe.x;
      const dy = t.clientY - swipe.y;

      // 最初の少しの動きで、ページ送りか縦スクロールかを見分ける
      if (!swipe.active) {
        if (Math.abs(dy) > PAGE_SWIPE_SLOP && Math.abs(dy) >= Math.abs(dx)) { swipe = null; return; }
        if (Math.abs(dx) <= PAGE_SWIPE_SLOP) return;
        swipe.active = true;
      }

      // キャンバスに範囲選択の枠が出てしまわないよう、ここで伝播を止める
      e.stopPropagation();
      if (Math.abs(dx) >= PAGE_SWIPE_DISTANCE) {
        swipe = null;
        if (e.cancelable) e.preventDefault();
        // 左へ払うと次のページ、右へ払うと前のページ(画面下の◀▶と同じ向き)
        changePage(dx < 0 ? 1 : -1);
      }
    };

    const onTouchEnd = () => { swipe = null; };

    // capture フェーズで受け取り、キャンバス(fabric.js)より先に判定する
    const opts = { capture: true, passive: false };
    scrollEl.addEventListener('touchstart', onTouchStart, opts);
    scrollEl.addEventListener('touchmove', onTouchMove, opts);
    scrollEl.addEventListener('touchend', onTouchEnd, opts);
    scrollEl.addEventListener('touchcancel', onTouchEnd, opts);
    return () => {
      scrollEl.removeEventListener('touchstart', onTouchStart, opts);
      scrollEl.removeEventListener('touchmove', onTouchMove, opts);
      scrollEl.removeEventListener('touchend', onTouchEnd, opts);
      scrollEl.removeEventListener('touchcancel', onTouchEnd, opts);
    };
  }, [currentTextbookId, mode, changePage]);

  // ==========================================
  // レンダリング
  // ==========================================
  if (scriptError) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-amber-50/40">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg text-center border-2 border-red-200">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">ライブラリの読み込みに失敗しました</h2>
          <p className="text-slate-600 text-sm mb-4">
            通信が不安定なようです。少し待ってから、下のボタンで再読み込みしてください。<br />
            何度やっても直らないときは、ネットワークの管理者にご相談ください。
          </p>
          <div className="bg-slate-100 p-3 rounded-lg text-left text-xs font-mono text-red-600 overflow-hidden mb-6">
            {scriptError}
          </div>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition-all active:scale-95">
            ページを再読み込み
          </button>
        </div>
      </div>
    );
  }

  if (!scriptsLoaded || !isDataLoaded) {
    return <div className="h-dvh w-full flex items-center justify-center bg-amber-50/40"><div className="flex flex-col items-center gap-4 text-amber-700"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-amber-500"></div><div className="text-xl font-bold animate-pulse">システムを準備中...</div></div></div>;
  }

  // 全画面表示中はヘッダー・ツールバー・フッターを隠して学習領域を最大化する
  const hideChrome = isFullscreen && !!currentTextbookId;

  return (
    <div className="h-dvh w-full flex flex-col bg-slate-100 overflow-hidden relative">
      {/* ヘッダーはトップの教科書選択画面でのみ表示し、教科書画面では非表示にする */}
      {!currentTextbookId && <Header onGoHome={null} title={null} />}
      
      {/* --- ホーム画面 --- */}
      {!currentTextbookId && (
        <main className="flex-grow overflow-auto p-6 md:p-10 bg-amber-50/40">
          <div className="max-w-6xl mx-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3 drop-shadow-sm"><BookOpen size={36} className="text-amber-500" /> わたしのプリント・教科書</h2>
              <div className="flex flex-wrap items-center gap-2">
                {/* アプリとして入れてもらうためのボタン。
                    ブラウザのアドレスバーの小さなアイコンは児童には見つけられないので、
                    アプリの中にはっきり置く。Chrome から合図が来たときだけ出す。 */}
                {canInstall && (
                  <button
                    onClick={handleInstall}
                    title="このアプリをホーム画面・デスクトップに追加します"
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl transition-all active:scale-95 text-sm shadow-sm"
                  >
                    <Smartphone size={16} />
                    アプリを入れる
                  </button>
                )}
                <button
                  onClick={handleExportBackup}
                  disabled={isExporting || textbooks.length === 0}
                  title="教科書・書き込みをJSONファイルとして書き出し、Googleドライブ等に保存できます"
                  className="flex items-center gap-1.5 bg-white border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-600 font-bold px-4 py-2 rounded-xl transition-all active:scale-95 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  バックアップを書き出す
                </button>
                <button
                  onClick={() => importFileInputRef.current && importFileInputRef.current.click()}
                  disabled={isProcessing}
                  title="Googleドライブ等から取得したバックアップJSONを読み込みます"
                  className="flex items-center gap-1.5 bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 text-emerald-700 font-bold px-4 py-2 rounded-xl transition-all active:scale-95 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Upload size={16} />
                  バックアップを取り込む
                </button>
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportFileSelected}
                />
              </div>
            </div>
            {/* --- Googleドライブ同期パネル (クライアントID設定時のみ表示) --- */}
            {driveEnabled && (
              <div className="mb-6 bg-white border-2 border-sky-200 rounded-2xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="bg-sky-100 p-2 rounded-xl text-sky-600 shadow-inner shrink-0"><Cloud size={22} /></div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        Googleドライブ同期
                        {driveConnected && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full"><Check size={11} /> 接続中</span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-slate-600">
                        {driveLastSync ? `最終保存: ${driveLastSync}` : '別の端末でも同じGoogleアカウントで接続すれば同期できます'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!driveConnected ? (
                      <button
                        onClick={handleDriveConnect}
                        disabled={driveBusy !== null}
                        className="flex items-center gap-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold px-4 py-2 rounded-xl transition-all active:scale-95 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {driveBusy === 'connecting' ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
                        Googleドライブに接続
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleDriveSave}
                          disabled={driveBusy !== null || textbooks.length === 0}
                          title="いまのデータをGoogleドライブに保存します"
                          className="flex items-center gap-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold px-4 py-2 rounded-xl transition-all active:scale-95 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {driveBusy === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                          ドライブに保存
                        </button>
                        <button
                          onClick={handleDriveLoad}
                          disabled={driveBusy !== null}
                          title="Googleドライブに保存したデータを取り込みます"
                          className="flex items-center gap-1.5 bg-white border-2 border-sky-300 hover:bg-sky-50 text-sky-600 font-bold px-4 py-2 rounded-xl transition-all active:scale-95 text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {driveBusy === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                          ドライブから復元
                        </button>
                        <button
                          onClick={handleDriveDisconnect}
                          disabled={driveBusy !== null}
                          title="接続を解除します"
                          className="flex items-center gap-1 text-slate-600 hover:text-red-500 hover:bg-red-50 font-bold px-2.5 py-2 rounded-xl transition-all active:scale-95 text-xs disabled:opacity-40"
                        >
                          <X size={14} /> 切断
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer select-none w-fit">
                  <input type="checkbox" checked={driveAutoSave} onChange={handleToggleAutoSave} className="w-4 h-4 accent-sky-500" />
                  自動保存（書き込みや変更を、少し待ってから自動でドライブへ保存します）
                </label>
              </div>
            )}
            <div className="mb-6 flex items-start gap-2 text-xs font-bold text-slate-500 bg-amber-50/70 border border-amber-200 rounded-xl p-3">
              <Cloud size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <span>
                {driveEnabled
                  ? '「Googleドライブに接続」すると、ボタン1つでデータを保存でき、別の端末で同じアカウントに接続して「ドライブから復元」するだけで同期できます。JSONファイルの書き出し／取り込みも引き続き利用できます。'
                  : '書き出したJSONファイルをGoogleドライブに保存しておけば、別の端末でログインして同じファイルを「取り込む」ことで、教科書・書き込み・マイスタンプをまるごと復元できます。'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              <label className="bg-white border-4 border-dashed border-amber-200 hover:border-amber-400 rounded-3xl flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-amber-50 transition-all active:scale-95 min-h-[260px] shadow-sm hover:shadow-md">
                {isProcessing ? (
                  <div className="flex flex-col items-center text-amber-500"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-amber-500 mb-3"></div><span className="font-bold text-lg">変換中...</span></div>
                ) : (
                  <><div className="bg-amber-100 p-5 rounded-full mb-4 text-amber-500 shadow-inner"><Plus size={40} /></div><span className="font-bold text-slate-600 text-lg">新しいPDFを追加</span><input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={isProcessing}/></>
                )}
              </label>
              {textbooks.map(tb => (
                <div key={tb.id} onClick={() => { setCurrentTextbookId(tb.id); setCurrentPage(pageHistory[tb.id] || 0); setZoom(1); }} className="bg-white rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden flex flex-col border border-slate-100 min-h-[260px]">
                  <div className="h-44 bg-slate-100 relative border-b border-slate-100 flex items-center justify-center p-3 overflow-hidden">
                    {/* width/height を書いておかないと、表紙が出た瞬間に
                        カードの高さが変わって一覧全体がガタつく（CLS）。
                        実際の表示サイズは CSS 側で決まるので、ここは比率の指定として効く。 */}
                    <img
                      src={tb.coverImage}
                      alt={`${tb.title} の表紙`}
                      width="176"
                      height="176"
                      loading="lazy"
                      decoding="async"
                      className="max-h-full max-w-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                    />
                    <button onClick={(e) => deleteTextbook(tb.id, e)} aria-label={`「${tb.title}」を消す`} className="absolute top-3 right-3 bg-white/90 backdrop-blur hover:bg-red-50 text-slate-500 hover:text-red-600 p-2.5 rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all shadow-md"><Trash2 size={20} /></button>
                  </div>
                  <div className="p-5 bg-white flex-grow flex flex-col justify-between"><h3 className="font-bold text-slate-800 line-clamp-2 text-base leading-snug">{tb.title}</h3><div className="text-sm text-slate-600 font-bold mt-3 flex items-center gap-1.5"><BookOpen size={16} /> {tb.pages.length} ページ</div></div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* --- エディタ画面 --- */}
      {currentTextbookId && (
        <>
          {/* 教科書画面の操作ボタン群 (ツールバー非表示時のみ表示) */}
          {!showToolbar && (
            <div className="absolute top-3 left-3 z-40 flex items-center gap-2 animate-in fade-in">
              <button
                onClick={goToLibrary}
                title="一覧へ戻る"
                className="flex items-center gap-1 text-sm font-bold text-slate-600 bg-white/90 backdrop-blur border border-slate-200 hover:bg-white hover:text-amber-700 px-2.5 sm:px-3 py-2 rounded-xl shadow-md transition-all active:scale-95"
              >
                <ChevronLeft size={18} /> <span className="hidden sm:inline">一覧へ戻る</span>
              </button>
              <button
                onClick={() => { closeAllMenus(); setShowToolbar(true); }}
                title="ツールを表示"
                className="flex items-center gap-1.5 text-sm font-bold text-white bg-amber-700 hover:bg-amber-800 px-3 py-2 rounded-xl shadow-md shadow-amber-800/30 transition-all active:scale-95"
              >
                <PenTool size={18} /> <span>ツール</span>
              </button>
            </div>
          )}

          {/* ツールバー (呼び出し式オーバーレイ / 折り返し対応) */}
          {showToolbar && (
          <div className="absolute top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-lg z-40 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-wrap px-1.5 sm:px-4 py-1.5 sm:py-2 gap-y-1.5 gap-x-1.5 sm:gap-x-3 items-center mx-auto justify-center">

              {/* 一覧へ戻る */}
              <button onClick={goToLibrary} title="一覧へ戻る" className="flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-amber-700 bg-slate-100 hover:bg-amber-50 px-2 sm:px-3 py-1.5 rounded-xl transition-all active:scale-95">
                <ChevronLeft size={18} /> <span className="hidden sm:inline">一覧へ戻る</span>
              </button>

              <div className="w-px h-8 bg-slate-300 rounded-full hidden lg:block"></div>


              {/* Undo / Redo */}
              <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner">
                <button onClick={handleUndo} disabled={historyRef.current.length <= 1} className="p-2 rounded-lg text-slate-600 disabled:opacity-30 hover:bg-white hover:shadow-sm transition-all active:scale-95"><Undo2 size={20} /></button>
                <button onClick={handleRedo} disabled={redoStackRef.current.length === 0} className="p-2 rounded-lg text-slate-600 disabled:opacity-30 hover:bg-white hover:shadow-sm transition-all active:scale-95"><Redo2 size={20} /></button>
              </div>

              <div className="w-px h-8 bg-slate-300 rounded-full hidden lg:block"></div>

              {/* 描画・選択ツール */}
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1 shadow-inner">
                <button onClick={() => setMode('select')} className={`p-2 rounded-lg transition-all active:scale-95 ${mode === 'select' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-200' : 'text-slate-500 hover:bg-slate-200'}`} title="選択"><MousePointer2 size={20} /></button>
                <button onClick={() => setMode('pencil')} className={`p-2 rounded-lg transition-all active:scale-95 ${mode === 'pencil' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-200' : 'text-slate-500 hover:bg-slate-200'}`} title="えんぴつ"><Pencil size={20} /></button>
                <button onClick={() => setMode('highlighter')} className={`p-2 rounded-lg transition-all active:scale-95 ${mode === 'highlighter' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-200' : 'text-slate-500 hover:bg-slate-200'}`} title="マーカー"><Highlighter size={20} /></button>
                <button onClick={() => setMode('eraser')} className={`p-2 rounded-lg transition-all active:scale-95 ${mode === 'eraser' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-200' : 'text-slate-500 hover:bg-slate-200'}`} title="けしごむ"><Eraser size={20} /></button>
                <button onClick={() => setMode('qr')} className={`p-2 rounded-lg transition-all active:scale-95 ${mode === 'qr' ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-200' : 'text-slate-500 hover:bg-slate-200'}`} title="QRコード読み取り"><QrCode size={20} /></button>
              </div>

              {/* カラーパレット */}
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1.5 px-3 shadow-inner">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full shadow-sm border-2 transition-transform duration-200 active:scale-90 ${color === c ? 'border-amber-400 scale-125' : 'border-white hover:scale-110'}`} style={{ backgroundColor: c }} />
                ))}
              </div>

              <div className="w-px h-8 bg-slate-300 rounded-full hidden lg:block"></div>

              {/* 挿入ツール群 */}
              <div className="flex gap-2 relative">
                <div className="relative">
                  <button onClick={() => { closeAllMenus(); setShowShapeMenu(!showShapeMenu); }} title="図形" className={`flex items-center gap-1.5 border-2 font-bold px-2.5 sm:px-3 py-2 rounded-xl transition-all active:scale-95 text-sm ${['rect','circle','line','arrow'].includes(mode) || showShapeMenu ? 'bg-amber-100 border-amber-400 text-amber-700 shadow-inner' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                    <Square size={16} /> <span className="hidden md:inline">図形</span>
                  </button>
                  {showShapeMenu && (
                    <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 p-2 rounded-xl shadow-xl z-50 flex gap-2 animate-in fade-in slide-in-from-top-2">
                      {['rect', 'circle', 'line', 'arrow'].map(m => (
                        <button key={m} onClick={() => { setMode(m); setShowShapeMenu(false); }} className={`p-2.5 rounded-lg transition-colors ${mode === m ? 'bg-amber-100 text-amber-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                          {m === 'rect' && <Square size={20}/>}{m === 'circle' && <Circle size={20}/>}{m === 'line' && <Minus size={20}/>}{m === 'arrow' && <ArrowRight size={20}/>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={() => { closeAllMenus(); addTextOrStamp("テキスト", false); }} title="もじ" className="flex items-center gap-1.5 bg-white border-2 border-slate-200 hover:bg-slate-50 hover:border-amber-300 text-slate-600 font-bold px-2.5 sm:px-3 py-2 rounded-xl transition-all active:scale-95 text-sm shadow-sm">
                  <Type size={16} /> <span className="hidden md:inline">もじ</span>
                </button>
                
                <div className="relative">
                  <button onClick={() => { closeAllMenus(); setShowStickyMenu(!showStickyMenu); }} title="ふせん" className={`flex items-center gap-1.5 border-2 font-bold px-2.5 sm:px-3 py-2 rounded-xl transition-all active:scale-95 text-sm ${showStickyMenu ? 'bg-amber-100 border-amber-400 text-amber-700 shadow-inner' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                    <StickyNote size={16} /> <span className="hidden md:inline">ふせん</span>
                  </button>
                  {showStickyMenu && (
                    <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 p-3 rounded-xl shadow-xl z-50 flex gap-3 animate-in fade-in slide-in-from-top-2">
                      {STICKY_COLORS.map(c => <button key={c} onClick={() => addStickyNote(c)} className="w-10 h-10 rounded-lg shadow-sm border hover:scale-110 transition-transform" style={{ backgroundColor: c }} />)}
                    </div>
                  )}
                </div>

                <div className="relative">
                   <button onClick={() => { closeAllMenus(); setShowLinkMenu(!showLinkMenu); }} title="リンク" className={`flex items-center gap-1.5 border-2 font-bold px-2.5 sm:px-3 py-2 rounded-xl transition-all active:scale-95 text-sm ${showLinkMenu ? 'bg-amber-100 border-amber-400 text-amber-700 shadow-inner' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                    <LinkIcon size={16} /> <span className="hidden md:inline">リンク</span>
                  </button>
                  {showLinkMenu && (
                    <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 p-2 rounded-xl shadow-xl z-50 flex flex-col gap-1 w-36 animate-in fade-in slide-in-from-top-2">
                       <button onClick={() => addLinkOrAudio('url')} className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg font-bold text-sm text-slate-700 transition-colors"><LinkIcon size={16} className="text-blue-500"/> Webを開く</button>
                       <button onClick={() => addLinkOrAudio('audio')} className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg font-bold text-sm text-slate-700 transition-colors"><Volume2 size={16} className="text-pink-500"/> 音声再生</button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button onClick={() => { closeAllMenus(); setShowStampMenu(!showStampMenu); }} title="スタンプ" className={`flex items-center gap-1.5 border-2 font-bold px-2.5 sm:px-3 py-2 rounded-xl transition-all active:scale-95 text-sm ${showStampMenu ? 'bg-amber-100 border-amber-400 text-amber-700 shadow-inner' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                    <Smile size={16} /> <span className="hidden md:inline">スタンプ</span>
                  </button>
                  {showStampMenu && (
                    <div className="fixed sm:absolute top-auto sm:top-full left-1/2 sm:left-auto -translate-x-1/2 sm:translate-x-0 bottom-4 sm:bottom-auto sm:mt-2 sm:right-0 xl:left-0 xl:right-auto bg-white border border-slate-200 p-4 rounded-2xl shadow-2xl z-50 w-[min(20rem,calc(100vw-1.5rem))] animate-in fade-in slide-in-from-top-2">
                      <div className="flex bg-slate-100 p-1 rounded-xl mb-3 shadow-inner overflow-x-auto hide-scrollbar">
                        {STAMP_CATEGORIES.map(cat => (
                          <button key={cat.id} onClick={() => setStampTab(cat.id)} className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${stampTab === cat.id ? 'bg-white shadow-sm text-amber-700' : 'text-slate-600 hover:text-slate-800'}`}>
                            {cat.name}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1 hide-scrollbar">
                        {stampTab !== 'my' && STAMPS_DATA[stampTab].map((stamp, idx) => (
                          <button key={idx} onClick={() => addPresetStampToCanvas(stamp)} className="flex flex-col items-center justify-center py-2 px-1 rounded-xl hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all active:scale-95 group">
                            {stamp.type === 'premium' ? (
                              <span className="leading-none mb-1 group-hover:scale-110 transition-transform"><StampPreview subtype={stamp.subtype} /></span>
                            ) : (
                              <span className="text-2xl leading-none mb-1 group-hover:scale-110 transition-transform" style={{color: stamp.color}}>
                                {stamp.type === 'vertical' ? stamp.text.replace(/\n/g, '') : stamp.icon}
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-slate-500 truncate w-full text-center">{stamp.label}</span>
                          </button>
                        ))}
                        {stampTab === 'my' && (
                          <>
                            <button onClick={() => {setShowStampMenu(false); setShowMyStampCreator(true);}} className="col-span-4 py-3 border-2 border-dashed border-amber-300 rounded-xl text-amber-700 font-bold text-sm hover:bg-amber-50 flex items-center justify-center gap-1 mb-2 transition-colors">
                              <Plus size={16}/> 新しいスタンプを作る
                            </button>
                            {myStamps.map((stamp, idx) => (
                              <div key={idx} className="relative group flex justify-center items-center">
                                <button onClick={() => addCustomStampToCanvas(stamp)} className="w-14 h-14 flex items-center justify-center rounded-xl hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all active:scale-95">
                                  <div className="flex items-center justify-center font-bold text-base" style={{ color: stamp.color, border: stamp.shape !== 'none' ? `3px solid ${stamp.color}` : 'none', borderRadius: stamp.shape === 'circle' ? '50%' : '8px', width: '44px', height: '44px' }}>{stamp.text}</div>
                                </button>
                                <button onClick={(e) => {e.stopPropagation(); deleteMyStamp(idx);}} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"><X size={12}/></button>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="w-px h-8 bg-slate-300 rounded-full hidden lg:block"></div>

              {/* 表示モード (全体 / 半ページ) */}
              <div className="relative">
                <button onClick={() => { const wasOpen = showViewMenu; closeAllMenus(); setShowViewMenu(!wasOpen); }} title="表示のしかた" className={`flex items-center gap-1.5 border-2 font-bold px-2.5 sm:px-3 py-2 rounded-xl transition-all active:scale-95 text-sm ${viewMode === 'half' || showViewMenu ? 'bg-amber-100 border-amber-400 text-amber-700 shadow-inner' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                  <Columns size={16} /> <span className="hidden md:inline">表示</span>
                </button>
                {showViewMenu && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 bg-white border border-slate-200 p-2 rounded-xl shadow-xl z-50 flex flex-col gap-1 w-56 animate-in fade-in slide-in-from-top-2">
                    <button onClick={() => selectViewMode('full')} className="flex items-center justify-between gap-2 p-2.5 hover:bg-slate-100 rounded-lg font-bold text-sm text-slate-700 transition-colors text-left">
                      <span className="flex items-center gap-2"><BookOpen size={16} className="text-amber-500"/> ページ全体を表示</span>
                      {viewMode === 'full' && <Check size={16} className="text-amber-500 shrink-0"/>}
                    </button>
                    <div className="text-[10px] font-bold text-slate-600 px-2 pt-1">半ページ表示 (縦向きの画面におすすめ)</div>
                    <button onClick={() => selectViewMode('half', 'ltr')} className="flex items-center justify-between gap-2 p-2.5 hover:bg-slate-100 rounded-lg font-bold text-sm text-slate-700 transition-colors text-left">
                      <span className="flex items-center gap-2"><Columns size={16} className="text-blue-500"/> 左半分から読む</span>
                      {viewMode === 'half' && halfOrder === 'ltr' && <Check size={16} className="text-amber-500 shrink-0"/>}
                    </button>
                    <button onClick={() => selectViewMode('half', 'rtl')} className="flex items-center justify-between gap-2 p-2.5 hover:bg-slate-100 rounded-lg font-bold text-sm text-slate-700 transition-colors text-left">
                      <span className="flex items-center gap-2"><Columns size={16} className="text-pink-500"/> 右半分から読む</span>
                      {viewMode === 'half' && halfOrder === 'rtl' && <Check size={16} className="text-amber-500 shrink-0"/>}
                    </button>
                  </div>
                )}
              </div>

              {/* 全画面表示ボタン */}
              <button onClick={toggleFullscreen} title="全画面表示 (F)" className="flex items-center gap-1.5 bg-white border-2 border-slate-200 hover:bg-slate-50 hover:border-amber-300 text-slate-600 font-bold px-2.5 sm:px-3 py-2 rounded-xl transition-all active:scale-95 text-sm shadow-sm">
                <Maximize size={16} /> <span className="hidden md:inline">全画面</span>
              </button>

              <div className="w-px h-8 bg-slate-300 rounded-full hidden lg:block"></div>

              {/* タイマー表示ボタン */}
              <button onClick={() => setShowTimer(!showTimer)} title="タイマー" className={`flex items-center gap-1.5 font-bold px-2.5 sm:px-4 py-2 rounded-xl transition-all active:scale-95 text-sm shadow-sm ${showTimer ? 'bg-blue-600 text-white shadow-inner' : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-50'}`}>
                <Timer size={16} /> <span className="hidden md:inline">タイマー</span>
              </button>

              <div className="w-px h-8 bg-slate-300 rounded-full hidden lg:block"></div>

              {/* 共有ボタン */}
              <button onClick={startHosting} title="共有する" className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-bold px-2.5 sm:px-4 py-2 rounded-xl transition-all active:scale-95 text-sm shadow-md shadow-emerald-800/30">
                <Share2 size={16} /> <span className="hidden md:inline">共有する</span>
              </button>

              <div className="w-px h-8 bg-slate-300 rounded-full hidden lg:block"></div>

              {/* ショートカットヘルプ */}
              <button onClick={() => setShowShortcuts(true)} className="flex items-center justify-center p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl transition-all active:scale-95 shadow-sm" title="ショートカットキー (?)">
                <Info size={18} />
              </button>

              <div className="w-px h-8 bg-slate-300 rounded-full hidden lg:block"></div>

              {/* ツールバーを隠す */}
              <button onClick={() => { closeAllMenus(); setShowToolbar(false); }} title="ツールバーを隠す" className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2.5 sm:px-3 py-2 rounded-xl transition-all active:scale-95 text-sm shadow-inner">
                <ChevronUp size={18} /> <span className="hidden md:inline">隠す</span>
              </button>
            </div>
          </div>
          )}

          {/* キャンバスエリア */}
          <main ref={containerRef} className="flex-grow relative overflow-hidden bg-slate-200/80">
            {/*
              拡大時もページ全体をスクロールして見られるように、
              スクロール領域内のラッパーへ「拡大後の実サイズ」を明示的に与える
              (transform だけではレイアウト上のサイズが変わらず、端が見切れてしまうため)
            */}
            {/* print-target … 印刷時はこの中身だけを紙に流し込む
                canvas-area   … 手書きの最中に画面そのものが動かないようにする
                scroll-area   … 引っぱり更新が暴発しないようにする */}
            <div ref={canvasScrollRef} className="absolute inset-0 overflow-auto flex print-target canvas-area scroll-area" onClick={closeAllMenus}>
              <div className="m-auto p-3">
                {/*
                  半ページ表示: キャンバス自体は常にページ全体を保持したまま、
                  外側のラッパーを半分の幅にして overflow: hidden で切り抜く。
                  右半分の表示は translateX で左へずらすことで実現する。
                  (書き込み座標や保存データには一切影響しない)
                */}
                <div
                  className={viewMode === 'half' ? 'overflow-hidden' : undefined}
                  style={canvasSize ? {
                    width: (viewMode === 'half' ? canvasSize.w / 2 : canvasSize.w) * fitScale * zoom,
                    height: canvasSize.h * fitScale * zoom,
                  } : undefined}
                >
                  <div
                    className="bg-white shadow-xl rounded-sm"
                    style={{
                      transform: `translateX(${viewMode === 'half' && halfSide === 'right' && canvasSize ? -(canvasSize.w / 2) * fitScale * zoom : 0}px) scale(${fitScale * zoom})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    <canvas ref={canvasRef} />
                  </div>
                </div>
              </div>
            </div>

            {showTimer && <TimerPanel onClose={() => setShowTimer(false)} />}
            
            {/* ページナビゲーション (Floating)
                bottom に safe-area を足すのは、iPhone のホームバーに
                「次のページ」ボタンが隠れて押せなくなるのを防ぐため。 */}
            <div
              className="no-print absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-800/80 backdrop-blur-md text-white rounded-full px-3 sm:px-4 py-1.5 sm:py-2 shadow-lg z-20 animate-in slide-in-from-bottom-5"
              style={{ bottom: 'calc(0.75rem + var(--safe-b))' }}
            >
              <button onClick={() => changePage(-1)} disabled={!canGoPrev} aria-label="まえのページ" className="p-1 hover:text-amber-400 disabled:opacity-30 transition-colors"><ChevronLeft size={24} /></button>

              <div className="relative flex items-center justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); closeAllMenus(); setShowPageJump(!showPageJump); }}
                  className="font-bold w-16 text-center tracking-widest hover:text-amber-400 transition-colors"
                  title="ページを移動"
                  aria-label={`ページを移動 (いま ${currentPage + 1} / ${currentPages.length} ページ)`}
                  aria-haspopup="dialog"
                  aria-expanded={showPageJump}
                >
                  {currentPage + 1} / {currentPages.length}
                </button>
                
                {showPageJump && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white text-slate-800 p-3 rounded-2xl shadow-xl border border-slate-200 animate-in zoom-in-95 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">ページ移動:</span>
                    <input 
                      type="number" 
                      min="1" 
                      max={currentPages.length} 
                      defaultValue={currentPage + 1}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const p = parseInt(e.target.value, 10);
                          if (!isNaN(p) && p >= 1 && p <= currentPages.length) {
                            setCurrentPage(p - 1);
                            setZoom(1);
                            setShowPageJump(false);
                          } else {
                            showToast(`1 から ${currentPages.length} の間で入力してください`, "error");
                          }
                        }
                      }}
                      className="w-16 border-2 border-slate-200 rounded-xl p-1 text-center font-bold focus:border-amber-400 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* 半ページ表示中: いま見ている側の表示と切り替え */}
              {viewMode === 'half' && (
                <div className="flex bg-white/10 rounded-full p-0.5 ml-1">
                  <button onClick={() => setHalfSide('left')} className={`px-2 py-0.5 text-[11px] font-bold rounded-full transition-colors ${halfSide === 'left' ? 'bg-amber-400 text-slate-900' : 'text-white/70 hover:text-white'}`}>左</button>
                  <button onClick={() => setHalfSide('right')} className={`px-2 py-0.5 text-[11px] font-bold rounded-full transition-colors ${halfSide === 'right' ? 'bg-amber-400 text-slate-900' : 'text-white/70 hover:text-white'}`}>右</button>
                </div>
              )}

              <button onClick={() => changePage(1)} disabled={!canGoNext} aria-label="つぎのページ" className="p-1 hover:text-amber-400 disabled:opacity-30 transition-colors"><ChevronRight size={24} /></button>
            </div>

            {/* ズーム＆クリア (Floating Right) */}
            {/* 全画面表示中の終了ボタン (ヘッダー類が隠れるため常に見える位置に置く) */}
            {hideChrome && (
              <button onClick={toggleFullscreen} title="全画面を終了 (F)" aria-label="全画面を終了" className="no-print absolute top-3 right-3 z-30 p-3 bg-slate-800/70 hover:bg-slate-800/90 backdrop-blur-md text-white rounded-full shadow-lg transition-all active:scale-95 animate-in fade-in">
                <Minimize size={20} />
              </button>
            )}

            <div
              className="no-print absolute right-3 sm:right-6 flex flex-col gap-2 sm:gap-3 z-20"
              style={{ bottom: 'calc(0.75rem + var(--safe-b))' }}
            >
              <div className="flex flex-col bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <button onClick={() => setZoom(Math.min(3, zoom + 0.2))} aria-label="大きくする" className="p-2.5 sm:p-3 text-slate-600 hover:bg-slate-50 hover:text-amber-700 transition-colors border-b border-slate-100"><ZoomIn size={20} /></button>
                <div className="py-1 text-center font-bold text-xs text-slate-500 bg-slate-50" aria-live="polite">{Math.round(zoom * 100)}%</div>
                <button onClick={() => setZoom(Math.max(0.5, zoom - 0.2))} aria-label="小さくする" className="p-2.5 sm:p-3 text-slate-600 hover:bg-slate-50 hover:text-amber-700 transition-colors border-t border-slate-100"><ZoomOut size={20} /></button>
              </div>
              {/* 提示モード … 電子黒板で一斉授業に使うとき、教室の後ろから読める大きさにする */}
              <button
                onClick={() => setIsPresentation(v => !v)}
                title={isPresentation ? "提示モードを終わる" : "大きく表示（電子黒板用）"}
                aria-label={isPresentation ? "提示モードを終わる" : "大きく表示（電子黒板用）"}
                aria-pressed={isPresentation}
                className={`p-3 sm:p-4 rounded-xl shadow-lg transition-all active:scale-95 border ${isPresentation ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Presentation size={22} />
              </button>
              {/* 印刷 … 書き込んだページを紙で配るのは、この種のアプリの本質機能 */}
              <button
                onClick={handlePrint}
                title="このページを印刷する"
                aria-label="このページを印刷する"
                className="p-3 sm:p-4 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-amber-700 rounded-xl shadow-lg transition-all active:scale-95"
              >
                <Printer size={22} />
              </button>
              <button onClick={clearCurrentPage} aria-label="このページの書き込みをすべて消す" className="p-3 sm:p-4 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-xl shadow-lg transition-all active:scale-95 group">
                <Trash2 size={22} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </main>
        </>
      )}

      {/* --- カスタム UI コンポーネント --- */}

      {/* P2P ホスティング（共有元）モーダル */}
      {shareMode === 'hosting' && (
        <div role="dialog" aria-modal="true" aria-label="データを共有する" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 md:p-8 text-center animate-in zoom-in-95">
            <div className="mx-auto bg-emerald-100 text-emerald-700 w-12 h-12 rounded-full flex items-center justify-center mb-3">
              <Share2 size={24} />
            </div>
            <h3 className="font-bold text-xl mb-2 text-slate-800">デジタル教科書を共有</h3>
            <p className="text-slate-500 font-bold text-xs mb-5">
              以下のURLかQRコードを児童生徒に共有してください。<br/>
              <span className="text-red-500">※全員が開き終わるまで、この画面は閉じないでください。</span>
            </p>
            
            {shareUrl ? (
              <>
                <div className="flex justify-center mb-4">
                  <div className="p-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <canvas ref={qrCanvasRef} className="mx-auto" />
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl mb-4 border border-slate-200">
                  <input type="text" readOnly value={shareUrl} className="flex-1 bg-transparent border-none outline-none text-slate-600 text-xs font-mono px-2" />
                  <button 
                    onClick={() => { navigator.clipboard.writeText(shareUrl); showToast("URLをコピーしました！", "success"); }}
                    className="p-2 bg-white rounded-lg shadow-sm text-emerald-700 hover:bg-emerald-50 transition-colors flex-shrink-0"
                    title="URLをコピー"
                  >
                    <Copy size={18} />
                  </button>
                </div>
                <div className="text-xs font-bold text-emerald-700 bg-emerald-50 py-2 px-4 rounded-full inline-block mb-6 animate-pulse">
                  {shareStatus}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-500 mb-6">
                <Loader2 className="animate-spin text-emerald-500" size={32} />
                <span className="font-bold text-sm">{shareStatus}</span>
              </div>
            )}
            
            <button onClick={stopHosting} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
              共有を終了して閉じる
            </button>
          </div>
        </div>
      )}

      {/* P2P 受信中モーダル */}
      {shareMode === 'receiving' && (
        <div role="dialog" aria-modal="true" aria-label="データを受信しています" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center flex flex-col items-center">
             <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
             <h3 className="font-bold text-xl mb-2 text-slate-800">データを受信しています</h3>
             <p className="text-slate-500 font-bold text-sm animate-pulse">{shareStatus}</p>
          </div>
        </div>
      )}

      {/* ショートカットキーモーダル */}
      {showShortcuts && (
        <div role="dialog" aria-modal="true" aria-label="ショートカットキー" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[600] p-4 animate-in fade-in" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90dvh] flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                <Info className="text-amber-500"/> ショートカットキー
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                <X size={20}/>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">次のページ</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">→</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">前のページ</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">←</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">拡大 (ズームイン)</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">↑</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">縮小 (ズームアウト)</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">↓</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">元に戻す</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">Ctrl + Z</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">やり直し</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">Ctrl + Y</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">選択モード</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">V</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">えんぴつ</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">P</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">マーカー</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">H</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">けしごむ</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">E</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">QR読み取り</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">Q</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">全画面表示</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">F</kbd>
                </div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-bold">削除</span>
                  <kbd className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg font-mono font-bold text-xs">Del / BS</kbd>
                </div>
              </div>
              {/* スマホ・タブレットでの「ページ送り」操作の案内 */}
              <div className="mt-6 bg-sky-50/70 border border-sky-200 rounded-xl p-4">
                <div className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-1.5">
                  <MousePointer2 size={16} className="text-sky-500" /> スマホ・タブレットで「ページ送り」
                </div>
                <ul className="text-xs font-bold text-slate-500 leading-relaxed list-disc pl-5 space-y-0.5">
                  <li>選択モードのとき、教科書の上を左へスワイプで次のページ</li>
                  <li>同じく、右へスワイプで前のページ</li>
                </ul>
                <p className="text-[11px] font-bold text-slate-600 mt-2 leading-relaxed">
                  えんぴつなどの書き込み中は、書き込みを優先するためスワイプでのページ送りは働きません。
                  拡大して画面からはみ出しているときも、スクロールを優先します。
                </p>
              </div>

              {/* スマホ・タブレットでの「戻る」操作の案内 */}
              <div className="mt-6 bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                <div className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-1.5">
                  <ChevronLeft size={16} className="text-amber-500" /> スマホ・タブレットで「戻る」
                </div>
                <ul className="text-xs font-bold text-slate-500 leading-relaxed list-disc pl-5 space-y-0.5">
                  <li>画面下のナビゲーションバーの「戻る」をタップ</li>
                  <li>画面の左右どちらかの端から、中央に向かってスワイプ</li>
                </ul>
                <p className="text-[11px] font-bold text-slate-600 mt-2 leading-relaxed">
                  開いているメニュー → 全画面表示 → 教科書の画面 → 一覧 の順に、1つずつ戻ります。
                  アプリが終了したり、ブラウザで別のページへ移動したりすることはありません。
                </p>
              </div>
              <div className="mt-4 text-center text-xs text-slate-500 font-bold">
                「?」キーを押すことでも、この画面を開閉できます。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* バックアップ取り込み確認モーダル */}
      {importPreview && (
        <div role="dialog" aria-modal="true" aria-label="バックアップを取り込む" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[400] p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6 md:p-7 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-xl mb-1 text-slate-800 flex items-center gap-2">
                <Upload size={20} className="text-emerald-700" /> バックアップを取り込む
              </h3>
              <p className="text-xs font-bold text-slate-500 truncate" title={importPreview.fileName}>
                {importPreview.fileName}
              </p>
            </div>
            <div className="p-6 md:p-7">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-5 text-sm">
                <div className="flex justify-between py-1"><span className="text-slate-500 font-bold">書き出し日時</span><span className="text-slate-700 font-bold">{importPreview.summary.exportedAt}</span></div>
                <div className="flex justify-between py-1"><span className="text-slate-500 font-bold">教科書の数</span><span className="text-slate-700 font-bold">{importPreview.summary.tbCount} 冊</span></div>
                <div className="flex justify-between py-1"><span className="text-slate-500 font-bold">合計ページ数</span><span className="text-slate-700 font-bold">{importPreview.summary.pageCount} ページ</span></div>
                <div className="flex justify-between py-1"><span className="text-slate-500 font-bold">マイスタンプ</span><span className="text-slate-700 font-bold">{importPreview.summary.stampCount} 個</span></div>
              </div>
              <p className="text-xs font-bold text-slate-500 leading-relaxed mb-1">取り込み方法を選んでください。</p>
              <ul className="text-xs font-bold text-slate-500 leading-relaxed list-disc pl-5 mb-2">
                <li><span className="text-emerald-700">追加で取り込む</span>: 今ある教科書はそのまま残ります（推奨）</li>
                <li><span className="text-red-500">置き換える</span>: 現在のすべての教科書・書き込みが消えます</li>
              </ul>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex flex-wrap justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setImportPreview(null)}
                disabled={isProcessing}
                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 font-bold text-slate-600 rounded-xl transition-all disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                onClick={() => showConfirm(
                  "すべて置き換えますか？",
                  "現在の教科書・書き込み・マイスタンプはすべて削除され、バックアップの内容に置き換わります。",
                  () => applyImport('replace'),
                  "置き換える",
                  true
                )}
                disabled={isProcessing}
                className="px-4 py-2.5 bg-white border-2 border-red-200 hover:bg-red-50 font-bold text-red-600 rounded-xl transition-all disabled:opacity-40"
              >
                置き換える
              </button>
              <button
                onClick={() => applyImport('merge')}
                disabled={isProcessing}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 font-bold text-white rounded-xl transition-all shadow-md shadow-emerald-800/30 disabled:opacity-40 flex items-center gap-2"
              >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                追加で取り込む
              </button>
            </div>
          </div>
        </div>
      )}

      {/* マイスタンプ作成モーダル */}
      {showMyStampCreator && (
        <div role="dialog" aria-modal="true" aria-label="マイスタンプを作る" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in">
           <form onSubmit={(e) => {
             e.preventDefault();
             const t = e.target.stampText.value, c = e.target.stampColor.value, s = e.target.stampShape.value;
             if(!t) return;
             const newStamps = [...myStamps, { text: t, color: c, shape: s }];
             setMyStamps(newStamps); localStorage.setItem(DB_KEY_MYSTAMPS, JSON.stringify(newStamps));
             setShowMyStampCreator(false); showToast("マイスタンプを保存しました", "success");
           }} className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-sm animate-in zoom-in-95">
              <h3 className="font-bold text-xl mb-5 text-slate-800 border-b pb-3 flex items-center gap-2"><Settings size={20} className="text-amber-500"/> マイスタンプ作成</h3>
              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-500 mb-2">スタンプの文字 (1〜3文字推奨)</label>
                <input name="stampText" type="text" maxLength={5} required placeholder="例: OK, 💮" className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold focus:border-amber-400 outline-none transition-colors bg-slate-50 focus:bg-white"/>
              </div>
              <div className="mb-6 flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-2">枠の形</label>
                  <select name="stampShape" className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold focus:border-amber-400 outline-none bg-slate-50 focus:bg-white cursor-pointer">
                    <option value="none">枠なし</option>
                    <option value="circle">丸 (◯)</option>
                    <option value="square">四角 (□)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">色</label>
                  <div className="border-2 border-slate-200 rounded-xl p-1 bg-slate-50 hover:bg-white transition-colors">
                    <input name="stampColor" type="color" defaultValue="#ef4444" className="w-12 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent"/>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-2">
                <button type="button" onClick={() => setShowMyStampCreator(false)} className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 font-bold text-slate-600 rounded-xl transition-all">キャンセル</button>
                <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 font-bold text-white rounded-xl transition-all shadow-md shadow-amber-800/30">保存して追加</button>
              </div>
           </form>
        </div>
      )}

      {/* カスタム確認ダイアログ */}
      {dialog && (
        <div role="dialog" aria-modal="true" aria-label="かくにん" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8">
              <h3 className="font-bold text-xl mb-3 text-slate-800 flex items-center gap-2">
                {dialog.isDestructive ? <AlertCircle className="text-red-500"/> : <Info className="text-blue-500"/>}
                {dialog.title}
              </h3>
              <p className="text-slate-600 font-medium leading-relaxed">{dialog.message}</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setDialog(null)} className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 font-bold text-slate-600 rounded-xl transition-all">キャンセル</button>
              <button onClick={() => { dialog.onConfirm(); setDialog(null); }} className={`px-5 py-2.5 font-bold text-white rounded-xl transition-all shadow-lg ${dialog.isDestructive ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'}`}>
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カスタムトースト通知 */}
      {toast && (
        // 保存できた・失敗したといった状態の変化は、画面を見ていない人にも
        // 伝わるよう読み上げてもらう。読み上げ中の操作は妨げない polite にする。
        <div
          role="status"
          aria-live="polite"
          className={`no-print fixed right-6 md:right-10 px-5 py-3.5 rounded-2xl shadow-xl font-bold flex items-center gap-3 animate-in slide-in-from-bottom-5 z-[400] ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'}`}
          style={{ bottom: 'calc(1.5rem + var(--safe-b))' }}
        >
          {toast.type === 'error'
            ? <AlertCircle size={20}/>
            : toast.type === 'info'
              ? <Info size={20} className="text-sky-300"/>
              : <CheckCircle2 size={20} className="text-green-400"/>}
          {toast.message}
        </div>
      )}

      {/* フッターもトップの教科書選択画面でのみ表示し、教科書画面は学習領域を最大化する */}
      {!currentTextbookId && <Footer />}
    </div>
  );
}

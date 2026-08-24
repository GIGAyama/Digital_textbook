/**
 * 画面の枠まわり（ヘッダー・フッター）と、タイマーのパネル。
 * どれも App の状態を持たない独立した部品。
 */
import React, { useState, useEffect } from 'react';
import { Book, ChevronLeft, X, Play, Pause, RotateCcw } from 'lucide-react';
import { APP_NAME, APP_DISCLAIMER, DEVELOPER_NAME, HOMEPAGE_LINK, ARTICLE_LINK } from '../constants.js';

// ==========================================
// 3. 共通UIコンポーネント (モダン化)
// ==========================================

export const Header = ({ onGoHome, title }) => (
  <nav className="bg-white border-b-4 border-amber-500 px-3 sm:px-6 py-1.5 sm:py-2.5 flex justify-between items-center shadow-sm z-20 shrink-0">
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      {onGoHome ? (
        <button onClick={onGoHome} className="flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-amber-700 bg-slate-100 hover:bg-amber-50 px-2 sm:px-3 py-1.5 rounded-xl transition-all active:scale-95 shrink-0">
          <ChevronLeft size={18} /> <span className="hidden sm:inline">一覧へ戻る</span>
        </button>
      ) : (
        <div className="bg-amber-100 p-2 rounded-xl text-amber-700 shadow-inner shrink-0"><Book size={22} /></div>
      )}
      <div className="min-w-0">
        <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight line-clamp-1">{title || APP_NAME}</h1>
        {/* 制度上の「学習者用デジタル教科書」と取り違えられないよう、名前のすぐ下に書く */}
        <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 leading-tight line-clamp-2">{APP_DISCLAIMER}</p>
      </div>
    </div>
  </nav>
);

// 編集画面では学習領域を最大化するため、スマホ等の小さな画面ではフッターを隠す
export const Footer = ({ compact = false }) => (
  <footer className={`w-full bg-white border-t border-slate-200 py-1.5 text-center text-xs text-slate-500 font-bold shadow-sm shrink-0 z-20 ${compact ? 'hidden lg:block' : ''}`}>
    &copy; {new Date().getFullYear()} {APP_NAME} <a href={HOMEPAGE_LINK} target="_blank" rel="noopener noreferrer" className="text-inherit hover:text-inherit no-underline cursor-default">{DEVELOPER_NAME}</a>
    <a href={ARTICLE_LINK} target="_blank" rel="noopener noreferrer" className="ml-2 text-inherit hover:underline">使い方を読む</a>
  </footer>
);

// タイマー＆ストップウォッチパネル
export const TimerPanel = ({ onClose }) => {
  const [tab, setTab] = useState('timer');
  const [timeLeft, setTimeLeft] = useState(300);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [swTime, setSwTime] = useState(0);
  const [isSwRunning, setIsSwRunning] = useState(false);
  
  useEffect(() => {
    let interval;
    if (tab === 'timer' && isTimerRunning && timeLeft > 0) interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    else if (tab === 'timer' && timeLeft === 0) setIsTimerRunning(false);
    else if (tab === 'stopwatch' && isSwRunning) interval = setInterval(() => setSwTime(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft, isSwRunning, tab]);

  const displayTime = tab === 'timer' ? timeLeft : swTime;
  const mins = Math.floor(displayTime / 60).toString().padStart(2, '0');
  const secs = (displayTime % 60).toString().padStart(2, '0');
  const isRunning = tab === 'timer' ? isTimerRunning : isSwRunning;

  return (
    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl z-50 p-4 w-64 animate-in fade-in slide-in-from-top-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
          <button onClick={() => setTab('timer')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${tab === 'timer' ? 'bg-white shadow-sm text-amber-700' : 'text-slate-600 hover:text-slate-800'}`}>タイマー</button>
          <button onClick={() => setTab('stopwatch')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${tab === 'stopwatch' ? 'bg-white shadow-sm text-amber-700' : 'text-slate-600 hover:text-slate-800'}`}>ウォッチ</button>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><X size={18}/></button>
      </div>
      
      <div className={`text-4xl font-mono text-center font-bold mb-4 p-4 rounded-xl border-2 transition-colors ${tab === 'timer' && timeLeft === 0 ? 'bg-red-50 text-red-500 border-red-200 animate-pulse shadow-inner' : 'bg-slate-50 text-slate-800 border-slate-200 shadow-inner'}`}>
        {mins}:{secs}
      </div>
      
      {tab === 'timer' ? (
        <div className="flex justify-center gap-2 mb-4">
          <button onClick={() => setTimeLeft(t => t + 60)} className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-colors">+1分</button>
          <button onClick={() => setTimeLeft(t => t + 300)} className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-colors">+5分</button>
          <button onClick={() => { setTimeLeft(300); setIsTimerRunning(false); }} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-bold text-red-600 flex items-center transition-colors"><RotateCcw size={14}/></button>
        </div>
      ) : (
        <div className="flex justify-center mb-4">
           <button onClick={() => { setSwTime(0); setIsSwRunning(false); }} className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 flex items-center justify-center gap-1 transition-colors"><RotateCcw size={14}/> リセット</button>
        </div>
      )}

      <button onClick={() => tab === 'timer' ? setIsTimerRunning(!isTimerRunning) : setIsSwRunning(!isSwRunning)} className={`w-full py-2.5 rounded-xl font-bold text-white flex justify-center items-center gap-2 transition-all active:scale-95 shadow-md ${isRunning ? 'bg-amber-700 hover:bg-amber-800' : 'bg-blue-600 hover:bg-blue-700'}`}>
        {isRunning ? <><Pause size={18}/> ストップ</> : <><Play size={18}/> スタート</>}
      </button>
    </div>
  );
};

import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

export function TopNav() {
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  const linkClass = ({ isActive }) =>
    `text-sm font-semibold transition-colors ${isActive ? 'text-neon-cyan' : 'text-slate-400 hover:text-white'}`;

  const copyCommand = (cmd) => {
    navigator.clipboard.writeText(cmd);
    setCopyFeedback(`Copied "${cmd}"`);
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  return (
    <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-10">
        <Link className="text-xl font-black tracking-tight text-white flex items-center gap-2" to="/">
          <span className="flex h-3 w-3 rounded-full bg-neon-cyan shadow-[0_0_10px_#32e6ff]" />
          ClipForge <span className="text-neon-red">AI</span>
        </Link>
        <div className="flex items-center gap-6">
          <NavLink className={linkClass} to="/">Home</NavLink>
          <NavLink className={linkClass} to="/jobs">Queue</NavLink>
          <button
            type="button"
            onClick={() => setShowTelegramModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-300 hover:border-neon-cyan hover:text-white transition"
          >
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            Telegram Bot
          </button>
          <NavLink
            to="/create"
            className="rounded-lg border border-neon-cyan/70 bg-neon-cyan/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-neon-cyan shadow-[0_0_16px_rgba(50,230,255,0.25)] transition hover:bg-neon-cyan hover:text-black hover:shadow-[0_0_24px_rgba(50,230,255,0.5)]"
          >
            ⚡ Create Video
          </NavLink>
        </div>
      </nav>

      {/* Telegram Bot Quick Connect Modal */}
      {showTelegramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl border border-blue-400/50 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-400" />
                <h3 className="text-base font-bold text-white">Telegram Multimodal Bot</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTelegramModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                You can create, approve, and receive AI short videos straight inside Telegram using voice messages or text commands.
              </p>

              <div className="space-y-2">
                <span className="font-bold uppercase tracking-wider text-neon-cyan block">Quick Commands:</span>
                <div
                  onClick={() => copyCommand('/start YOLOv11')}
                  className="cursor-pointer rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-slate-200 hover:border-neon-cyan transition flex items-center justify-between"
                >
                  <span>/start &lt;topic or github url&gt;</span>
                  <span className="text-[0.65rem] text-neon-cyan">Copy</span>
                </div>
                <div
                  onClick={() => copyCommand('Send a Voice Note')}
                  className="rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-slate-200"
                >
                  <span>🎙️ Send voice note to answer interview questions</span>
                </div>
              </div>

              {copyFeedback && (
                <p className="text-xs font-bold text-emerald-400">{copyFeedback}</p>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowTelegramModal(false)}
                  className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-bold text-white hover:bg-white/10 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

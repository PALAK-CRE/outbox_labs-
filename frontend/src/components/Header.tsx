import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Plus, ExternalLink, Slack, LogOut, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  onOpenCompose: () => void;
  onOpenSlackModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCompose, onOpenSlackModal }) => {
  const { user, logout, slackStatus } = useAuth();
  const bullBoardUrl = import.meta.env.VITE_BULL_BOARD_URL || 'http://localhost:5000/admin/queues';

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-800 bg-[#0A0E17]/85 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-glow">
              <div className="h-full w-full bg-[#0B0F17] rounded-[10px] flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">ReachInbox</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 rounded-full uppercase">
                  Scheduler
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Production-grade distributed email queue</p>
            </div>
          </div>

          {/* Center / Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* BullMQ Dashboard Link */}
            <a
              href={bullBoardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors shadow-sm"
              title="Open real-time BullMQ dashboard"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden md:inline">BullMQ Dashboard</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>

            {/* Slack Connection Status Button */}
            <button
              onClick={onOpenSlackModal}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                slackStatus?.connected
                  ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-purple-950/40 border border-purple-500/40 text-purple-300 hover:bg-purple-900/40'
              }`}
            >
              <Slack className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {slackStatus?.connected
                  ? `Slack: ${slackStatus.channelName || 'Connected'}`
                  : 'Connect Slack'}
              </span>
              {slackStatus?.connected && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
            </button>

            {/* Compose New Email Primary CTA */}
            <button
              onClick={onOpenCompose}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-glow transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Compose New Email</span>
              <span className="sm:hidden">Compose</span>
            </button>

            {/* User Profile & Logout */}
            {user && (
              <div className="flex items-center pl-2 border-l border-slate-800 gap-2.5">
                <img
                  src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-slate-700 object-cover bg-slate-800"
                />
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">{user.name}</div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[120px]">{user.email}</div>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

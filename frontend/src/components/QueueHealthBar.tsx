import React from 'react';
import { DashboardStats } from '../types';
import { Gauge, ShieldCheck, Zap, Server } from 'lucide-react';

interface QueueHealthBarProps {
  stats: DashboardStats | null;
}

export const QueueHealthBar: React.FC<QueueHealthBarProps> = ({ stats }) => {
  if (!stats) return null;

  const rateLimit = stats.rateLimit;
  const percentUsed = Math.min(100, Math.max(0, rateLimit.percentUsed));
  const isNearLimit = percentUsed >= 80;

  return (
    <div className="rounded-2xl bg-[#0D131F]/90 border border-slate-800/80 p-4 mb-6 backdrop-blur-md">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Hourly Rate Limiting Gauge */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-200">Sender Hourly Rate-Limit Quota</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {rateLimit.sender}
              </span>
            </div>
            <div className="text-xs font-medium text-slate-300">
              <span className={isNearLimit ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                {rateLimit.usedThisHour}
              </span>{' '}
              / {rateLimit.limit} emails/hr ({percentUsed}%)
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isNearLimit
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-glow'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
            <span>Window resets in ~{Math.ceil(rateLimit.resetInMs / 60000)} mins</span>
            <span>{rateLimit.remainingThisHour} remaining in current window</span>
          </div>
        </div>

        {/* Right: Engine Telemetry Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-3 lg:pt-0 lg:border-l lg:border-slate-800 lg:pl-4">
          
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-800/60 border border-slate-700/60 text-slate-300">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>Delay: {stats.system.minDelayMs / 1000}s/email</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-800/60 border border-slate-700/60 text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Redis: Connected</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-800/60 border border-slate-700/60 text-slate-300">
            <Server className="h-3.5 w-3.5 text-blue-400" />
            <span>
              ES: {stats.system.elasticsearchOnline ? (
                <span className="text-emerald-400 font-medium">Online</span>
              ) : (
                <span className="text-slate-400 font-medium">DB Fallback Sync</span>
              )}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

import React from 'react';
import { DashboardStats } from '../types';
import { Mail, Clock, Send, AlertTriangle, Layers } from 'lucide-react';

interface StatsCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse" />
        ))}
      </div>
    );
  }

  const items = [
    {
      title: 'Scheduled Queue',
      value: stats.database.scheduled,
      subValue: `${stats.queue.delayed} delayed in BullMQ`,
      icon: Clock,
      color: 'text-amber-400',
      bgGlow: 'from-amber-500/10 to-transparent',
      borderColor: 'border-amber-500/20',
    },
    {
      title: 'Successfully Sent',
      value: stats.database.sent,
      subValue: `${stats.queue.completed} completed jobs`,
      icon: Send,
      color: 'text-emerald-400',
      bgGlow: 'from-emerald-500/10 to-transparent',
      borderColor: 'border-emerald-500/20',
    },
    {
      title: 'Active Workers',
      value: `${stats.system.concurrency} threads`,
      subValue: `${stats.queue.active} job(s) in progress`,
      icon: Layers,
      color: 'text-blue-400',
      bgGlow: 'from-blue-500/10 to-transparent',
      borderColor: 'border-blue-500/20',
    },
    {
      title: 'Failed / Rescheduled',
      value: stats.database.failed,
      subValue: `${stats.queue.failed} failed attempts`,
      icon: AlertTriangle,
      color: 'text-rose-400',
      bgGlow: 'from-rose-500/10 to-transparent',
      borderColor: 'border-rose-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${item.bgGlow} bg-[#0D131F]/80 p-5 border ${item.borderColor} backdrop-blur-md transition-all hover:translate-y-[-2px]`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{item.title}</span>
              <div className={`p-2 rounded-xl bg-slate-900/80 border border-slate-800 ${item.color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-white tracking-tight">{item.value}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{item.subValue}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

import React from 'react';
import { EmailJob } from '../types';
import { format } from 'date-fns';
import { Clock, Calendar, XCircle, RefreshCw, Mail, AlertCircle } from 'lucide-react';

interface ScheduledTableProps {
  emails: EmailJob[];
  loading: boolean;
  onCancel: (id: string) => void;
  onReschedule: (job: EmailJob) => void;
  onOpenCompose: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onCancel,
  onReschedule,
  onOpenCompose,
}) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-900/60 border border-slate-800/80 animate-pulse" />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-16 px-4 rounded-2xl bg-[#0D131F]/50 border border-dashed border-slate-800">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">No Scheduled Emails</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-5">
          You don't have any pending or scheduled emails in the BullMQ queue right now.
        </p>
        <button
          onClick={onOpenCompose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-glow transition-all"
        >
          <Mail className="h-4 w-4" />
          Schedule Your First Email
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: string, errorMessage?: string | null) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Scheduled
          </span>
        );
      case 'QUEUED':
      case 'SENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            Sending...
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20"
            title={errorMessage || 'Hourly rate limit hit. Rescheduled into next window.'}
          >
            <AlertCircle className="w-3 h-3 text-purple-400" />
            Rate-Limit Rescheduled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-[#0D131F]/80 border border-slate-800/80 backdrop-blur-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-4 sm:px-6">Recipient</th>
              <th className="py-3.5 px-4">Subject</th>
              <th className="py-3.5 px-4">Sender Relay</th>
              <th className="py-3.5 px-4">Scheduled Execution</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {emails.map((job) => {
              const scheduledDate = new Date(job.scheduledAt);
              const formattedDate = !isNaN(scheduledDate.getTime())
                ? format(scheduledDate, 'MMM d, yyyy · h:mm:ss a')
                : job.scheduledAt;

              return (
                <tr key={job.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="py-4 px-4 sm:px-6 font-medium text-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 text-xs font-semibold">
                        {job.recipientEmail.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[200px]">{job.recipientEmail}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-slate-300 font-medium">
                    <div className="truncate max-w-[220px]" title={job.subject}>
                      {job.subject}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-slate-400 text-xs">
                    <span className="truncate max-w-[160px] inline-block font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                      {job.senderEmail}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-300 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{formattedDate}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {getStatusBadge(job.status, job.errorMessage)}
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onReschedule(job)}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-950/40 rounded-lg transition-colors"
                        title="Reschedule"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onCancel(job.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Cancel Job"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

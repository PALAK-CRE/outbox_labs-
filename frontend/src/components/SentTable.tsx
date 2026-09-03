import React from 'react';
import { EmailJob } from '../types';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, ExternalLink, Send, AlertTriangle } from 'lucide-react';

interface SentTableProps {
  emails: EmailJob[];
  loading: boolean;
  onOpenCompose: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({ emails, loading, onOpenCompose }) => {
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
        <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
          <Send className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">No Sent Emails Yet</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-5">
          Once your scheduled jobs execute, your delivered emails and Ethereal preview links will appear here.
        </p>
        <button
          onClick={onOpenCompose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-glow transition-all"
        >
          <Send className="h-4 w-4" />
          Send An Email Campaign
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-[#0D131F]/80 border border-slate-800/80 backdrop-blur-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-4 sm:px-6">Recipient</th>
              <th className="py-3.5 px-4">Subject</th>
              <th className="py-3.5 px-4">Sender Relay</th>
              <th className="py-3.5 px-4">Sent At</th>
              <th className="py-3.5 px-4">Delivery Status</th>
              <th className="py-3.5 px-4 sm:px-6 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {emails.map((job) => {
              const isSent = job.status === 'SENT';
              const sentDate = job.sentAt ? new Date(job.sentAt) : null;
              const formattedDate = sentDate && !isNaN(sentDate.getTime())
                ? format(sentDate, 'MMM d, yyyy · h:mm:ss a')
                : '—';

              return (
                <tr key={job.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="py-4 px-4 sm:px-6 font-medium text-slate-200">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                          isSent
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                        }`}
                      >
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
                  <td className="py-4 px-4 text-slate-400 text-xs font-mono">
                    <span className="truncate max-w-[160px] inline-block bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                      {job.senderEmail}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-300 text-xs">
                    {formattedDate}
                  </td>
                  <td className="py-4 px-4">
                    {isSent ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Sent
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20"
                        title={job.errorMessage || 'Send failure'}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right">
                    {job.etherealMessageUrl ? (
                      <a
                        href={job.etherealMessageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 transition-all shadow-sm group-hover:border-blue-400"
                        title="View rendered email on Ethereal"
                      >
                        <span>View in Ethereal</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No Preview</span>
                    )}
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

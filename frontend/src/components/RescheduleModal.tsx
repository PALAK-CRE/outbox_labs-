import React, { useState } from 'react';
import { EmailJob } from '../types';
import { ApiService } from '../services/api';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';

interface RescheduleModalProps {
  job: EmailJob | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({ job, isOpen, onClose, onSuccess }) => {
  const [newTime, setNewTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTime) {
      setError('Please select a valid date and time.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await ApiService.rescheduleEmail(job.id, new Date(newTime).toISOString());
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to reschedule');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0D131F] border border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Reschedule Email</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-xs text-slate-300">
            <span className="text-slate-400">Recipient:</span> <strong className="text-white">{job.recipientEmail}</strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Dispatch Time</label>
            <input
              type="datetime-local"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-glow transition-all"
            >
              {submitting ? 'Rescheduling...' : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

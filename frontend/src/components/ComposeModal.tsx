import React, { useState, useRef, useEffect } from 'react';
import { ApiService } from '../services/api';
import { Sender } from '../types';
import { X, Upload, Mail, Clock, ShieldAlert, Sparkles, CheckCircle2, Paperclip, File, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduledSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onScheduledSuccess }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manualRecipients, setManualRecipients] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [shouldAttachFile, setShouldAttachFile] = useState(false);
  const [detectedEmailsCount, setDetectedEmailsCount] = useState(0);
  const [senderEmail, setSenderEmail] = useState('');
  const [senders, setSenders] = useState<Sender[]>([]);
  
  // Scheduling controls
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [customStartTime, setCustomStartTime] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseEmailsFromText = (text: string): string[] => {
    const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(regex) || [];
    return Array.from(new Set(matches.map((m) => m.toLowerCase().trim())));
  };

  // Load senders
  useEffect(() => {
    if (isOpen) {
      ApiService.getSenders().then((res) => {
        setSenders(res.data);
        if (res.data.length > 0 && !senderEmail) {
          setSenderEmail(res.data[0].email);
        }
      }).catch(console.error);

      // Default start time 5 minutes in future for 'later'
      const inFiveMins = new Date(Date.now() + 5 * 60000);
      setCustomStartTime(new Date(inFiveMins.getTime() - inFiveMins.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    }
  }, [isOpen]);

  // Recalculate detected emails count when manual input changes
  useEffect(() => {
    const detected = parseEmailsFromText(manualRecipients);
    setDetectedEmailsCount(detected.length);
  }, [manualRecipients]);

  if (!isOpen) return null;

  const processUploadedFile = (uploadedFile: File) => {
    setFile(uploadedFile);

    const isLeadList = uploadedFile.name.endsWith('.csv') || uploadedFile.name.endsWith('.txt');
    if (isLeadList) {
      // For CSV/TXT lead files, do NOT attach by default
      setShouldAttachFile(false);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const fromFile = parseEmailsFromText(text);
        if (fromFile.length > 0) {
          const currentRecipients = parseEmailsFromText(manualRecipients);
          const merged = Array.from(new Set([...currentRecipients, ...fromFile]));
          setManualRecipients(merged.join('\n'));
        }
      };
      reader.readAsText(uploadedFile);
    } else {
      // For general documents/images, default to attach
      setShouldAttachFile(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setShouldAttachFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadSampleLeads = () => {
    const sample = [
      'kaddambinee.yadav.cs27@iilm.edu',
      'sarah.connor@outboxlabs.com',
      'alex.hunter@reachinbox.ai',
    ].join('\n');
    setManualRecipients(sample);
    setSubject('Supercharging Your Cold Outreach with ReachInbox 🚀');
    setBody(`<p>Hi there,</p>
<p>I noticed your team has been scaling outreach. ReachInbox automates verified lead prospecting and dynamic AI personalization.</p>
<p>Attached you will find our latest documentation and overview file.</p>
<p>Best regards,<br/><strong>ReachInbox Growth Team</strong></p>`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError('Please provide an email subject.');
      return;
    }
    if (!body.trim()) {
      setError('Please provide email body content.');
      return;
    }
    if (detectedEmailsCount === 0) {
      setError('Please enter or upload at least one valid recipient email address.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('body', body);
      formData.append('senderEmail', senderEmail);
      formData.append('delayBetweenMs', (delaySeconds * 1000).toString());
      formData.append('hourlyLimit', hourlyLimit.toString());
      formData.append('attachFile', shouldAttachFile ? 'true' : 'false');

      const startTime = scheduleType === 'now' ? new Date().toISOString() : new Date(customStartTime).toISOString();
      formData.append('startTime', startTime);

      if (manualRecipients.trim()) {
        formData.append('recipients', manualRecipients);
      }
      if (file) {
        formData.append('file', file);
      }

      await ApiService.scheduleEmails(formData);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      onScheduledSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to schedule:', err);
      setError(err.response?.data?.error || err.message || 'Failed to schedule campaign');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-[#0D131F] border border-slate-800 shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Compose & Schedule Email Campaign</h2>
              <p className="text-xs text-slate-400">BullMQ delayed dispatch with file attachments & rate limiting</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadSampleLeads}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-950/50 border border-indigo-500/30 hover:bg-indigo-900/50 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Fill Sample Leads
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Senders & Subject */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Sender Relay</label>
              <select
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              >
                {senders.map((s) => (
                  <option key={s.email} value={s.email}>
                    {s.email} ({s.provider})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Scaling lead pipeline with AI workflows"
                className="w-full px-3.5 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Recipients / File Upload Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">Recipient Leads</label>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                {detectedEmailsCount} leads detected
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Textarea */}
              <div>
                <textarea
                  rows={4}
                  value={manualRecipients}
                  onChange={(e) => setManualRecipients(e.target.value)}
                  placeholder="Paste email addresses (separated by commas or newlines)...&#10;kaddambinee.yadav.cs27@iilm.edu&#10;lead@domain.com"
                  className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Drag & Drop File Upload / Attachment Box */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-4 border border-dashed rounded-xl transition-all text-center cursor-pointer ${
                  file
                    ? 'border-emerald-500/40 bg-emerald-950/20'
                    : 'border-slate-700 bg-slate-900/40 hover:bg-slate-800/40'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {file ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      <File className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-100 max-w-[200px] truncate">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {(file.size / 1024).toFixed(1)} KB · {file.name.endsWith('.csv') || file.name.endsWith('.txt') ? 'Leads Imported' : (shouldAttachFile ? 'Attached to Email' : 'File Uploaded')}
                    </span>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-rose-400 hover:bg-rose-950/50 border border-rose-500/30"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-slate-400 mb-1" />
                    <p className="text-xs font-medium text-slate-300">
                      Upload Leads CSV or Attachment
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Drag & drop or browse (.csv, .pdf, .txt, .png, etc.)</p>
                  </>
                )}
              </div>
            </div>

            {file && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="attachFileCheckbox"
                  checked={shouldAttachFile}
                  onChange={(e) => setShouldAttachFile(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                />
                <label htmlFor="attachFileCheckbox" className="text-xs text-slate-300 cursor-pointer flex items-center gap-1.5">
                  <Paperclip className="h-3 w-3 text-blue-400" />
                  <span>Attach <strong>"{file.name}"</strong> directly to each sent email</span>
                </label>
              </div>
            )}
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email HTML / Text Body</label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email body here (HTML formatting supported)..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans resize-none"
              required
            />
          </div>

          {/* Scheduling & Rate Limiting Controls */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-400" />
              Scheduling & Rate-Limiting Controls
            </h3>

            {/* Timing Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">When to start sending?</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleType('now')}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      scheduleType === 'now'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Send Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('later')}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      scheduleType === 'later'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Schedule for Later
                  </button>
                </div>
              </div>

              {scheduleType === 'later' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                    required={scheduleType === 'later'}
                  />
                </div>
              )}
            </div>

            {/* Delay & Rate-Limit Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                  <span>Delay Between Sends</span>
                  <span className="font-bold text-blue-400">{delaySeconds}s</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="1"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[10px] text-slate-500">Throttles individual email sends in worker</span>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-300 mb-1">
                  <span>Hourly Rate Limit</span>
                  <span className="font-bold text-indigo-400">{hourlyLimit} emails/hr</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-[10px] text-slate-500">Exceeding shifts remaining jobs to next hour</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || detectedEmailsCount === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Scheduling Queue...</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  <span>Schedule {detectedEmailsCount} Email{detectedEmailsCount !== 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

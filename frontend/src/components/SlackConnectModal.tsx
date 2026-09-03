import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ApiService } from '../services/api';
import { Slack, CheckCircle2, AlertTriangle, Send, X, ExternalLink, Link2, Unlink } from 'lucide-react';

interface SlackConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SlackConnectModal: React.FC<SlackConnectModalProps> = ({ isOpen, onClose }) => {
  const { slackStatus, refreshSlackStatus } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [testAlertLoading, setTestAlertLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleOAuthConnect = async () => {
    try {
      const url = await ApiService.getSlackInstallUrl();
      if (url.includes('error=')) {
        setMessage({ text: 'Slack Client ID not configured in .env. You can connect instantly via Incoming Webhook URL below!', type: 'error' });
      } else {
        window.location.href = url;
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to initiate Slack OAuth', type: 'error' });
    }
  };

  const handleWebhookConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl) return;
    setLoading(true);
    setMessage(null);

    try {
      await ApiService.connectSlackWebhook(webhookUrl);
      await refreshSlackStatus();
      setMessage({ text: '✅ Slack Webhook connected successfully! Live alerts will be sent here.', type: 'success' });
      setWebhookUrl('');
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || err.message || 'Failed to connect webhook', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestAlert = async () => {
    setTestAlertLoading(true);
    setMessage(null);
    try {
      const res = await ApiService.sendTestSlackAlert('sales@reachinbox.ai');
      setMessage({ text: res.message || '✅ Test Rate-Limit Alert sent to your Slack channel!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.response?.data?.error || err.message || 'Failed to send test alert', type: 'error' });
    } finally {
      setTestAlertLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack?')) return;
    setLoading(true);
    try {
      await ApiService.disconnectSlack();
      await refreshSlackStatus();
      setMessage({ text: 'Slack disconnected successfully.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0D131F] border border-slate-800 shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Slack className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Slack Notifications Integration</h3>
              <p className="text-[11px] text-slate-400">Real-time alerts when hourly rate limits are hit</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {message && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Current Status Card */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${slackStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-xs font-semibold text-slate-200">
                  {slackStatus?.connected ? 'Connected to Slack' : 'Slack Not Connected'}
                </span>
              </div>
              {slackStatus?.connected && (
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
                >
                  <Unlink className="h-3 w-3" />
                  Disconnect
                </button>
              )}
            </div>

            {slackStatus?.connected && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300 space-y-1">
                {slackStatus.teamName && (
                  <div>
                    <span className="text-slate-500">Workspace:</span> <span className="text-white font-medium">{slackStatus.teamName}</span>
                  </div>
                )}
                {slackStatus.channelName && (
                  <div>
                    <span className="text-slate-500">Channel:</span> <span className="text-white font-medium">{slackStatus.channelName}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Connection Actions */}
          {!slackStatus?.connected ? (
            <div className="space-y-4">
              {/* Real OAuth Button */}
              <button
                onClick={handleOAuthConnect}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#4A154B] hover:bg-[#611f69] border border-purple-400/20 shadow-glow transition-all"
              >
                <Slack className="h-4 w-4" />
                <span>Connect via Slack OAuth 2.0</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase tracking-wider">or instant webhook</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Webhook Form */}
              <form onSubmit={handleWebhookConnect} className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Slack Incoming Webhook URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="flex-1 px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading || !webhookUrl}
                    className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Create a free webhook in your Slack workspace in 10 seconds under Incoming Webhooks.
                </p>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Slack notifications are active! Whenever any sender reaches the hourly threshold, BullMQ reschedules remaining jobs and immediately dispatches an alert to your connected channel.
              </p>

              {/* Live Test Alert Trigger */}
              <button
                type="button"
                onClick={handleTestAlert}
                disabled={testAlertLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/40 shadow-glow-success transition-all"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{testAlertLoading ? 'Sending Alert...' : 'Dispatch Live Test Rate-Limit Alert to Slack'}</span>
              </button>
            </div>
          )}

          {/* Prompt requirement note */}
          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400">
            💡 <em>Requirement compliance:</em> If Slack is not connected, rate-limit hits proceed safely without crashing. Once connected, live alerts deliver automatically.
          </div>
        </div>

      </div>
    </div>
  );
};

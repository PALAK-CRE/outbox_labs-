import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { QueueHealthBar } from './components/QueueHealthBar';
import { ScheduledTable } from './components/ScheduledTable';
import { SentTable } from './components/SentTable';
import { ComposeModal } from './components/ComposeModal';
import { SlackConnectModal } from './components/SlackConnectModal';
import { RescheduleModal } from './components/RescheduleModal';
import { LoginModal } from './components/LoginModal';
import { SearchBar } from './components/SearchBar';
import { ApiService } from './services/api';
import { DashboardStats, EmailJob } from './types';
import { Clock, Send, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');

  // Data States
  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Modal States
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [rescheduleJob, setRescheduleJob] = useState<EmailJob | null>(null);

  // Fetch all dashboard data
  const fetchData = useCallback(async (showLoader = false) => {
    if (!user) return;
    if (showLoader) setIsRefreshing(true);

    try {
      if (searchQuery.trim()) {
        const searchRes = await ApiService.searchEmails(searchQuery);
        const searchHits = searchRes.data || [];
        setScheduledEmails(searchHits.filter((e) => ['SCHEDULED', 'QUEUED', 'SENDING', 'RESCHEDULED'].includes(e.status)));
        setSentEmails(searchHits.filter((e) => ['SENT', 'FAILED'].includes(e.status)));
      } else {
        const [schedRes, sentRes, statsRes] = await Promise.all([
          ApiService.getScheduledEmails(1, 50),
          ApiService.getSentEmails(1, 50),
          ApiService.getDashboardStats(),
        ]);
        setScheduledEmails(schedRes.data || []);
        setSentEmails(sentRes.data || []);
        setStats(statsRes);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoadingData(false);
      setIsRefreshing(false);
    }
  }, [user, searchQuery]);

  // Initial fetch and 4s polling interval for real-time queue visibility
  useEffect(() => {
    if (user) {
      fetchData(true);
      const interval = setInterval(() => {
        fetchData(false);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  // Trigger search when query changes
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchData(false);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery, fetchData]);

  // Handlers
  const handleCancel = async (id: string) => {
    try {
      await ApiService.cancelEmail(id);
      fetchData(false);
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  const handleOpenReschedule = (job: EmailJob) => {
    setRescheduleJob(job);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080B11]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Initializing ReachInbox Scheduler...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080B11] flex flex-col font-sans">
      
      {/* Login Modal for unauthenticated users */}
      {!user && <LoginModal />}

      {/* Top Navbar */}
      <Header
        onOpenCompose={() => setIsComposeOpen(true)}
        onOpenSlackModal={() => setIsSlackOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Real-time Stats Cards */}
        <StatsCards stats={stats} loading={loadingData} />

        {/* Hourly Rate Limit & Telemetry Bar */}
        <QueueHealthBar stats={stats} />

        {/* Controls Bar: Search & Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          
          {/* Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'scheduled'
                  ? 'bg-blue-600 text-white shadow-glow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Scheduled Emails</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'scheduled' ? 'bg-blue-700/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {scheduledEmails.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'sent'
                  ? 'bg-emerald-600 text-white shadow-glow-success'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Sent Emails</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'sent' ? 'bg-emerald-700/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {sentEmails.length}
              </span>
            </button>
          </div>

          {/* Search Bar + Refresh */}
          <div className="flex items-center gap-2">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery('')}
            />

            <button
              onClick={() => fetchData(true)}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>

        </div>

        {/* Tab Tables */}
        {activeTab === 'scheduled' ? (
          <ScheduledTable
            emails={scheduledEmails}
            loading={loadingData}
            onCancel={handleCancel}
            onReschedule={handleOpenReschedule}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        ) : (
          <SentTable
            emails={sentEmails}
            loading={loadingData}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0A0E17]/60 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ReachInbox Distributed Email Job Scheduler · BullMQ + Redis + PostgreSQL + Ethereal SMTP</span>
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Scheduler Engine Live
            </span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onScheduledSuccess={() => fetchData(false)}
      />

      <SlackConnectModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
      />

      <RescheduleModal
        job={rescheduleJob}
        isOpen={!!rescheduleJob}
        onClose={() => setRescheduleJob(null)}
        onSuccess={() => fetchData(false)}
      />

    </div>
  );
};
export default App;

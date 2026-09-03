import axios from 'axios';
import { DashboardStats, EmailJob, Sender, SlackStatus, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject Auth Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const ApiService = {
  // Auth
  async loginWithGoogle(credential: string): Promise<{ token: string; user: User }> {
    const res = await api.post('/auth/google', { credential });
    return res.data;
  },

  async loginWithDemo(name?: string, email?: string): Promise<{ token: string; user: User }> {
    const res = await api.post('/auth/demo', { name, email });
    return res.data;
  },

  async getCurrentUser(): Promise<{ user: User; slackConnected: boolean; slackTeam?: string; slackChannel?: string }> {
    const res = await api.get('/auth/me');
    return res.data;
  },

  // Emails
  async scheduleEmails(formData: FormData): Promise<any> {
    const res = await api.post('/emails/schedule', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async getScheduledEmails(page = 1, limit = 20): Promise<{ data: EmailJob[]; pagination: any }> {
    const res = await api.get(`/emails/scheduled?page=${page}&limit=${limit}`);
    return res.data;
  },

  async getSentEmails(page = 1, limit = 20): Promise<{ data: EmailJob[]; pagination: any }> {
    const res = await api.get(`/emails/sent?page=${page}&limit=${limit}`);
    return res.data;
  },

  async cancelEmail(id: string): Promise<EmailJob> {
    const res = await api.post(`/emails/${id}/cancel`);
    return res.data.data;
  },

  async rescheduleEmail(id: string, newScheduledAt: string): Promise<EmailJob> {
    const res = await api.post(`/emails/${id}/reschedule`, { newScheduledAt });
    return res.data.data;
  },

  async getSenders(): Promise<{ data: Sender[]; etherealAccount: any }> {
    const res = await api.get('/emails/senders');
    return res.data;
  },

  // Search
  async searchEmails(query: string, status?: string): Promise<{ data: EmailJob[]; total: number; source: string }> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (status) params.append('status', status);
    const res = await api.get(`/search?${params.toString()}`);
    return res.data;
  },

  // Stats
  async getDashboardStats(sender?: string): Promise<DashboardStats> {
    const res = await api.get(`/stats/dashboard${sender ? `?sender=${encodeURIComponent(sender)}` : ''}`);
    return res.data;
  },

  // Slack
  async getSlackInstallUrl(): Promise<string> {
    const res = await api.get('/slack/install');
    return res.data.url;
  },

  async getSlackStatus(): Promise<SlackStatus> {
    const res = await api.get('/slack/status');
    return res.data;
  },

  async sendTestSlackAlert(senderEmail?: string): Promise<any> {
    const res = await api.post('/slack/test-alert', { senderEmail });
    return res.data;
  },

  async connectSlackWebhook(webhookUrl: string, teamName?: string, channelName?: string): Promise<any> {
    const res = await api.post('/slack/connect-webhook', { webhookUrl, teamName, channelName });
    return res.data;
  },

  async disconnectSlack(): Promise<any> {
    const res = await api.post('/slack/disconnect');
    return res.data;
  },
};

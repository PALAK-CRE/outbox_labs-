export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export type JobStatus = 'SCHEDULED' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'RESCHEDULED' | 'CANCELLED';

export interface EmailJob {
  id: string;
  bullJobId?: string | null;
  userId: string;
  batchId?: string | null;
  senderId?: string | null;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: JobStatus;
  scheduledAt: string;
  sentAt?: string | null;
  attempts: number;
  maxAttempts: number;
  delayBetweenMs: number;
  hourlyLimit: number;
  etherealMessageUrl?: string | null;
  errorMessage?: string | null;
  lastWindowKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sender {
  email: string;
  name: string;
  isDefault: boolean;
  provider: string;
}

export interface DashboardStats {
  queue: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    total: number;
  };
  database: {
    total: number;
    sent: number;
    scheduled: number;
    failed: number;
  };
  system: {
    concurrency: number;
    minDelayMs: number;
    maxEmailsPerHour: number;
    elasticsearchOnline: boolean;
    redisConnected: boolean;
  };
  rateLimit: {
    sender: string;
    usedThisHour: number;
    limit: number;
    remainingThisHour: number;
    resetInMs: number;
    percentUsed: number;
  };
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
  channelName?: string;
  connectedAt?: string;
  configuredGlobalWebhook?: boolean;
}

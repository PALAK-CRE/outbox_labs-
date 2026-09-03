export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded content
  contentType?: string;
}

export interface EmailJobPayload {
  jobId: string;
  userId: string;
  batchId?: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  delayBetweenMs?: number;
  hourlyLimit?: number;
  scheduledAt: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface SlackWebhookMessage {
  text: string;
  blocks?: any[];
}

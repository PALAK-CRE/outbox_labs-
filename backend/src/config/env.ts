import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/reachinbox_scheduler?schema=public',
  
  REDIS_URL: process.env.REDIS_URL || '',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,

  ELASTICSEARCH_NODE: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  ELASTICSEARCH_INDEX: process.env.ELASTICSEARCH_INDEX || 'emails',

  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  MIN_EMAIL_DELAY_MS: parseInt(process.env.MIN_EMAIL_DELAY_MS || '2000', 10),
  MAX_EMAILS_PER_HOUR: parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10),
  MAX_EMAILS_PER_HOUR_PER_SENDER: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10),

  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-reachinbox-jwt-key-2025',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',

  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID || '',
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET || '',
  SLACK_REDIRECT_URI: process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/oauth_redirect',
  SLACK_TEST_WEBHOOK_URL: process.env.SLACK_TEST_WEBHOOK_URL || '',

  // SMTP Configuration (Real Gmail, Outlook, or Ethereal Fake SMTP)
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || process.env.ETHEREAL_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || process.env.ETHEREAL_PASS || '',
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'ReachInbox Outreach',

  ETHEREAL_USER: process.env.ETHEREAL_USER || '',
  ETHEREAL_PASS: process.env.ETHEREAL_PASS || '',
};

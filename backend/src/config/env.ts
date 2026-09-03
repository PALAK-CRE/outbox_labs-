import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const clean = (val?: string): string => (val ? val.replace(/^["']|["']$/g, '').trim() : '');

const PORT = parseInt(process.env.PORT || '5001', 10);

export const ENV = {
  PORT,
  NODE_ENV: clean(process.env.NODE_ENV) || 'development',
  FRONTEND_URL: clean(process.env.FRONTEND_URL) || 'http://localhost:5173',
  DATABASE_URL: clean(process.env.DATABASE_URL) || 'postgresql://postgres:postgres@localhost:5432/reachinbox_scheduler?schema=public',
  
  ENABLE_REDIS: process.env.ENABLE_REDIS !== undefined ? process.env.ENABLE_REDIS === 'true' : Boolean(clean(process.env.REDIS_URL)),
  REDIS_URL: clean(process.env.REDIS_URL),
  REDIS_HOST: clean(process.env.REDIS_HOST) || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: clean(process.env.REDIS_PASSWORD) || undefined,

  ELASTICSEARCH_NODE: clean(process.env.ELASTICSEARCH_NODE) || 'http://localhost:9200',
  ELASTICSEARCH_INDEX: clean(process.env.ELASTICSEARCH_INDEX) || 'emails',

  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  MIN_EMAIL_DELAY_MS: parseInt(process.env.MIN_EMAIL_DELAY_MS || '2000', 10),
  MAX_EMAILS_PER_HOUR: parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10),
  MAX_EMAILS_PER_HOUR_PER_SENDER: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10),

  JWT_SECRET: clean(process.env.JWT_SECRET) || 'super-secret-reachinbox-jwt-key-2025',

  GOOGLE_CLIENT_ID: clean(process.env.GOOGLE_CLIENT_ID) || '',
  GOOGLE_CLIENT_SECRET: clean(process.env.GOOGLE_CLIENT_SECRET) || '',

  SLACK_CLIENT_ID: clean(process.env.SLACK_CLIENT_ID) || '',
  SLACK_CLIENT_SECRET: clean(process.env.SLACK_CLIENT_SECRET) || '',
  SLACK_REDIRECT_URI: clean(process.env.SLACK_REDIRECT_URI) || `http://localhost:${PORT}/api/slack/oauth_redirect`,
  SLACK_TEST_WEBHOOK_URL: clean(process.env.SLACK_TEST_WEBHOOK_URL) || '',

  // SMTP Configuration (Real Gmail, Outlook, or Ethereal Fake SMTP)
  SMTP_HOST: clean(process.env.SMTP_HOST) || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: clean(process.env.SMTP_USER) || clean(process.env.ETHEREAL_USER) || '',
  SMTP_PASS: clean(process.env.SMTP_PASS) || clean(process.env.ETHEREAL_PASS) || '',
  SMTP_FROM_NAME: clean(process.env.SMTP_FROM_NAME) || 'ReachInbox Outreach',

  ETHEREAL_USER: clean(process.env.ETHEREAL_USER) || '',
  ETHEREAL_PASS: clean(process.env.ETHEREAL_PASS) || '',
};

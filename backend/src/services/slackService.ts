import { WebClient } from '@slack/web-api';
import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';

export function getSlackOAuthUrl(userId: string): string {
  const frontendUrl = (ENV.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  if (!ENV.SLACK_CLIENT_ID) {
    return `${frontendUrl}/?error=SLACK_CLIENT_ID_MISSING`;
  }
  const scopes = [
    'incoming-webhook',
    'chat:write',
    'chat:write.public',
    'channels:read',
  ].join(',');

  const params = new URLSearchParams({
    client_id: ENV.SLACK_CLIENT_ID,
    scope: scopes,
    redirect_uri: ENV.SLACK_REDIRECT_URI,
    state: userId,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCodeForToken(code: string, userId: string) {
  if (!ENV.SLACK_CLIENT_ID || !ENV.SLACK_CLIENT_SECRET) {
    throw new Error('Slack OAuth client credentials (SLACK_CLIENT_ID/SECRET) are not configured.');
  }

  const client = new WebClient();
  const response = await client.oauth.v2.access({
    client_id: ENV.SLACK_CLIENT_ID,
    client_secret: ENV.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: ENV.SLACK_REDIRECT_URI,
  });

  if (!response.ok) {
    throw new Error(`Slack OAuth error: ${response.error}`);
  }

  const accessToken = response.access_token as string;
  const teamId = response.team?.id;
  const teamName = response.team?.name;
  const incomingWebhook = (response as any).incoming_webhook;
  const webhookUrl = incomingWebhook?.url || null;
  const channelName = incomingWebhook?.channel || null;
  const channelId = incomingWebhook?.channel_id || null;
  const botUserId = response.bot_user_id || null;

  // Guarantee valid user foreign key
  let targetUserId = userId;
  const userExists = await prisma.user.findUnique({ where: { id: userId } });
  if (!userExists) {
    const firstUser = await prisma.user.findFirst();
    if (firstUser) {
      targetUserId = firstUser.id;
    } else {
      const created = await prisma.user.create({
        data: {
          id: userId,
          email: 'admin@reachinbox.ai',
          name: 'ReachInbox Admin',
        },
      });
      targetUserId = created.id;
    }
  }

  const slackIntegration = await prisma.slackIntegration.upsert({
    where: { userId: targetUserId },
    update: {
      accessToken,
      teamId,
      teamName,
      channelId,
      channelName,
      botUserId,
      webhookUrl,
      updatedAt: new Date(),
    },
    create: {
      userId: targetUserId,
      accessToken,
      teamId,
      teamName,
      channelId,
      channelName,
      botUserId,
      webhookUrl,
    },
  });

  return slackIntegration;
}

export async function sendSlackRateLimitAlert(options: {
  userId?: string;
  senderEmail: string;
  currentCount: number;
  hourlyLimit: number;
  windowKey: string;
  rescheduledUntil: string;
}) {
  try {
    let integration = null;
    if (options.userId) {
      integration = await prisma.slackIntegration.findUnique({
        where: { userId: options.userId },
      });
    }

    if (!integration && ENV.SLACK_TEST_WEBHOOK_URL) {
      // Fallback to global test webhook if configured
      await fetch(ENV.SLACK_TEST_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 *ReachInbox Rate Limit Reached!* Sender \`${options.senderEmail}\` hit the hourly threshold (${options.currentCount}/${options.hourlyLimit}). Email jobs are rescheduled until ${options.rescheduledUntil}.`,
        }),
      });
      return;
    }

    if (!integration) {
      console.log(`ℹ️ [Slack Alert] Rate limit reached for ${options.senderEmail}, but no Slack integration is connected for user. Skipping notification gracefully.`);
      return;
    }

    const alertMessage = {
      text: `🚨 *ReachInbox Rate Limit Alert* for sender \`${options.senderEmail}\``,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 Hourly Rate Limit Exceeded',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n${options.senderEmail}`,
            },
            {
              type: 'mrkdwn',
              text: `*Usage / Limit:*\n${options.currentCount} / ${options.hourlyLimit} emails/hr`,
            },
            {
              type: 'mrkdwn',
              text: `*Window Key:*\n\`${options.windowKey}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Rescheduled Window:*\n${options.rescheduledUntil}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '⚡ *Action:* All remaining pending emails for this sender have been automatically postponed into the next available hour window preserving FIFO queue order. No jobs were lost.',
            },
          ],
        },
      ],
    };

    if (integration.webhookUrl) {
      const resp = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertMessage),
      });
      if (!resp.ok) {
        console.warn(`⚠️ Slack webhook alert response status: ${resp.status}`);
      } else {
        console.log(`✅ [Slack Alert] Successfully sent live rate-limit alert via webhook to team '${integration.teamName}'!`);
      }
    } else if (integration.accessToken && integration.channelId) {
      const slackClient = new WebClient(integration.accessToken);
      await slackClient.chat.postMessage({
        channel: integration.channelId,
        text: alertMessage.text,
        blocks: alertMessage.blocks,
      });
      console.log(`✅ [Slack Alert] Successfully posted message via Slack API to channel '${integration.channelName}'!`);
    }
  } catch (error: any) {
    console.error('❌ Failed to dispatch Slack rate-limit alert:', error.message);
  }
}

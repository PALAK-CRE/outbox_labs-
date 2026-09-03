import { Request, Response } from 'express';
import { getSlackOAuthUrl, exchangeSlackCodeForToken, sendSlackRateLimitAlert } from '../services/slackService.js';
import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';

export class SlackController {
  /**
   * Redirect to Slack OAuth install flow
   */
  public static async install(req: Request, res: Response) {
    const userId = req.user?.id || 'demo-user-id-001';
    const oauthUrl = getSlackOAuthUrl(userId);
    return res.json({ success: true, url: oauthUrl });
  }

  /**
   * OAuth Redirect callback from Slack
   */
  public static async oauthRedirect(req: Request, res: Response) {
    const { code, state: userId, error } = req.query;

    if (error) {
      console.warn('⚠️ Slack OAuth error from Slack:', error);
      return res.redirect(`${ENV.FRONTEND_URL}/?slack_error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !userId) {
      return res.redirect(`${ENV.FRONTEND_URL}/?slack_error=missing_code_or_user`);
    }

    try {
      await exchangeSlackCodeForToken(code as string, userId as string);
      return res.redirect(`${ENV.FRONTEND_URL}/?slack_connected=true`);
    } catch (err: any) {
      console.error('❌ Failed to exchange Slack code:', err.message);
      return res.redirect(`${ENV.FRONTEND_URL}/?slack_error=${encodeURIComponent(err.message)}`);
    }
  }

  /**
   * Get Slack connection status for current user
   */
  public static async getStatus(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.json({ connected: false });
    }

    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      return res.json({ connected: false, configuredGlobalWebhook: !!ENV.SLACK_TEST_WEBHOOK_URL });
    }

    return res.json({
      connected: true,
      teamName: integration.teamName,
      channelName: integration.channelName,
      connectedAt: integration.createdAt,
    });
  }

  /**
   * Send a test rate-limit alert message to Slack (for live verification)
   */
  public static async testAlert(req: Request, res: Response) {
    const userId = req.user?.id;
    const { senderEmail = 'outreach@reachinbox.ai', count = 50, limit = 50 } = req.body;

    try {
      const now = new Date();
      const nextHour = new Date(now.getTime() + 3600000);

      await sendSlackRateLimitAlert({
        userId,
        senderEmail,
        currentCount: count,
        hourlyLimit: limit,
        windowKey: `ratelimit:${senderEmail}:test`,
        rescheduledUntil: nextHour.toISOString(),
      });

      return res.json({
        success: true,
        message: `Test rate-limit alert dispatched to Slack for ${senderEmail}!`,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Disconnect Slack integration
   */
  public static async disconnect(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    await prisma.slackIntegration.deleteMany({
      where: { userId },
    });

    return res.json({ success: true, message: 'Slack disconnected successfully' });
  }

  /**
   * Direct Webhook connect (optional convenience for manual webhook URL entry)
   */
  public static async connectWebhook(req: Request, res: Response) {
    const userId = req.user?.id || 'demo-user-id-001';
    const { webhookUrl, teamName = 'Custom Slack Workspace', channelName = '#alerts' } = req.body;

    if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
      return res.status(400).json({ success: false, error: 'Invalid Slack Incoming Webhook URL' });
    }

    const integration = await prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        webhookUrl,
        teamName,
        channelName,
        accessToken: 'webhook-only',
        updatedAt: new Date(),
      },
      create: {
        userId,
        webhookUrl,
        teamName,
        channelName,
        accessToken: 'webhook-only',
      },
    });

    return res.json({ success: true, message: 'Slack Webhook connected successfully!', data: integration });
  }
}

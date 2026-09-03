import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { EmailSchedulerQueue } from '../queue/emailQueue.js';
import { getDefaultTestAccount } from '../services/smtpService.js';
import { ENV } from '../config/env.js';
import { EmailAttachment } from '../types/index.js';

export class EmailController {
  /**
   * Schedule new emails (single or batch) with lead parsing & file attachments
   */
  public static async scheduleEmails(req: Request, res: Response) {
    try {
      const userId = req.user?.id || 'demo-user-id-001';
      let {
        subject,
        body,
        recipients,
        senderEmail,
        startTime,
        delayBetweenMs,
        hourlyLimit,
        campaignName,
        attachFile,
      } = req.body;

      if (!subject || !body) {
        return res.status(400).json({ success: false, error: 'Subject and Body are required.' });
      }

      // Format & sanitize recipients using robust email regex
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      let recipientList: string[] = [];

      if (Array.isArray(recipients)) {
        for (const item of recipients) {
          const matched = String(item).match(emailRegex);
          if (matched) recipientList.push(...matched);
        }
      } else if (typeof recipients === 'string') {
        const matched = recipients.match(emailRegex);
        if (matched) recipientList.push(...matched);
      }

      const attachments: EmailAttachment[] = [];

      // Check if file was uploaded (CSV, TXT, etc.)
      if (req.file) {
        const fileContent = req.file.buffer.toString('utf-8');
        // Extract all email addresses regardless of CSV columns/delimiters
        const fileEmails = fileContent.match(emailRegex) || [];
        recipientList.push(...fileEmails);

        // Also add as attachment if requested (or default true if uploaded)
        if (attachFile !== 'false') {
          attachments.push({
            filename: req.file.originalname,
            content: req.file.buffer.toString('base64'),
            contentType: req.file.mimetype || 'application/octet-stream',
          });
          console.log(`📎 Attached file '${req.file.originalname}' (${(req.file.size / 1024).toFixed(1)} KB) to email campaign`);
        }
      }

      // De-duplicate recipient emails (case-insensitive)
      recipientList = Array.from(new Set(recipientList.map((e) => e.toLowerCase().trim())));

      if (recipientList.length === 0) {
        return res.status(400).json({ success: false, error: 'No valid recipient email addresses provided.' });
      }

      // Ensure sender email
      if (!senderEmail || !senderEmail.trim()) {
        const account = await getDefaultTestAccount();
        senderEmail = account.user;
      }

      // Parse dates and config
      const scheduledStartTime = startTime ? new Date(startTime) : new Date();
      const delayMs = parseInt(delayBetweenMs || '2000', 10);
      const limit = parseInt(hourlyLimit || `${ENV.MAX_EMAILS_PER_HOUR_PER_SENDER}`, 10);

      const result = await EmailSchedulerQueue.scheduleBatchCampaign({
        userId,
        name: campaignName || `Campaign - ${subject.substring(0, 30)}`,
        senderEmail: senderEmail.trim(),
        recipients: recipientList,
        subject,
        body,
        attachments: attachments.length > 0 ? attachments : undefined,
        startTime: scheduledStartTime,
        delayBetweenMs: delayMs,
        hourlyLimit: limit,
      });

      return res.status(201).json({
        success: true,
        message: `Successfully scheduled ${result.totalScheduled} emails (with ${attachments.length} attachment(s)).`,
        data: result,
      });
    } catch (error: any) {
      console.error('❌ Error scheduling emails:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get scheduled emails list
   */
  public static async getScheduledEmails(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const skip = (page - 1) * limit;

      const where: any = {
        status: { in: ['SCHEDULED', 'QUEUED', 'SENDING', 'RESCHEDULED'] },
      };

      if (userId) {
        where.userId = userId;
      }

      const [total, emails] = await Promise.all([
        prisma.emailJob.count({ where }),
        prisma.emailJob.findMany({
          where,
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: limit,
        }),
      ]);

      return res.json({
        success: true,
        data: emails,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error('❌ Error fetching scheduled emails:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get sent emails list
   */
  public static async getSentEmails(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const skip = (page - 1) * limit;

      const where: any = {
        status: { in: ['SENT', 'FAILED'] },
      };

      if (userId) {
        where.userId = userId;
      }

      const [total, emails] = await Promise.all([
        prisma.emailJob.count({ where }),
        prisma.emailJob.findMany({
          where,
          orderBy: { sentAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      return res.json({
        success: true,
        data: emails,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error('❌ Error fetching sent emails:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Cancel a scheduled email
   */
  public static async cancelEmail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const cancelled = await EmailSchedulerQueue.cancelJob(id);

      return res.json({
        success: true,
        message: 'Email job cancelled successfully',
        data: cancelled,
      });
    } catch (error: any) {
      console.error('❌ Error cancelling email:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Reschedule an email job
   */
  public static async rescheduleEmail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { newScheduledAt } = req.body;

      if (!newScheduledAt) {
        return res.status(400).json({ success: false, error: 'newScheduledAt is required' });
      }

      const rescheduled = await EmailSchedulerQueue.rescheduleJob(id, new Date(newScheduledAt));

      return res.json({
        success: true,
        message: 'Email job rescheduled successfully',
        data: rescheduled,
      });
    } catch (error: any) {
      console.error('❌ Error rescheduling email:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get available senders (Ethereal test accounts or real Gmail)
   */
  public static async getSenders(req: Request, res: Response) {
    try {
      const defaultAccount = await getDefaultTestAccount();

      const defaultSender = {
        email: defaultAccount.user,
        name: ENV.SMTP_FROM_NAME || 'ReachInbox Outreach Team',
        isDefault: true,
        provider: ENV.SMTP_USER ? 'Gmail SMTP' : 'Ethereal SMTP',
      };

      const customSenders = [
        defaultSender,
        {
          email: 'sales@reachinbox.ai',
          name: 'ReachInbox Sales Team',
          isDefault: false,
          provider: 'Relay',
        },
        {
          email: 'founder@reachinbox.ai',
          name: 'Growth & Partnerships',
          isDefault: false,
          provider: 'Relay',
        },
      ];

      return res.json({
        success: true,
        data: customSenders,
        etherealAccount: {
          user: defaultAccount.user,
          pass: defaultAccount.pass,
          webUrl: 'https://ethereal.email/messages',
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

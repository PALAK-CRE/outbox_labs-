import nodemailer, { Transporter } from 'nodemailer';
import { ENV } from '../config/env.js';
import { EmailAttachment } from '../types/index.js';

const senderTransporterCache = new Map<string, Transporter>();
let defaultTestAccount: nodemailer.TestAccount | null = null;

export function isRealSMTPConfigured(): boolean {
  return !!(ENV.SMTP_USER && ENV.SMTP_PASS);
}

export async function getDefaultTestAccount(): Promise<nodemailer.TestAccount> {
  if (isRealSMTPConfigured()) {
    return {
      user: ENV.SMTP_USER,
      pass: ENV.SMTP_PASS,
      smtp: {
        host: ENV.SMTP_HOST || (ENV.SMTP_USER.includes('@gmail.com') ? 'smtp.gmail.com' : 'smtp.ethereal.email'),
        port: ENV.SMTP_PORT || 587,
        secure: ENV.SMTP_SECURE || false,
      },
      imap: { host: '', port: 993, secure: true },
      pop3: { host: '', port: 995, secure: true },
      web: '',
    };
  }

  if (!defaultTestAccount) {
    if (ENV.ETHEREAL_USER && ENV.ETHEREAL_PASS) {
      defaultTestAccount = {
        user: ENV.ETHEREAL_USER,
        pass: ENV.ETHEREAL_PASS,
        smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
        imap: { host: 'imap.ethereal.email', port: 993, secure: true },
        pop3: { host: 'pop3.ethereal.email', port: 995, secure: true },
        web: 'https://ethereal.email',
      };
    } else {
      console.log('🔄 Creating new Ethereal Email test account...');
      defaultTestAccount = await nodemailer.createTestAccount();
      console.log(`✅ Ethereal Test Account created: ${defaultTestAccount.user}`);
    }
  }
  return defaultTestAccount;
}

export async function getTransporterForSender(senderEmail?: string): Promise<{ transporter: Transporter; senderAddress: string }> {
  // If real SMTP credentials are provided
  if (isRealSMTPConfigured()) {
    const address = ENV.SMTP_USER;
    if (senderTransporterCache.has(address)) {
      return { transporter: senderTransporterCache.get(address)!, senderAddress: address };
    }

    const host = ENV.SMTP_HOST || (address.includes('@gmail.com') ? 'smtp.gmail.com' : 'smtp.ethereal.email');
    const port = ENV.SMTP_PORT || 587;
    const secure = port === 465 || ENV.SMTP_SECURE;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
    });

    senderTransporterCache.set(address, transporter);
    console.log(`📡 [Real SMTP] Initialized real transporter via ${host}:${port} as ${address}`);
    return { transporter, senderAddress: address };
  }

  // Otherwise, use Ethereal Fake SMTP
  const account = await getDefaultTestAccount();
  const address = senderEmail && senderEmail.trim() ? senderEmail.trim() : account.user;

  if (senderTransporterCache.has(address)) {
    return { transporter: senderTransporterCache.get(address)!, senderAddress: address };
  }

  const transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });

  senderTransporterCache.set(address, transporter);
  return { transporter, senderAddress: address };
}

export async function sendEmailViaEthereal(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}): Promise<{ messageId: string; previewUrl: string | false }> {
  const { transporter, senderAddress } = await getTransporterForSender(options.from);

  const fromName = ENV.SMTP_FROM_NAME || options.from.split('@')[0];
  const fromHeader = `"${fromName}" <${senderAddress}>`;

  // Format attachments for Nodemailer
  const mailAttachments = options.attachments?.map((att) => ({
    filename: att.filename,
    content: Buffer.from(att.content, 'base64'),
    contentType: att.contentType,
  })) || [];

  const info = await transporter.sendMail({
    from: fromHeader,
    to: options.to,
    subject: options.subject,
    text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
    html: options.html,
    attachments: mailAttachments,
  });

  // If using Ethereal, retrieve the test preview link
  const previewUrl = nodemailer.getTestMessageUrl(info);
  
  if (isRealSMTPConfigured()) {
    console.log(`📬 [REAL SMTP DELIVERED] Email actually delivered to recipient ${options.to} (with ${mailAttachments.length} attachment(s))! Message ID: ${info.messageId}`);
  } else {
    console.log(`📧 [Ethereal Fake SMTP] Email sent to ${options.to}. Preview URL: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || false,
  };
}

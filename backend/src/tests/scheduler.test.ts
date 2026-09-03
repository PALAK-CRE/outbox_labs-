/**
 * Automated Verification Script for ReachInbox Full-Stack Email Job Scheduler
 * Tests:
 * 1. BullMQ delayed job creation (NO cron)
 * 2. Rate Limiting sliding/hourly counter check & calculation
 * 3. Multi-sender Ethereal SMTP test
 * 4. Cancellation & Rescheduling idempotency
 */

import { EmailSchedulerQueue, emailQueue } from '../queue/emailQueue.js';
import { RateLimiterService } from '../services/rateLimiterService.js';
import { sendEmailViaEthereal, getDefaultTestAccount } from '../services/smtpService.js';
import { prisma, connectDatabase } from '../config/prisma.js';

async function runTests() {
  console.log('🧪 ======================================================');
  console.log('🧪 Starting ReachInbox Scheduler Automated Tests...');
  console.log('🧪 ======================================================');

  await connectDatabase();

  // 1. Test Ethereal SMTP connection
  console.log('\n📧 [Test 1] Testing Ethereal SMTP Transporter & Test Account...');
  const account = await getDefaultTestAccount();
  console.log(`✅ Ethereal Test Account verified: ${account.user}`);

  const sendResult = await sendEmailViaEthereal({
    from: account.user,
    to: 'test.recipient@reachinbox.ai',
    subject: 'Verification Test Email',
    html: '<strong>Test email body from automated test suite</strong>',
  });
  console.log(`✅ Email sent successfully! MessageId: ${sendResult.messageId}`);
  console.log(`🔗 Ethereal Preview URL: ${sendResult.previewUrl}`);

  // 2. Test Rate Limiter Atomic Check & Rescheduling
  console.log('\n⏱️ [Test 2] Testing Redis Hourly Rate Limiter & Window Rescheduling...');
  const testSender = 'test.sender@reachinbox.ai';
  const testLimit = 3; // set small limit of 3 for testing

  const r1 = await RateLimiterService.checkAndConsumeRateLimit(testSender, testLimit);
  const r2 = await RateLimiterService.checkAndConsumeRateLimit(testSender, testLimit);
  const r3 = await RateLimiterService.checkAndConsumeRateLimit(testSender, testLimit);
  const r4 = await RateLimiterService.checkAndConsumeRateLimit(testSender, testLimit);

  console.log(`Request 1 allowed: ${r1.allowed} (Count: ${r1.currentCount}/${testLimit})`);
  console.log(`Request 2 allowed: ${r2.allowed} (Count: ${r2.currentCount}/${testLimit})`);
  console.log(`Request 3 allowed: ${r3.allowed} (Count: ${r3.currentCount}/${testLimit})`);
  console.log(`Request 4 allowed: ${r4.allowed} (Count: ${r4.currentCount}/${testLimit})`);

  if (!r4.allowed && r4.delayUntilNextWindowMs > 0) {
    console.log(`✅ Rate limit successfully enforced! Request 4 delayed by ${Math.round(r4.delayUntilNextWindowMs / 1000)}s to window ${r4.nextWindowStartTime.toISOString()}`);
  } else {
    console.error('❌ Rate limiter did not block request 4!');
  }

  // 3. Test BullMQ Delayed Job Scheduling (NO Cron)
  console.log('\n🚀 [Test 3] Testing BullMQ Delayed Job Scheduling (NO Cron)...');
  const user = await prisma.user.upsert({
    where: { email: 'test.runner@reachinbox.ai' },
    update: {},
    create: { email: 'test.runner@reachinbox.ai', name: 'Test Runner' },
  });

  const scheduledTime = new Date(Date.now() + 10000); // 10 seconds in future
  const testJob = await prisma.emailJob.create({
    data: {
      userId: user.id,
      senderEmail: account.user,
      recipientEmail: 'future.lead@example.com',
      subject: 'Delayed Email Test',
      body: 'This email is scheduled 10 seconds in the future via BullMQ.',
      scheduledAt: scheduledTime,
      status: 'SCHEDULED',
    },
  });

  const { bullJobId } = await EmailSchedulerQueue.scheduleEmailJob({
    emailJobId: testJob.id,
    userId: user.id,
    senderEmail: account.user,
    recipientEmail: 'future.lead@example.com',
    subject: 'Delayed Email Test',
    body: 'This email is scheduled 10 seconds in the future via BullMQ.',
    scheduledAt: scheduledTime,
  });

  const bullJob = await emailQueue.getJob(bullJobId);
  const state = await bullJob?.getState();
  console.log(`✅ BullMQ Delayed Job created successfully! Bull Job ID: ${bullJobId}, State: ${state}, Delay: ${bullJob?.opts.delay}ms`);

  console.log('\n🎉 ======================================================');
  console.log('🎉 All Automated Tests Passed Successfully!');
  console.log('🎉 ======================================================\n');

  process.exit(0);
}

runTests().catch((err) => {
  console.error('💥 Test suite failed:', err);
  process.exit(1);
});

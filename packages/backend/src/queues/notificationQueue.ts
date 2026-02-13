import Queue from 'bull';
import { logger } from '../utils/logger.js';
import { sendEmail } from '../services/emailService.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const notificationQueue = new Queue('notifications', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Process email jobs
notificationQueue.process('email', async (job) => {
  const { to, subject, html, text } = job.data as EmailJob;

  try {
    logger.info(`Sending email to ${to}: ${subject}`);
    await sendEmail({ to, subject, html, text });
    logger.info(`Email sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
});

// Queue events
notificationQueue.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`);
});

notificationQueue.on('failed', (job, error) => {
  logger.error(`Job ${job?.id} failed:`, error);
});

export async function queueEmail(data: EmailJob): Promise<void> {
  try {
    await notificationQueue.add('email', data, {
      priority: 1,
    });
    logger.info(`Email queued for ${data.to}`);
  } catch (error) {
    logger.error('Failed to queue email:', error);
    throw error;
  }
}

export async function queueBudgetAlert(
  userEmail: string,
  projectName: string,
  percentageUsed: number,
  remaining: number
): Promise<void> {
  const subject = `Budget Alert: ${projectName}`;
  const html = `
    <h2>Budget Alert for ${projectName}</h2>
    <p>Your project budget is at <strong>${percentageUsed.toFixed(1)}%</strong> usage.</p>
    <p>Remaining budget: <strong>$${remaining.toLocaleString()}</strong></p>
    <p>Please review your project costs and take appropriate action.</p>
    <p><a href="${process.env.FRONTEND_URL}/projects">View Project</a></p>
  `;

  await queueEmail({
    to: userEmail,
    subject,
    html,
    text: `Budget Alert for ${projectName}: ${percentageUsed.toFixed(1)}% used, $${remaining.toLocaleString()} remaining`,
  });
}

export async function queueTaskReminder(
  userEmail: string,
  taskTitle: string,
  projectName: string,
  dueDate: Date
): Promise<void> {
  const subject = `Task Reminder: ${taskTitle}`;
  const html = `
    <h2>Task Reminder</h2>
    <p>Your task <strong>${taskTitle}</strong> in project <strong>${projectName}</strong> is due on ${dueDate.toLocaleDateString()}.</p>
    <p><a href="${process.env.FRONTEND_URL}/projects">View Task</a></p>
  `;

  await queueEmail({
    to: userEmail,
    subject,
    html,
    text: `Task Reminder: ${taskTitle} in ${projectName} is due on ${dueDate.toLocaleDateString()}`,
  });
}

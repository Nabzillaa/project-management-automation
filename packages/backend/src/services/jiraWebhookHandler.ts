import crypto from 'crypto';
import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { mapJiraStatus, mapJiraPriority } from './jiraIntegration.js';

export interface JiraWebhookPayload {
  webhookEvent: string;
  issue: {
    key: string;
    fields: {
      summary: string;
      description?: string;
      status: { name: string };
      priority?: { name: string };
      duedate?: string;
    };
  };
}

export class JiraWebhookHandler {
  private webhookSecret: string;

  constructor(webhookSecret: string = process.env.JIRA_WEBHOOK_SECRET || '') {
    this.webhookSecret = webhookSecret;
  }

  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.warn('JIRA webhook secret not configured');
      return false;
    }

    const hash = crypto.createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
    const expected = `sha256=${hash}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  async handleWebhook(payload: JiraWebhookPayload): Promise<void> {
    const { webhookEvent, issue } = payload;

    try {
      switch (webhookEvent) {
        case 'jira:issue_updated':
          await this.handleIssueUpdated(issue);
          break;
        case 'jira:issue_created':
          logger.info(`JIRA issue created: ${issue.key}`);
          break;
        case 'jira:issue_deleted':
          await this.handleIssueDeleted(issue);
          break;
        default:
          logger.debug(`Unhandled webhook event: ${webhookEvent}`);
      }
    } catch (error: any) {
      logger.error(`Failed to handle webhook for ${issue.key}:`, error.message);
      throw error;
    }
  }

  private async handleIssueUpdated(issue: JiraWebhookPayload['issue']): Promise<void> {
    const task = await prisma.task.findFirst({
      where: { jiraIssueKey: issue.key },
    });

    if (!task) {
      logger.debug(`No task found for JIRA issue ${issue.key}`);
      return;
    }

    const status = mapJiraStatus(issue.fields.status.name);
    const priority = mapJiraPriority(issue.fields.priority?.name || 'Medium');

    await prisma.task.update({
      where: { id: task.id },
      data: {
        title: issue.fields.summary,
        description: issue.fields.description || task.description,
        status,
        priority,
        endDate: issue.fields.duedate ? new Date(issue.fields.duedate) : task.endDate,
        updatedAt: new Date(),
      },
    });

    logger.info(`Updated task ${task.id} from JIRA webhook for issue ${issue.key}`);
  }

  private async handleIssueDeleted(issue: JiraWebhookPayload['issue']): Promise<void> {
    const task = await prisma.task.findFirst({
      where: { jiraIssueKey: issue.key },
    });

    if (!task) return;

    // Clear JIRA link instead of deleting task
    await prisma.task.update({
      where: { id: task.id },
      data: {
        jiraIssueKey: null,
        jiraIssueId: null,
      },
    });

    logger.info(`Removed JIRA link from task ${task.id}`);
  }
}

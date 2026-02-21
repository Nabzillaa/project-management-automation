import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { JiraService, mapJiraStatus, mapJiraPriority, reverseMapStatus, reverseMapPriority } from './jiraIntegration.js';
import type { JiraCredentials } from './jiraIntegration.js';

export interface SyncResult {
  status: 'success' | 'partial' | 'failed';
  itemsSynced: number;
  errors: string[];
}

export class JiraSyncService {
  async syncProject(projectId: string, organizationId: string, credentials: JiraCredentials): Promise<SyncResult> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { tasks: true },
      });

      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      const jiraService = new JiraService(credentials);
      const errors: string[] = [];
      let syncedCount = 0;

      // Sync each task
      for (const task of project.tasks) {
        try {
          await this.syncTask(task.id, jiraService);
          syncedCount++;
        } catch (error: any) {
          errors.push(`Task ${task.id}: ${error.message}`);
          logger.error(`Failed to sync task ${task.id}:`, error);
        }
      }

      // Update sync configuration
      await prisma.syncConfiguration.upsert({
        where: {
          organizationId_integrationType: {
            organizationId,
            integrationType: 'jira',
          },
        },
        create: {
          organizationId,
          integrationType: 'jira',
          lastSyncAt: new Date(),
        },
        update: {
          lastSyncAt: new Date(),
        },
      });

      // Log sync history
      await prisma.syncHistory.create({
        data: {
          organizationId,
          integrationType: 'jira',
          syncType: 'bidirectional',
          status: errors.length === 0 ? 'success' : errors.length < project.tasks.length ? 'partial' : 'failed',
          itemsSynced: syncedCount,
          errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
        },
      });

      return {
        status: errors.length === 0 ? 'success' : errors.length < project.tasks.length ? 'partial' : 'failed',
        itemsSynced: syncedCount,
        errors,
      };
    } catch (error: any) {
      logger.error(`Failed to sync project ${projectId}:`, error);
      throw error;
    }
  }

  private async syncTask(taskId: string, jiraService: JiraService): Promise<void> {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || !task.jiraIssueKey) return;

    try {
      const jiraIssue = await jiraService.getIssue(task.jiraIssueKey);

      // Map and update task from JIRA (JIRA wins on conflicts)
      const newStatus = mapJiraStatus(jiraIssue.fields.status.name);
      const newPriority = mapJiraPriority(jiraIssue.fields.priority?.name || 'Medium');

      await prisma.task.update({
        where: { id: taskId },
        data: {
          title: jiraIssue.fields.summary,
          description: jiraIssue.fields.description || task.description,
          status: newStatus,
          priority: newPriority,
          endDate: jiraIssue.fields.duedate ? new Date(jiraIssue.fields.duedate) : task.endDate,
        },
      });

      logger.info(`Synced task ${taskId} from JIRA issue ${task.jiraIssueKey}`);
    } catch (error: any) {
      logger.error(`Failed to sync task ${taskId}:`, error.message);
      throw error;
    }
  }

  async getSyncHistory(organizationId: string, limit: number = 10): Promise<any[]> {
    return prisma.syncHistory.findMany({
      where: { organizationId, integrationType: 'jira' },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }
}

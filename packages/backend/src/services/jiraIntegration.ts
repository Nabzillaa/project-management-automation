import axios, { AxiosInstance } from 'axios';
import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';

export interface JiraCredentials {
  domain: string; // e.g., "yourcompany.atlassian.net"
  email: string;
  apiToken: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      name: string;
    };
    priority?: {
      name: string;
    };
    assignee?: {
      displayName: string;
      emailAddress: string;
    };
    created: string;
    updated: string;
    duedate?: string;
    project: {
      id: string;
      key: string;
      name: string;
    };
    issuetype: {
      name: string;
    };
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
}

export interface CreateIssueData {
  projectKey: string;
  summary: string;
  description?: string;
  issueType: string; // 'Task', 'Bug', 'Story', 'Epic'
  priority?: string; // 'Lowest', 'Low', 'Medium', 'High', 'Highest'
  dueDate?: string; // ISO 8601 format
}

export interface UpdateIssueData {
  summary?: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  statusTransitionId?: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    name: string;
  };
}

export class JiraService {
  private client: AxiosInstance;
  private credentials: JiraCredentials;

  constructor(credentials: JiraCredentials) {
    this.credentials = credentials;
    this.client = axios.create({
      baseURL: `https://${credentials.domain}/rest/api/3`,
      auth: {
        username: credentials.email,
        password: credentials.apiToken,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Test connection to JIRA
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/myself');
      return true;
    } catch (error: any) {
      logger.error('JIRA connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get all accessible projects
   */
  async getProjects(): Promise<JiraProject[]> {
    try {
      const response = await this.client.get('/project');
      return response.data;
    } catch (error: any) {
      logger.error('Failed to fetch JIRA projects:', error.message);
      throw new Error('Failed to fetch JIRA projects');
    }
  }

  /**
   * Get issues for a specific project
   */
  async getProjectIssues(projectKey: string): Promise<JiraIssue[]> {
    try {
      const response = await this.client.get('/search', {
        params: {
          jql: `project = ${projectKey} ORDER BY created DESC`,
          maxResults: 100,
          fields: 'summary,description,status,priority,assignee,created,updated,duedate,project,issuetype',
        },
      });
      return response.data.issues;
    } catch (error: any) {
      logger.error(`Failed to fetch issues for project ${projectKey}:`, error.message);
      throw new Error(`Failed to fetch JIRA issues for project ${projectKey}`);
    }
  }

  /**
   * Get a specific issue by key
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      const response = await this.client.get(`/issue/${issueKey}`);
      return response.data;
    } catch (error: any) {
      logger.error(`Failed to fetch JIRA issue ${issueKey}:`, error.message);
      throw new Error(`Failed to fetch JIRA issue ${issueKey}`);
    }
  }

  /**
   * Create a new issue in JIRA
   */
  async createIssue(data: CreateIssueData): Promise<{ id: string; key: string }> {
    try {
      const payload = {
        fields: {
          project: {
            key: data.projectKey,
          },
          summary: data.summary,
          description: data.description || '',
          issuetype: {
            name: data.issueType,
          },
          ...(data.priority && { priority: { name: data.priority } }),
          ...(data.dueDate && { duedate: data.dueDate }),
        },
      };

      const response = await this.client.post('/issue', payload);
      logger.info(`Created JIRA issue: ${response.data.key}`);

      return {
        id: response.data.id,
        key: response.data.key,
      };
    } catch (error: any) {
      logger.error('Failed to create JIRA issue:', error.response?.data || error.message);
      throw new Error(
        `Failed to create JIRA issue: ${error.response?.data?.errors?.summary?.[0] || error.message}`
      );
    }
  }

  /**
   * Update an existing issue in JIRA
   */
  async updateIssue(issueKey: string, data: UpdateIssueData): Promise<void> {
    try {
      const updatePayload: any = {
        fields: {},
      };

      if (data.summary) updatePayload.fields.summary = data.summary;
      if (data.description) updatePayload.fields.description = data.description;
      if (data.priority) updatePayload.fields.priority = { name: data.priority };
      if (data.dueDate) updatePayload.fields.duedate = data.dueDate;

      await this.client.put(`/issue/${issueKey}`, updatePayload);
      logger.info(`Updated JIRA issue: ${issueKey}`);
    } catch (error: any) {
      logger.error(`Failed to update JIRA issue ${issueKey}:`, error.response?.data || error.message);
      throw new Error(`Failed to update JIRA issue ${issueKey}`);
    }
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    try {
      const response = await this.client.get(`/issue/${issueKey}/transitions`);
      return response.data.transitions || [];
    } catch (error: any) {
      logger.error(`Failed to fetch transitions for issue ${issueKey}:`, error.message);
      throw new Error(`Failed to fetch transitions for issue ${issueKey}`);
    }
  }

  /**
   * Transition an issue to a new status
   */
  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    try {
      await this.client.post(`/issue/${issueKey}/transitions`, {
        transition: {
          id: transitionId,
        },
      });
      logger.info(`Transitioned JIRA issue ${issueKey} with transition ${transitionId}`);
    } catch (error: any) {
      logger.error(
        `Failed to transition JIRA issue ${issueKey}:`,
        error.response?.data || error.message
      );
      throw new Error(`Failed to transition JIRA issue ${issueKey}`);
    }
  }
}

/**
 * Import JIRA project and its issues into the system
 */
export async function importJiraProject(
  jiraProjectKey: string,
  organizationId: string,
  userId: string,
  credentials: JiraCredentials
): Promise<{ projectId: string; tasksImported: number }> {
  const jiraService = new JiraService(credentials);

  try {
    // Fetch JIRA project details
    const jiraProjects = await jiraService.getProjects();
    const jiraProject = jiraProjects.find((p) => p.key === jiraProjectKey);

    if (!jiraProject) {
      throw new Error(`JIRA project ${jiraProjectKey} not found`);
    }

    // Fetch all issues for the project
    const jiraIssues = await jiraService.getProjectIssues(jiraProjectKey);

    logger.info(`Importing JIRA project ${jiraProjectKey} with ${jiraIssues.length} issues`);

    // Create or update project in our system
    let project = await prisma.project.findFirst({
      where: {
        jiraProjectKey: jiraProjectKey,
      },
    });

    if (project) {
      // Update existing project
      project = await prisma.project.update({
        where: { id: project.id },
        data: {
          name: jiraProject.name,
          description: jiraProject.description || `Imported from JIRA project ${jiraProjectKey}`,
        },
      });
    } else {
      // Create new project
      project = await prisma.project.create({
        data: {
          organizationId,
          name: jiraProject.name,
          description: jiraProject.description || `Imported from JIRA project ${jiraProjectKey}`,
          jiraProjectKey: jiraProjectKey,
          status: 'active',
          createdBy: userId,
        },
      });
    }

    // Map JIRA users to our users (for now, assign to the importing user)
    // In a real implementation, you'd want to map JIRA users to your system users

    // Import issues as tasks
    let tasksImported = 0;
    for (const issue of jiraIssues) {
      try {
        // Map JIRA status to our status
        const status = mapJiraStatus(issue.fields.status.name);
        const priority = mapJiraPriority(issue.fields.priority?.name || 'Medium');
        const taskType = mapJiraIssueType(issue.fields.issuetype.name);

        let task = await prisma.task.findFirst({
          where: {
            jiraIssueKey: issue.key,
          },
        });

        if (task) {
          // Update existing task
          await prisma.task.update({
            where: { id: task.id },
            data: {
              title: issue.fields.summary,
              description: issue.fields.description || '',
              status,
              priority,
              taskType,
            },
          });
        } else {
          // Create new task
          await prisma.task.create({
            data: {
              projectId: project.id,
              jiraIssueKey: issue.key,
              title: issue.fields.summary,
              description: issue.fields.description || '',
              status,
              priority,
              taskType,
              assignedTo: userId, // Default to importing user
              createdBy: userId,
              startDate: new Date(issue.fields.created),
              endDate: issue.fields.duedate ? new Date(issue.fields.duedate) : undefined,
            },
          });
        }

        tasksImported++;
      } catch (error: any) {
        logger.error(`Failed to import issue ${issue.key}:`, error.message);
      }
    }

    logger.info(`Successfully imported ${tasksImported} tasks from JIRA project ${jiraProjectKey}`);

    return {
      projectId: project.id,
      tasksImported,
    };
  } catch (error: any) {
    logger.error('JIRA import failed:', error);
    throw error;
  }
}

/**
 * Map JIRA status to our status
 */
export function mapJiraStatus(jiraStatus: string): string {
  const statusLower = jiraStatus.toLowerCase();
  if (statusLower.includes('done') || statusLower.includes('closed')) {
    return 'completed';
  }
  if (statusLower.includes('progress') || statusLower.includes('development')) {
    return 'in_progress';
  }
  if (statusLower.includes('review') || statusLower.includes('testing')) {
    return 'in_review';
  }
  return 'todo';
}

/**
 * Map JIRA priority to our priority
 */
export function mapJiraPriority(jiraPriority: string): string {
  const priorityLower = jiraPriority.toLowerCase();
  if (priorityLower.includes('high') || priorityLower.includes('critical') || priorityLower.includes('blocker')) {
    return 'high';
  }
  if (priorityLower.includes('low') || priorityLower.includes('trivial')) {
    return 'low';
  }
  return 'medium';
}

/**
 * Map JIRA issue type to our task type
 */
function mapJiraIssueType(issueType: string): string {
  const typeLower = issueType.toLowerCase();
  if (typeLower.includes('bug')) {
    return 'bug';
  }
  if (typeLower.includes('epic') || typeLower.includes('milestone')) {
    return 'milestone';
  }
  return 'task';
}

/**
 * Map our status to JIRA status (reverse mapping)
 */
export function reverseMapStatus(ourStatus: string): string {
  const statusLower = ourStatus.toLowerCase();
  if (statusLower === 'completed') {
    return 'Done';
  }
  if (statusLower === 'in_progress') {
    return 'In Progress';
  }
  if (statusLower === 'in_review') {
    return 'In Review';
  }
  return 'To Do';
}

/**
 * Map our priority to JIRA priority (reverse mapping)
 */
export function reverseMapPriority(ourPriority: string): string {
  const priorityLower = ourPriority.toLowerCase();
  if (priorityLower === 'high' || priorityLower === 'critical') {
    return 'High';
  }
  if (priorityLower === 'low') {
    return 'Low';
  }
  return 'Medium';
}

/**
 * Map our task type to JIRA issue type (reverse mapping)
 */
export function reverseMapTaskType(taskType: string): string {
  const typeLower = taskType.toLowerCase();
  if (typeLower === 'bug') {
    return 'Bug';
  }
  if (typeLower === 'milestone') {
    return 'Epic';
  }
  return 'Task';
}

/**
 * Export a task to JIRA (create or update an issue)
 */
export async function exportTaskToJira(
  taskId: string,
  organizationId: string,
  projectKey: string,
  credentials: JiraCredentials,
  createNew: boolean = false
): Promise<{ issueKey: string; issueId: string }> {
  try {
    // Fetch the task from our database
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const jiraService = new JiraService(credentials);

    // If task already has a JIRA issue key and we're not creating new, update it
    if (task.jiraIssueKey && !createNew) {
      await jiraService.updateIssue(task.jiraIssueKey, {
        summary: task.title,
        description: task.description || undefined,
        priority: reverseMapPriority(task.priority),
        dueDate: task.endDate ? task.endDate.toISOString().split('T')[0] : undefined,
      });

      logger.info(`Updated JIRA issue ${task.jiraIssueKey} from task ${taskId}`);

      return {
        issueKey: task.jiraIssueKey,
        issueId: task.jiraIssueKey,
      };
    }

    // Create new issue in JIRA
    const result = await jiraService.createIssue({
      projectKey,
      summary: task.title,
      description: task.description || undefined,
      issueType: reverseMapTaskType(task.taskType),
      priority: reverseMapPriority(task.priority),
      dueDate: task.endDate ? task.endDate.toISOString().split('T')[0] : undefined,
    });

    // Update task with JIRA issue key
    await prisma.task.update({
      where: { id: taskId },
      data: {
        jiraIssueKey: result.key,
      },
    });

    logger.info(`Exported task ${taskId} to JIRA issue ${result.key}`);

    return {
      issueKey: result.key,
      issueId: result.id,
    };
  } catch (error: any) {
    logger.error(`Failed to export task ${taskId} to JIRA:`, error);
    throw error;
  }
}

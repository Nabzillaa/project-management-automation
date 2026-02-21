import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '../utils/db.js';
import { z } from 'zod';
import { JiraService, importJiraProject, exportTaskToJira } from '../services/jiraIntegration.js';
import { JiraSyncService } from '../services/jiraSyncService.js';
import { logger } from '../utils/logger.js';

const router = Router();
router.use(authenticate);

// Validation schemas
const jiraCredentialsSchema = z.object({
  domain: z.string().min(1, 'JIRA domain is required'),
  email: z.string().email('Valid email is required'),
  apiToken: z.string().min(1, 'API token is required'),
});

const importJiraProjectSchema = z.object({
  projectKey: z.string().min(1, 'Project key is required'),
  organizationId: z.string().uuid('Valid organization ID is required'),
});

// Test JIRA connection
router.post('/jira/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const credentials = jiraCredentialsSchema.parse(req.body);
    const jiraService = new JiraService(credentials);

    const isConnected = await jiraService.testConnection();

    if (isConnected) {
      res.json({
        success: true,
        message: 'Successfully connected to JIRA',
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Failed to connect to JIRA. Please check your credentials.',
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error('Error testing JIRA connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test JIRA connection',
    });
  }
});

// Get JIRA projects
router.post('/jira/projects', async (req: Request, res: Response): Promise<void> => {
  try {
    const credentials = jiraCredentialsSchema.parse(req.body);
    const jiraService = new JiraService(credentials);

    const projects = await jiraService.getProjects();

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error('Error fetching JIRA projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch JIRA projects',
    });
  }
});

// Save JIRA credentials
router.post('/jira/credentials', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, ...credentials } = req.body;
    const validatedCredentials = jiraCredentialsSchema.parse(credentials);

    if (!organizationId) {
      res.status(400).json({
        success: false,
        error: 'Organization ID is required',
      });
      return;
    }

    // Test connection before saving
    const jiraService = new JiraService(validatedCredentials);
    const isConnected = await jiraService.testConnection();

    if (!isConnected) {
      res.status(401).json({
        success: false,
        error: 'Failed to connect to JIRA. Please check your credentials.',
      });
      return;
    }

    // Save credentials (encrypted in production)
    const integration = await prisma.integrationCredential.upsert({
      where: {
        organizationId_integrationType: {
          organizationId,
          integrationType: 'jira',
        },
      },
      update: {
        additionalData: validatedCredentials,
        isActive: true,
      },
      create: {
        organizationId,
        userId: req.user!.id,
        integrationType: 'jira',
        accessToken: validatedCredentials.apiToken,
        additionalData: validatedCredentials,
        isActive: true,
      },
    });

    res.json({
      success: true,
      message: 'JIRA credentials saved successfully',
      data: {
        id: integration.id,
        integrationType: integration.integrationType,
        isActive: integration.isActive,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error('Error saving JIRA credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save JIRA credentials',
    });
  }
});

// Get saved JIRA credentials (without sensitive data)
router.get('/jira/credentials/:organizationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;

    const integration = await prisma.integrationCredential.findUnique({
      where: {
        organizationId_integrationType: {
          organizationId,
          integrationType: 'jira',
        },
      },
    });

    if (!integration) {
      res.json({
        success: true,
        data: null,
      });
      return;
    }

    const credentials = integration.additionalData as any;

    res.json({
      success: true,
      data: {
        id: integration.id,
        integrationType: integration.integrationType,
        isActive: integration.isActive,
        domain: credentials.domain,
        email: credentials.email,
        hasApiToken: !!credentials.apiToken,
      },
    });
  } catch (error) {
    logger.error('Error fetching JIRA credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch JIRA credentials',
    });
  }
});

// Import JIRA project
router.post('/jira/import', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectKey, organizationId, credentials } = req.body;
    const userId = (req as any).user.userId;

    if (!credentials) {
      res.status(400).json({
        success: false,
        error: 'JIRA credentials are required',
      });
      return;
    }

    const validatedData = importJiraProjectSchema.parse({ projectKey, organizationId });
    const validatedCredentials = jiraCredentialsSchema.parse(credentials);

    logger.info(`Starting JIRA import for project ${projectKey}`);

    const result = await importJiraProject(
      validatedData.projectKey,
      validatedData.organizationId,
      userId,
      validatedCredentials
    );

    res.json({
      success: true,
      message: `Successfully imported ${result.tasksImported} tasks from JIRA`,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error('Error importing JIRA project:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import JIRA project',
    });
  }
});

// Delete JIRA credentials
router.delete('/jira/credentials/:organizationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;

    await prisma.integrationCredential.delete({
      where: {
        organizationId_integrationType: {
          organizationId,
          integrationType: 'jira',
        },
      },
    });

    res.json({
      success: true,
      message: 'JIRA credentials deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting JIRA credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete JIRA credentials',
    });
  }
});

// Export task to JIRA
const exportTaskSchema = z.object({
  taskId: z.string().uuid('Valid task ID is required'),
  organizationId: z.string().uuid('Valid organization ID is required'),
  projectKey: z.string().min(1, 'JIRA project key is required'),
  createNew: z.boolean().default(false),
  credentials: z.object({
    domain: z.string().min(1),
    email: z.string().email(),
    apiToken: z.string().min(1),
  }),
});

router.post('/jira/export/:taskId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { organizationId, projectKey, createNew, credentials } = exportTaskSchema.parse({
      taskId,
      ...req.body,
    });

    const result = await exportTaskToJira(taskId, organizationId, projectKey, credentials, createNew);

    res.json({
      success: true,
      message: `Task exported to JIRA issue ${result.issueKey}`,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error('Error exporting task to JIRA:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export task to JIRA',
    });
  }
});

// Get JIRA mappings (status/priority) for organization
router.get('/jira/mappings/:organizationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;

    // For now, return default mappings
    // In the future, these could be stored in database
    const mappings = {
      status: {
        todo: 'To Do',
        in_progress: 'In Progress',
        review: 'In Review',
        completed: 'Done',
        blocked: 'Blocked',
      },
      priority: {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        critical: 'Highest',
      },
    };

    res.json({
      success: true,
      data: mappings,
    });
  } catch (error) {
    logger.error('Error fetching JIRA mappings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch JIRA mappings',
    });
  }
});

// Sync JIRA project
const syncProjectSchema = z.object({
  projectId: z.string().uuid('Valid project ID is required'),
  organizationId: z.string().uuid('Valid organization ID is required'),
  credentials: z.object({
    domain: z.string().min(1),
    email: z.string().email(),
    apiToken: z.string().min(1),
  }),
});

router.post('/jira/sync/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { organizationId, credentials } = syncProjectSchema.parse({
      projectId,
      ...req.body,
    });

    const syncService = new JiraSyncService();
    const result = await syncService.syncProject(projectId, organizationId, credentials);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error('Error syncing JIRA project:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync JIRA project',
    });
  }
});

// Get JIRA sync history
router.get('/jira/sync/history/:organizationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const syncService = new JiraSyncService();
    const history = await syncService.getSyncHistory(organizationId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error fetching sync history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync history',
    });
  }
});

export default router;

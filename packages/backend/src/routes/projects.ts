import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateProjectRequest, UpdateProjectRequest, ProjectStatus, Priority } from '@pm-app/shared';
import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createProjectSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  budget: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  budget: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * GET /api/projects
 * Get all projects (with optional filters)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId, status } = req.query;

    const where: any = {};
    if (organizationId) where.organizationId = organizationId as string;
    if (status) where.status = status as string;

    const projects = await prisma.project.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    logger.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects',
    });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = createProjectSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validationResult.error.issues,
      });
      return;
    }

    const data: CreateProjectRequest = validationResult.data;

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
      return;
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        priority: data.priority,
        budget: data.budget,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        createdBy: req.user!.id,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    logger.info(`Project created: ${project.name} by ${req.user!.email}`);

    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    logger.error('Create project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create project',
    });
  }
});

/**
 * GET /api/projects/:id
 * Get project by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            isCriticalPath: true,
            assignedTo: true,
          },
        },
        _count: {
          select: {
            tasks: true,
            costEntries: true,
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        error: 'Project not found',
      });
      return;
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    logger.error('Get project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project',
    });
  }
});

/**
 * PATCH /api/projects/:id
 * Update project
 */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Validate request body
    const validationResult = updateProjectSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validationResult.error.issues,
      });
      return;
    }

    const data: UpdateProjectRequest = validationResult.data;

    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      res.status(404).json({
        success: false,
        error: 'Project not found',
      });
      return;
    }

    // Update project
    const project = await prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        status: data.status,
        priority: data.priority,
        budget: data.budget,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info(`Project updated: ${project.name} by ${req.user!.email}`);

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    logger.error('Update project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update project',
    });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete project
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        error: 'Project not found',
      });
      return;
    }

    // Delete project (cascades to tasks, costs, etc.)
    await prisma.project.delete({
      where: { id },
    });

    logger.info(`Project deleted: ${project.name} by ${req.user!.email}`);

    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    logger.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete project',
    });
  }
});

/**
 * GET /api/projects/:id/dashboard
 * Get project dashboard data
 */
router.get('/:id/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Get project with related data
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          select: {
            status: true,
            estimatedHours: true,
            actualHours: true,
          },
        },
        costEntries: {
          select: {
            amount: true,
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        error: 'Project not found',
      });
      return;
    }

    // Calculate task statistics
    const taskStats = {
      total: project.tasks.length,
      completed: project.tasks.filter((t) => t.status === 'completed').length,
      inProgress: project.tasks.filter((t) => t.status === 'in_progress').length,
      todo: project.tasks.filter((t) => t.status === 'todo').length,
      blocked: project.tasks.filter((t) => t.status === 'blocked').length,
    };

    // Calculate budget statistics
    const totalCost = project.costEntries.reduce(
      (sum, entry) => sum + Number(entry.amount),
      0
    );
    const budgetStats = {
      budget: Number(project.budget || 0),
      spent: totalCost,
      remaining: Number(project.budget || 0) - totalCost,
      percentageUsed:
        project.budget && Number(project.budget) > 0
          ? (totalCost / Number(project.budget)) * 100
          : 0,
    };

    // Calculate timeline statistics
    const now = new Date();
    const startDate = project.startDate ? new Date(project.startDate) : now;
    const endDate = project.endDate ? new Date(project.endDate) : now;
    const totalDays = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const elapsedDays = Math.max(
      0,
      Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const remainingDays = Math.max(0, totalDays - elapsedDays);

    const timelineStats = {
      startDate: project.startDate,
      endDate: project.endDate,
      daysElapsed: elapsedDays,
      daysRemaining: remainingDays,
      percentageComplete: totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0,
    };

    res.json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          priority: project.priority,
        },
        taskStats,
        budgetStats,
        timelineStats,
      },
    });
  } catch (error) {
    logger.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
    });
  }
});

export default router;

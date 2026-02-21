import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CreateTaskRequest, UpdateTaskRequest, Priority, TaskStatus, TaskType } from '@pm-app/shared';
import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  parentTaskId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.nativeEnum(Priority),
  taskType: z.nativeEnum(TaskType),
  estimatedHours: z.number().positive().optional(),
  optimisticHours: z.number().positive().optional(),
  mostLikelyHours: z.number().positive().optional(),
  pessimisticHours: z.number().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  assignedTo: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().nonnegative().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  assignedTo: z.string().uuid().optional(),
});

/**
 * GET /api/tasks?projectId=xxx
 * Get all tasks for a project
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, assignedTo, status } = req.query;

    if (!projectId) {
      res.status(400).json({
        success: false,
        error: 'projectId query parameter is required',
      });
      return;
    }

    const where: any = { projectId: projectId as string };
    if (assignedTo) where.assignedTo = assignedTo as string;
    if (status) where.status = status as string;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        parentTask: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            subtasks: true,
            predecessorDeps: true,
            successorDeps: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    logger.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tasks',
    });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = createTaskSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validationResult.error.issues,
      });
      return;
    }

    const data: CreateTaskRequest = validationResult.data;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        error: 'Project not found',
      });
      return;
    }

    // If parent task specified, verify it exists
    if (data.parentTaskId) {
      const parentTask = await prisma.task.findUnique({
        where: { id: data.parentTaskId },
      });

      if (!parentTask) {
        res.status(404).json({
          success: false,
          error: 'Parent task not found',
        });
        return;
      }
    }

    // Calculate expected hours using PERT if all three estimates provided
    let expectedHours = data.estimatedHours;
    if (data.optimisticHours && data.mostLikelyHours && data.pessimisticHours) {
      expectedHours =
        (data.optimisticHours + 4 * data.mostLikelyHours + data.pessimisticHours) / 6;
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        projectId: data.projectId,
        parentTaskId: data.parentTaskId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        taskType: data.taskType,
        estimatedHours: data.estimatedHours,
        optimisticHours: data.optimisticHours,
        mostLikelyHours: data.mostLikelyHours,
        pessimisticHours: data.pessimisticHours,
        expectedHours,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        assignedTo: data.assignedTo,
        createdBy: req.user!.id,
      },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info(`Task created: ${task.title} in project ${task.projectId} by ${req.user!.email}`);

    res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error('Create task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create task',
    });
  }
});

/**
 * GET /api/tasks/:id
 * Get task by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
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
        parentTask: {
          select: {
            id: true,
            title: true,
          },
        },
        subtasks: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        predecessorDeps: {
          include: {
            predecessorTask: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        successorDeps: {
          include: {
            successorTask: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        timeEntries: {
          select: {
            id: true,
            hours: true,
            entryDate: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found',
      });
      return;
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error('Get task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch task',
    });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update task
 */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Validate request body
    const validationResult = updateTaskSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validationResult.error.issues,
      });
      return;
    }

    const data: UpdateTaskRequest = validationResult.data;

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      res.status(404).json({
        success: false,
        error: 'Task not found',
      });
      return;
    }

    // Prepare update data
    const updateData: any = {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      estimatedHours: data.estimatedHours,
      actualHours: data.actualHours,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    };

    // Handle assignedTo (can be null to unassign)
    if ('assignedTo' in data) {
      updateData.assignedTo = data.assignedTo;
    }

    // Set completedAt when status changes to completed
    if (data.status === 'completed' && existingTask.status !== 'completed') {
      updateData.completedAt = new Date();
    }

    // Update task
    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info(`Task updated: ${task.title} by ${req.user!.email}`);

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error('Update task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update task',
    });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if task exists
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found',
      });
      return;
    }

    // Delete task (cascades to dependencies, time entries, etc.)
    await prisma.task.delete({
      where: { id },
    });

    logger.info(`Task deleted: ${task.title} by ${req.user!.email}`);

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    logger.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete task',
    });
  }
});

/**
 * POST /api/tasks/:id/dependencies
 * Add a task dependency
 */
router.post('/:id/dependencies', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { predecessorTaskId, dependencyType = 'finish_to_start', lagDays = 0 } = req.body;

    if (!predecessorTaskId) {
      res.status(400).json({
        success: false,
        error: 'predecessorTaskId is required',
      });
      return;
    }

    // Check if both tasks exist
    const [successorTask, predecessorTask] = await Promise.all([
      prisma.task.findUnique({ where: { id } }),
      prisma.task.findUnique({ where: { id: predecessorTaskId } }),
    ]);

    if (!successorTask || !predecessorTask) {
      res.status(404).json({
        success: false,
        error: 'Task not found',
      });
      return;
    }

    // Check if they're in the same project
    if (successorTask.projectId !== predecessorTask.projectId) {
      res.status(400).json({
        success: false,
        error: 'Tasks must be in the same project',
      });
      return;
    }

    // Check if dependency already exists
    const existingDep = await prisma.taskDependency.findFirst({
      where: {
        successorTaskId: id,
        predecessorTaskId,
      },
    });

    if (existingDep) {
      res.status(400).json({
        success: false,
        error: 'Dependency already exists',
      });
      return;
    }

    // Create dependency
    const dependency = await prisma.taskDependency.create({
      data: {
        successorTaskId: id,
        predecessorTaskId,
        dependencyType,
        lagDays,
      },
      include: {
        predecessorTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    logger.info(`Dependency created: ${predecessorTask.title} -> ${successorTask.title} by ${req.user!.email}`);

    res.json({
      success: true,
      data: dependency,
    });
  } catch (error) {
    logger.error('Create dependency error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create dependency',
    });
  }
});

/**
 * DELETE /api/tasks/:id/dependencies/:dependencyId
 * Remove a task dependency
 */
router.delete('/:id/dependencies/:dependencyId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, dependencyId } = req.params;

    // Check if dependency exists and belongs to this task
    const dependency = await prisma.taskDependency.findFirst({
      where: {
        id: dependencyId,
        successorTaskId: id,
      },
    });

    if (!dependency) {
      res.status(404).json({
        success: false,
        error: 'Dependency not found',
      });
      return;
    }

    // Delete dependency
    await prisma.taskDependency.delete({
      where: { id: dependencyId },
    });

    logger.info(`Dependency deleted: ${dependencyId} by ${req.user!.email}`);

    res.json({
      success: true,
      message: 'Dependency deleted successfully',
    });
  } catch (error) {
    logger.error('Delete dependency error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete dependency',
    });
  }
});

export default router;

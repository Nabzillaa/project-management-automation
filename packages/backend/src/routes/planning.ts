import { Router, Request, Response } from 'express';
import { calculateCPM, calculatePERT } from '@pm-app/planning-engine';
import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/planning/cpm/:projectId
 * Calculate Critical Path Method for a project
 */
router.post('/cpm/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    // Get project with tasks and dependencies
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          include: {
            predecessorDeps: {
              include: {
                predecessorTask: true,
              },
            },
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

    // Transform tasks into CPM format
    const cpmTasks = project.tasks.map(task => ({
      id: task.id,
      duration: Number(task.estimatedHours || task.expectedHours || 0),
      dependencies: task.predecessorDeps.map((dep: any) => dep.predecessorTaskId),
    }));

    // Calculate CPM
    const startDate = project.startDate || new Date();
    const cpmResults = calculateCPM(cpmTasks, startDate);

    // Update tasks with CPM results
    const updatePromises = cpmResults.map(result => {
      return prisma.task.update({
        where: { id: result.taskId },
        data: {
          earliestStart: result.earliestStart,
          earliestFinish: result.earliestFinish,
          latestStart: result.latestStart,
          latestFinish: result.latestFinish,
          slackTime: result.slack,
          isCriticalPath: result.isCritical,
        },
      });
    });

    await Promise.all(updatePromises);

    // Get critical path tasks
    const criticalPath = cpmResults
      .filter(r => r.isCritical)
      .map(r => ({
        taskId: r.taskId,
        task: project.tasks.find(t => t.id === r.taskId)?.title,
        earliestStart: r.earliestStart,
        earliestFinish: r.earliestFinish,
      }));

    logger.info(`CPM calculated for project ${project.name} by ${req.user!.email}`);

    res.json({
      success: true,
      data: {
        projectId,
        projectName: project.name,
        startDate,
        totalDuration: Math.max(...cpmResults.map(r => r.earliestFinish.getTime() - startDate.getTime())) / (1000 * 60 * 60),
        criticalPath,
        results: cpmResults,
      },
    });
  } catch (error) {
    logger.error('CPM calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate critical path',
    });
  }
});

/**
 * GET /api/planning/critical-path/:projectId
 * Get the critical path for a project
 */
router.get('/critical-path/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          where: {
            isCriticalPath: true,
          },
          orderBy: {
            earliestStart: 'asc',
          },
          include: {
            assignee: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
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
      data: {
        projectId,
        projectName: project.name,
        criticalPathTasks: project.tasks,
        totalTasks: project.tasks.length,
      },
    });
  } catch (error) {
    logger.error('Get critical path error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get critical path',
    });
  }
});

/**
 * POST /api/planning/pert
 * Calculate PERT estimation
 */
router.post('/pert', async (req: Request, res: Response): Promise<void> => {
  try {
    const { optimistic, mostLikely, pessimistic } = req.body;

    if (!optimistic || !mostLikely || !pessimistic) {
      res.status(400).json({
        success: false,
        error: 'optimistic, mostLikely, and pessimistic are required',
      });
      return;
    }

    const result = calculatePERT({
      optimistic,
      mostLikely,
      pessimistic,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('PERT calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate PERT estimation',
    });
  }
});

/**
 * POST /api/planning/auto-schedule/:projectId
 * Automatically schedule all tasks in a project based on dependencies
 */
router.post('/auto-schedule/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          include: {
            predecessorDeps: {
              include: {
                predecessorTask: true,
              },
            },
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

    // Transform tasks into CPM format
    const cpmTasks = project.tasks.map(task => ({
      id: task.id,
      duration: Number(task.estimatedHours || task.expectedHours || 8),
      dependencies: task.predecessorDeps.map((dep: any) => dep.predecessorTaskId),
    }));

    // Calculate CPM to get scheduled dates
    const startDate = project.startDate || new Date();
    const cpmResults = calculateCPM(cpmTasks, startDate);

    // Update all tasks with calculated dates
    const updatePromises = cpmResults.map(result => {
      // Calculate end date based on earliest start + duration
      const task = project.tasks.find(t => t.id === result.taskId);
      const durationHours = Number(task?.estimatedHours || task?.expectedHours || 8);
      const endDate = new Date(result.earliestStart);
      endDate.setHours(endDate.getHours() + durationHours);

      return prisma.task.update({
        where: { id: result.taskId },
        data: {
          startDate: result.earliestStart,
          endDate,
          earliestStart: result.earliestStart,
          earliestFinish: result.earliestFinish,
          latestStart: result.latestStart,
          latestFinish: result.latestFinish,
          slackTime: result.slack,
          isCriticalPath: result.isCritical,
        },
      });
    });

    await Promise.all(updatePromises);

    logger.info(`Auto-scheduled project ${project.name} by ${req.user!.email}`);

    res.json({
      success: true,
      data: {
        projectId,
        tasksScheduled: cpmResults.length,
        message: 'All tasks scheduled successfully based on dependencies',
      },
    });
  } catch (error) {
    logger.error('Auto-schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-schedule tasks',
    });
  }
});

export default router;

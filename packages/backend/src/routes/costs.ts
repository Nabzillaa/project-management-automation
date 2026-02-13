import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '@pm-app/database';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Helper function to map entryDate to date for frontend compatibility
function mapCostEntry(entry: any) {
  return {
    ...entry,
    date: entry.entryDate,
  };
}

// Validation schemas
const createCostEntrySchema = z.object({
  projectId: z.string().uuid(),
  amount: z.number().positive(),
  category: z.enum(['labor', 'materials', 'equipment', 'software', 'overhead', 'other']),
  description: z.string().min(1),
  date: z.string().or(z.date()).optional(),
  taskId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
});

const updateCostEntrySchema = z.object({
  amount: z.number().positive().optional(),
  category: z.enum(['labor', 'materials', 'equipment', 'software', 'overhead', 'other']).optional(),
  description: z.string().min(1).optional(),
  date: z.string().or(z.date()).optional(),
});

// ====================================
// COST ENTRY CRUD OPERATIONS
// ====================================

// Get all cost entries for a project
router.get('/project/:projectId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate, category } = req.query;

    const where: any = {
      projectId,
    };

    if (startDate && endDate) {
      where.entryDate = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (category) {
      where.category = category;
    }

    const costEntries = await prisma.costEntry.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        entryDate: 'desc',
      },
    });

    // Calculate total
    const total = costEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);

    // Map entryDate to date for frontend compatibility
    const mappedEntries = costEntries.map((entry) => ({
      ...entry,
      date: entry.entryDate,
    }));

    res.json({
      success: true,
      data: {
        entries: mappedEntries,
        total,
        count: mappedEntries.length,
      },
    });
  } catch (error) {
    console.error('Error fetching cost entries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cost entries',
    });
  }
});

// Get cost entry by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const costEntry = await prisma.costEntry.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            budget: true,
          },
        },
      },
    });

    if (!costEntry) {
      res.status(404).json({
        success: false,
        error: 'Cost entry not found',
      });
      return;
    }

    res.json({
      success: true,
      data: mapCostEntry(costEntry),
    });
  } catch (error) {
    console.error('Error fetching cost entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cost entry',
    });
  }
});

// Create cost entry
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createCostEntrySchema.parse(req.body);

    const costEntry = await prisma.costEntry.create({
      data: {
        projectId: validatedData.projectId,
        amount: validatedData.amount,
        category: validatedData.category,
        description: validatedData.description,
        entryDate: validatedData.date ? new Date(validatedData.date) : new Date(),
        taskId: validatedData.taskId,
        createdBy: req.user!.id,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Update project's actualCost
    const project = await prisma.project.findUnique({
      where: { id: validatedData.projectId },
      select: { actualCost: true },
    });

    if (project) {
      await prisma.project.update({
        where: { id: validatedData.projectId },
        data: {
          actualCost: Number(project.actualCost) + Number(validatedData.amount),
        },
      });
    }

    res.status(201).json({
      success: true,
      data: costEntry,
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

    console.error('Error creating cost entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create cost entry',
    });
  }
});

// Update cost entry
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = updateCostEntrySchema.parse(req.body);

    // Get old amount to calculate difference
    const oldEntry = await prisma.costEntry.findUnique({
      where: { id },
      select: { amount: true, projectId: true },
    });

    if (!oldEntry) {
      res.status(404).json({
        success: false,
        error: 'Cost entry not found',
      });
      return;
    }

    const updateData: any = {};
    if (validatedData.amount !== undefined) updateData.amount = validatedData.amount;
    if (validatedData.category !== undefined) updateData.category = validatedData.category;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.date) {
      updateData.entryDate = new Date(validatedData.date);
    }

    const costEntry = await prisma.costEntry.update({
      where: { id },
      data: updateData,
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Update project's actualCost if amount changed
    if (validatedData.amount !== undefined) {
      const project = await prisma.project.findUnique({
        where: { id: oldEntry.projectId },
        select: { actualCost: true },
      });

      if (project) {
        const difference = Number(validatedData.amount) - Number(oldEntry.amount);
        await prisma.project.update({
          where: { id: oldEntry.projectId },
          data: {
            actualCost: Number(project.actualCost) + difference,
          },
        });
      }
    }

    res.json({
      success: true,
      data: mapCostEntry(costEntry),
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

    console.error('Error updating cost entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update cost entry',
    });
  }
});

// Delete cost entry
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const costEntry = await prisma.costEntry.findUnique({
      where: { id },
      select: { amount: true, projectId: true },
    });

    if (!costEntry) {
      res.status(404).json({
        success: false,
        error: 'Cost entry not found',
      });
      return;
    }

    await prisma.costEntry.delete({
      where: { id },
    });

    // Update project's actualCost
    const project = await prisma.project.findUnique({
      where: { id: costEntry.projectId },
      select: { actualCost: true },
    });

    if (project) {
      await prisma.project.update({
        where: { id: costEntry.projectId },
        data: {
          actualCost: Math.max(0, Number(project.actualCost) - Number(costEntry.amount)),
        },
      });
    }

    res.json({
      success: true,
      message: 'Cost entry deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting cost entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete cost entry',
    });
  }
});

// ====================================
// COST ANALYTICS & REPORTS
// ====================================

// Get cost breakdown by category for a project
router.get('/project/:projectId/breakdown', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;

    const where: any = {
      projectId,
    };

    if (startDate && endDate) {
      where.entryDate = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const costEntries = await prisma.costEntry.findMany({
      where,
      select: {
        category: true,
        amount: true,
      },
    });

    // Group by category
    const breakdown = costEntries.reduce((acc: any, entry) => {
      const category = entry.category;
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += Number(entry.amount);
      return acc;
    }, {});

    const total = Object.values(breakdown).reduce((sum: number, amount: any) => sum + amount, 0);

    // Convert to array format
    const breakdownArray = Object.entries(breakdown).map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? ((amount as number / total) * 100).toFixed(2) : 0,
    }));

    res.json({
      success: true,
      data: {
        breakdown: breakdownArray,
        total,
      },
    });
  } catch (error) {
    console.error('Error generating cost breakdown:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate cost breakdown',
    });
  }
});

// Get budget status for a project
router.get('/project/:projectId/budget-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        budget: true,
        actualCost: true,
        name: true,
      },
    });

    if (!project) {
      res.status(404).json({
        success: false,
        error: 'Project not found',
      });
      return;
    }

    const budget = Number(project.budget || 0);
    const spent = Number(project.actualCost || 0);
    const remaining = budget - spent;
    const percentageUsed = budget > 0 ? (spent / budget) * 100 : 0;

    let status = 'good';
    if (percentageUsed >= 100) {
      status = 'over_budget';
    } else if (percentageUsed >= 90) {
      status = 'critical';
    } else if (percentageUsed >= 75) {
      status = 'warning';
    }

    res.json({
      success: true,
      data: {
        projectId,
        projectName: project.name,
        budget,
        spent,
        remaining,
        percentageUsed: Math.round(percentageUsed * 10) / 10,
        status,
        isOverBudget: percentageUsed >= 100,
      },
    });
  } catch (error) {
    console.error('Error getting budget status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get budget status',
    });
  }
});

// Get cost trend over time
router.get('/project/:projectId/trend', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate, interval = 'day' } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'startDate and endDate query parameters are required',
      });
      return;
    }

    const costEntries = await prisma.costEntry.findMany({
      where: {
        projectId,
        date: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
      },
      orderBy: {
        date: 'asc',
      },
      select: {
        date: true,
        amount: true,
        category: true,
      },
    });

    // Group by date interval
    const trend: any = {};
    let cumulativeTotal = 0;

    costEntries.forEach((entry) => {
      const dateKey = entry.date.toISOString().split('T')[0]; // Group by day
      if (!trend[dateKey]) {
        trend[dateKey] = {
          date: dateKey,
          amount: 0,
          cumulative: 0,
        };
      }
      trend[dateKey].amount += Number(entry.amount);
      cumulativeTotal += Number(entry.amount);
      trend[dateKey].cumulative = cumulativeTotal;
    });

    const trendArray = Object.values(trend);

    res.json({
      success: true,
      data: trendArray,
    });
  } catch (error) {
    console.error('Error generating cost trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate cost trend',
    });
  }
});

// Recalculate project costs from task data
router.post('/project/:projectId/recalculate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    // Get all tasks for this project
    const tasks = await prisma.task.findMany({
      where: { projectId },
      select: {
        estimatedCost: true,
        actualCost: true,
        estimatedHours: true,
        actualHours: true,
      },
    });

    // Calculate totals from task data
    const totalBudget = tasks.reduce((sum, task) => sum + Number(task.estimatedCost || 0), 0);
    const totalActualCost = tasks.reduce((sum, task) => sum + Number(task.actualCost || 0), 0);
    const totalEstimatedHours = tasks.reduce((sum, task) => sum + Number(task.estimatedHours || 0), 0);
    const totalActualHours = tasks.reduce((sum, task) => sum + Number(task.actualHours || 0), 0);

    // Update project with aggregated costs
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        budget: totalBudget,
        actualCost: totalActualCost,
      },
    });

    console.log(`Recalculated costs for project ${projectId}: Budget=$${totalBudget}, Actual=$${totalActualCost}`);

    res.json({
      success: true,
      data: {
        projectId,
        taskCount: tasks.length,
        budget: totalBudget,
        actualCost: totalActualCost,
        totalEstimatedHours,
        totalActualHours,
        costVariance: totalBudget - totalActualCost,
      },
    });
  } catch (error) {
    console.error('Error recalculating costs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recalculate costs',
    });
  }
});

// Get task-level cost summary for a project
router.get('/project/:projectId/task-costs', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;

    // Get all tasks with costs
    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        OR: [
          { estimatedCost: { gt: 0 } },
          { actualCost: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        estimatedCost: true,
        actualCost: true,
        estimatedHours: true,
        actualHours: true,
      },
      orderBy: {
        actualCost: 'desc',
      },
      take: 20, // Top 20 tasks by cost
    });

    // Calculate totals
    const allTasks = await prisma.task.findMany({
      where: { projectId },
      select: {
        estimatedCost: true,
        actualCost: true,
      },
    });

    const totalBudget = allTasks.reduce((sum, task) => sum + Number(task.estimatedCost || 0), 0);
    const totalActualCost = allTasks.reduce((sum, task) => sum + Number(task.actualCost || 0), 0);
    const tasksWithCosts = allTasks.filter(t => Number(t.estimatedCost || 0) > 0 || Number(t.actualCost || 0) > 0).length;

    // Map tasks to cost entries format
    const taskCosts = tasks.map(task => ({
      id: task.id,
      title: task.title,
      status: task.status,
      estimatedCost: Number(task.estimatedCost || 0),
      actualCost: Number(task.actualCost || 0),
      variance: Number(task.estimatedCost || 0) - Number(task.actualCost || 0),
      estimatedHours: Number(task.estimatedHours || 0),
      actualHours: Number(task.actualHours || 0),
    }));

    res.json({
      success: true,
      data: {
        tasks: taskCosts,
        summary: {
          totalBudget,
          totalActualCost,
          totalVariance: totalBudget - totalActualCost,
          taskCount: allTasks.length,
          tasksWithCosts,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching task costs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch task costs',
    });
  }
});

export default router;

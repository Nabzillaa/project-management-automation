import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import prisma from '../utils/db.js';
import { z } from 'zod';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation schemas
const createResourceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['person', 'equipment', 'material']),
  costPerHour: z.number().optional(),
  availabilityHoursPerDay: z.number().min(0).optional(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid().optional(),
});

const updateResourceSchema = z.object({
  name: z.string().min(1).optional(),
  costPerHour: z.number().optional(),
  availabilityHoursPerDay: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

const createAllocationSchema = z.object({
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  allocatedHours: z.number().min(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const updateAllocationSchema = z.object({
  allocatedHours: z.number().min(0).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ====================================
// RESOURCE CRUD OPERATIONS
// ====================================

// Get all resources for an organization
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.query;

    if (!organizationId || typeof organizationId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'organizationId query parameter is required',
      });
      return;
    }

    const resources = await prisma.resource.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        resourceAllocations: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
        _count: {
          select: {
            resourceAllocations: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json({
      success: true,
      data: resources,
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resources',
    });
  }
});

// Get resource by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        resourceAllocations: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                startDate: true,
                endDate: true,
                project: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: {
            startDate: 'asc',
          },
        },
      },
    });

    if (!resource) {
      res.status(404).json({
        success: false,
        error: 'Resource not found',
      });
      return;
    }

    res.json({
      success: true,
      data: resource,
    });
  } catch (error) {
    console.error('Error fetching resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resource',
    });
  }
});

// Create new resource
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = createResourceSchema.parse(req.body);

    const resource = await prisma.resource.create({
      data: validatedData,
    });

    res.status(201).json({
      success: true,
      data: resource,
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

    console.error('Error creating resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create resource',
    });
  }
});

// Update resource
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = updateResourceSchema.parse(req.body);

    const resource = await prisma.resource.update({
      where: { id },
      data: validatedData,
    });

    res.json({
      success: true,
      data: resource,
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

    console.error('Error updating resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update resource',
    });
  }
});

// Delete resource (soft delete)
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.resource.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Resource deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete resource',
    });
  }
});

// ====================================
// RESOURCE ALLOCATIONS
// ====================================

// Create allocation for a resource
router.post('/:id/allocations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: resourceId } = req.params;
    const validatedData = createAllocationSchema.parse(req.body);

    // Check for conflicts
    const conflicts = await prisma.resourceAllocation.findMany({
      where: {
        resourceId,
        taskId: validatedData.taskId,
        OR: [
          {
            AND: [
              { startDate: { lte: new Date(validatedData.startDate || new Date()) } },
              { endDate: { gte: new Date(validatedData.startDate || new Date()) } },
            ],
          },
          {
            AND: [
              { startDate: { lte: new Date(validatedData.endDate || new Date()) } },
              { endDate: { gte: new Date(validatedData.endDate || new Date()) } },
            ],
          },
        ],
      },
      include: {
        task: {
          select: {
            title: true,
          },
        },
      },
    });

    if (conflicts.length > 0) {
      res.status(409).json({
        success: false,
        error: 'Resource allocation conflict detected',
        conflicts: conflicts.map((c) => ({
          taskTitle: c.task.title,
          startDate: c.startDate,
          endDate: c.endDate,
        })),
      });
      return;
    }

    const allocation = await prisma.resourceAllocation.create({
      data: {
        resourceId,
        ...validatedData,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : new Date(),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : new Date(),
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: allocation,
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

    console.error('Error creating allocation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create allocation',
    });
  }
});

// Update allocation
router.patch(
  '/:id/allocations/:allocationId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { allocationId } = req.params;
      const validatedData = updateAllocationSchema.parse(req.body);

      const updateData: any = {
        ...validatedData,
      };

      if (validatedData.startDate) {
        updateData.startDate = new Date(validatedData.startDate);
      }
      if (validatedData.endDate) {
        updateData.endDate = new Date(validatedData.endDate);
      }

      const allocation = await prisma.resourceAllocation.update({
        where: { id: allocationId },
        data: updateData,
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: allocation,
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

      console.error('Error updating allocation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update allocation',
      });
    }
  }
);

// Delete allocation
router.delete(
  '/:id/allocations/:allocationId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { allocationId } = req.params;

      await prisma.resourceAllocation.delete({
        where: { id: allocationId },
      });

      res.json({
        success: true,
        message: 'Allocation deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting allocation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete allocation',
      });
    }
  }
);

// ====================================
// RESOURCE UTILIZATION & REPORTS
// ====================================

// Get resource utilization for a date range
router.get('/:id/utilization', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'startDate and endDate query parameters are required',
      });
      return;
    }

    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        resourceAllocations: {
          where: {
            OR: [
              {
                AND: [
                  { startDate: { lte: new Date(endDate as string) } },
                  { endDate: { gte: new Date(startDate as string) } },
                ],
              },
            ],
          },
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                project: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!resource) {
      res.status(404).json({
        success: false,
        error: 'Resource not found',
      });
      return;
    }

    // Calculate total allocated hours
    const totalAllocated = resource.resourceAllocations.reduce((sum, alloc) => {
      return sum + Number(alloc.allocatedHours || 0);
    }, 0);

    // Calculate available hours based on date range
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const availableHours = daysDiff * 8 * ((Number(resource.availabilityHoursPerDay || 8)) / 8);

    const utilizationPercentage = availableHours > 0 ? (totalAllocated / availableHours) * 100 : 0;

    res.json({
      success: true,
      data: {
        resourceId: resource.id,
        resourceName: resource.name,
        totalAllocated,
        availableHours,
        utilizationPercentage: Math.round(utilizationPercentage * 10) / 10,
        resourceAllocations: resource.resourceAllocations,
        isOverallocated: utilizationPercentage > 100,
      },
    });
  } catch (error) {
    console.error('Error calculating utilization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate utilization',
    });
  }
});

// Get all resources with utilization summary
router.get('/organization/:organizationId/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'startDate and endDate query parameters are required',
      });
      return;
    }

    const resources = await prisma.resource.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        resourceAllocations: {
          where: {
            OR: [
              {
                AND: [
                  { startDate: { lte: new Date(endDate as string) } },
                  { endDate: { gte: new Date(startDate as string) } },
                ],
              },
            ],
          },
        },
      },
    });

    const summary = resources.map((resource) => {
      const totalAllocated = resource.resourceAllocations.reduce((sum, alloc) => {
        return sum + Number(alloc.allocatedHours || 0);
      }, 0);

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const availableHours = daysDiff * 8 * ((Number(resource.availabilityHoursPerDay || 8)) / 8);

      const utilizationPercentage = availableHours > 0 ? (totalAllocated / availableHours) * 100 : 0;

      return {
        id: resource.id,
        name: resource.name,
        type: resource.type,
        totalAllocated,
        availableHours,
        utilizationPercentage: Math.round(utilizationPercentage * 10) / 10,
        isOverallocated: utilizationPercentage > 100,
        allocationCount: resource.resourceAllocations.length,
      };
    });

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error generating resource summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate resource summary',
    });
  }
});

export default router;

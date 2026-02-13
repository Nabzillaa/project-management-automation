import prisma from '@pm-app/database';
import { logger } from '../utils/logger.js';

interface BudgetAlert {
  projectId: string;
  projectName: string;
  budget: number;
  spent: number;
  percentageUsed: number;
  threshold: number;
  suggestions: string[];
}

const THRESHOLDS = [75, 90, 100];

export async function checkBudgetThresholds(): Promise<BudgetAlert[]> {
  try {
    const projects = await prisma.project.findMany({
      where: {
        budget: {
          not: null,
          gt: 0,
        },
        status: {
          notIn: ['completed', 'cancelled'],
        },
      },
      select: {
        id: true,
        name: true,
        budget: true,
        actualCost: true,
      },
    });

    const alerts: BudgetAlert[] = [];

    for (const project of projects) {
      const budget = Number(project.budget || 0);
      const spent = Number(project.actualCost || 0);
      const percentageUsed = budget > 0 ? (spent / budget) * 100 : 0;

      // Check if any threshold is exceeded
      const exceededThreshold = THRESHOLDS.find(
        (threshold) => percentageUsed >= threshold
      );

      if (exceededThreshold) {
        const suggestions = generateSuggestions(percentageUsed, budget, spent);

        alerts.push({
          projectId: project.id,
          projectName: project.name,
          budget,
          spent,
          percentageUsed,
          threshold: exceededThreshold,
          suggestions,
        });

        logger.info(`Budget alert for project ${project.name}: ${percentageUsed.toFixed(1)}% used`);
      }
    }

    return alerts;
  } catch (error) {
    logger.error('Error checking budget thresholds:', error);
    return [];
  }
}

function generateSuggestions(percentageUsed: number, budget: number, spent: number): string[] {
  const suggestions: string[] = [];
  const remaining = budget - spent;

  if (percentageUsed >= 100) {
    suggestions.push('Project is over budget. Immediate action required.');
    suggestions.push('Review and reduce non-critical expenses.');
    suggestions.push('Consider requesting budget increase or reducing project scope.');
    suggestions.push('Identify and eliminate unnecessary resource allocations.');
  } else if (percentageUsed >= 90) {
    suggestions.push('Budget critical: Only ' + Math.round(remaining) + ' remaining.');
    suggestions.push('Prioritize essential tasks only.');
    suggestions.push('Review upcoming planned expenses.');
    suggestions.push('Consider deferring non-critical work.');
  } else if (percentageUsed >= 75) {
    suggestions.push('Budget warning: Approaching limit.');
    suggestions.push('Monitor spending closely.');
    suggestions.push('Review resource allocations for optimization opportunities.');
    suggestions.push('Plan for potential budget adjustments.');
  }

  return suggestions;
}

export async function getBudgetAlertsForProject(projectId: string): Promise<BudgetAlert | null> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        budget: true,
        actualCost: true,
        status: true,
      },
    });

    if (!project || project.status === 'completed' || project.status === 'cancelled') {
      return null;
    }

    const budget = Number(project.budget || 0);
    const spent = Number(project.actualCost || 0);
    const percentageUsed = budget > 0 ? (spent / budget) * 100 : 0;

    const exceededThreshold = THRESHOLDS.find(
      (threshold) => percentageUsed >= threshold
    );

    if (!exceededThreshold) {
      return null;
    }

    return {
      projectId: project.id,
      projectName: project.name,
      budget,
      spent,
      percentageUsed,
      threshold: exceededThreshold,
      suggestions: generateSuggestions(percentageUsed, budget, spent),
    };
  } catch (error) {
    logger.error('Error getting budget alerts for project:', error);
    return null;
  }
}

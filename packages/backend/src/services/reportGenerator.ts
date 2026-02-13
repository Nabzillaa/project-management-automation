import prisma from '@pm-app/database';
import { logger } from '../utils/logger.js';
import { checkBudgetThresholds } from './budgetAlerts.js';

export interface ExecutiveSummary {
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  overview: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
  };
  budgetSummary: {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    averageUtilization: number;
    projectsOverBudget: number;
  };
  resourceUtilization: {
    totalResources: number;
    averageUtilization: number;
    overallocatedResources: number;
  };
  criticalItems: {
    overdueTasks: Array<{
      taskTitle: string;
      projectName: string;
      dueDate: Date;
      daysOverdue: number;
    }>;
    budgetAlerts: Array<{
      projectName: string;
      percentageUsed: number;
      remaining: number;
    }>;
    upcomingDeadlines: Array<{
      taskTitle: string;
      projectName: string;
      dueDate: Date;
      daysUntilDue: number;
    }>;
  };
  projectDetails: Array<{
    projectId: string;
    projectName: string;
    status: string;
    progress: number;
    budgetUsage: number;
    tasksCompleted: number;
    totalTasks: number;
    criticalPathLength: number;
  }>;
}

export async function generateExecutiveSummary(
  organizationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ExecutiveSummary> {
  try {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to last 7 days

    // Fetch all projects for the organization
    const projects = await prisma.project.findMany({
      where: { organizationId },
      include: {
        tasks: {
          include: {
            _count: {
              select: {
                predecessorDeps: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    // Calculate overview metrics
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'active').length;
    const completedProjects = projects.filter((p) => p.status === 'completed').length;

    const allTasks = projects.flatMap((p) => p.tasks);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === 'completed').length;
    const overdueTasks = allTasks.filter(
      (t) => t.endDate && new Date(t.endDate) < new Date() && t.status !== 'completed'
    ).length;

    // Calculate budget summary
    const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + Number(p.actualCost || 0), 0);
    const totalRemaining = totalBudget - totalSpent;
    const averageUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const projectsOverBudget = projects.filter((p) => {
      const budget = Number(p.budget || 0);
      const spent = Number(p.actualCost || 0);
      return budget > 0 && spent > budget;
    }).length;

    // Get budget alerts
    const budgetAlerts = await checkBudgetThresholds();

    // Get overdue tasks details
    const overdueTasksDetails = allTasks
      .filter((t) => t.endDate && new Date(t.endDate) < new Date() && t.status !== 'completed')
      .map((t) => {
        const project = projects.find((p) => p.id === t.projectId);
        const daysOverdue = Math.floor(
          (new Date().getTime() - new Date(t.endDate!).getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          taskTitle: t.title,
          projectName: project?.name || 'Unknown',
          dueDate: new Date(t.endDate!),
          daysOverdue,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 10);

    // Get upcoming deadlines (next 7 days)
    const upcomingDeadlines = allTasks
      .filter((t) => {
        if (!t.endDate || t.status === 'completed') return false;
        const dueDate = new Date(t.endDate);
        const now = new Date();
        const daysUntil = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 7;
      })
      .map((t) => {
        const project = projects.find((p) => p.id === t.projectId);
        const daysUntilDue = Math.floor(
          (new Date(t.endDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          taskTitle: t.title,
          projectName: project?.name || 'Unknown',
          dueDate: new Date(t.endDate!),
          daysUntilDue,
        };
      })
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .slice(0, 10);

    // Project details
    const projectDetails = projects.map((p) => {
      const projectTasks = p.tasks;
      const completedProjectTasks = projectTasks.filter((t) => t.status === 'completed').length;
      const progress = projectTasks.length > 0 ? (completedProjectTasks / projectTasks.length) * 100 : 0;
      const budgetUsage = Number(p.budget || 0) > 0
        ? (Number(p.actualCost || 0) / Number(p.budget || 0)) * 100
        : 0;
      const criticalTasks = projectTasks.filter((t: any) => t.isCriticalPath).length;

      return {
        projectId: p.id,
        projectName: p.name,
        status: p.status || 'planning',
        progress: Math.round(progress),
        budgetUsage: Math.round(budgetUsage * 10) / 10,
        tasksCompleted: completedProjectTasks,
        totalTasks: projectTasks.length,
        criticalPathLength: criticalTasks,
      };
    });

    // Get resource data
    const resources = await prisma.resource.findMany({
      where: { organizationId, isActive: true },
    });

    const summary: ExecutiveSummary = {
      generatedAt: new Date(),
      period: {
        start,
        end,
      },
      overview: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalTasks,
        completedTasks,
        overdueTasks,
      },
      budgetSummary: {
        totalBudget,
        totalSpent,
        totalRemaining,
        averageUtilization: Math.round(averageUtilization * 10) / 10,
        projectsOverBudget,
      },
      resourceUtilization: {
        totalResources: resources.length,
        averageUtilization: 0, // Simplified for now
        overallocatedResources: 0,
      },
      criticalItems: {
        overdueTasks: overdueTasksDetails,
        budgetAlerts: budgetAlerts.map((alert) => ({
          projectName: alert.projectName,
          percentageUsed: Math.round(alert.percentageUsed * 10) / 10,
          remaining: alert.percentageUsed >= 100 ? 0 : Math.round(alert.budget - alert.spent),
        })),
        upcomingDeadlines,
      },
      projectDetails,
    };

    logger.info(`Executive summary generated for organization ${organizationId}`);
    return summary;
  } catch (error) {
    logger.error('Error generating executive summary:', error);
    throw error;
  }
}

export function formatExecutiveSummaryHTML(summary: ExecutiveSummary): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; border-bottom: 1px solid #bdc3c7; padding-bottom: 5px; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; padding: 15px; background: #ecf0f1; border-radius: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .metric-label { font-size: 12px; color: #7f8c8d; text-transform: uppercase; }
        .alert { padding: 10px; margin: 10px 0; background: #fff3cd; border-left: 4px solid #ffc107; }
        .critical { background: #f8d7da; border-left-color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #3498db; color: white; }
        tr:hover { background: #f5f5f5; }
        .progress-bar { height: 20px; background: #ecf0f1; border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: #3498db; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #bdc3c7; color: #7f8c8d; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>📊 Executive Summary Report</h1>
      <p><strong>Generated:</strong> ${summary.generatedAt.toLocaleString()}</p>
      <p><strong>Period:</strong> ${summary.period.start.toLocaleDateString()} - ${summary.period.end.toLocaleDateString()}</p>

      <h2>📈 Overview</h2>
      <div>
        <div class="metric">
          <div class="metric-value">${summary.overview.totalProjects}</div>
          <div class="metric-label">Total Projects</div>
        </div>
        <div class="metric">
          <div class="metric-value">${summary.overview.activeProjects}</div>
          <div class="metric-label">Active</div>
        </div>
        <div class="metric">
          <div class="metric-value">${summary.overview.completedTasks}/${summary.overview.totalTasks}</div>
          <div class="metric-label">Tasks Completed</div>
        </div>
        <div class="metric">
          <div class="metric-value" style="color: ${summary.overview.overdueTasks > 0 ? '#dc3545' : '#28a745'}">${summary.overview.overdueTasks}</div>
          <div class="metric-label">Overdue Tasks</div>
        </div>
      </div>

      <h2>💰 Budget Summary</h2>
      <div>
        <div class="metric">
          <div class="metric-value">$${summary.budgetSummary.totalBudget.toLocaleString()}</div>
          <div class="metric-label">Total Budget</div>
        </div>
        <div class="metric">
          <div class="metric-value">$${summary.budgetSummary.totalSpent.toLocaleString()}</div>
          <div class="metric-label">Total Spent</div>
        </div>
        <div class="metric">
          <div class="metric-value">${summary.budgetSummary.averageUtilization}%</div>
          <div class="metric-label">Avg Utilization</div>
        </div>
        ${summary.budgetSummary.projectsOverBudget > 0 ? `
        <div class="alert critical">
          <strong>⚠️ ${summary.budgetSummary.projectsOverBudget} project(s) over budget</strong>
        </div>
        ` : ''}
      </div>

      ${summary.criticalItems.budgetAlerts.length > 0 ? `
        <h2>🚨 Budget Alerts</h2>
        ${summary.criticalItems.budgetAlerts.map(alert => `
          <div class="alert ${alert.percentageUsed >= 100 ? 'critical' : ''}">
            <strong>${alert.projectName}</strong>: ${alert.percentageUsed}% used
            ${alert.remaining > 0 ? ` - $${alert.remaining.toLocaleString()} remaining` : ' - OVER BUDGET'}
          </div>
        `).join('')}
      ` : ''}

      ${summary.criticalItems.overdueTasks.length > 0 ? `
        <h2>⏰ Overdue Tasks</h2>
        <table>
          <tr><th>Task</th><th>Project</th><th>Due Date</th><th>Days Overdue</th></tr>
          ${summary.criticalItems.overdueTasks.map(task => `
            <tr>
              <td>${task.taskTitle}</td>
              <td>${task.projectName}</td>
              <td>${task.dueDate.toLocaleDateString()}</td>
              <td style="color: #dc3545; font-weight: bold;">${task.daysOverdue}</td>
            </tr>
          `).join('')}
        </table>
      ` : ''}

      ${summary.criticalItems.upcomingDeadlines.length > 0 ? `
        <h2>📅 Upcoming Deadlines (Next 7 Days)</h2>
        <table>
          <tr><th>Task</th><th>Project</th><th>Due Date</th><th>Days Until Due</th></tr>
          ${summary.criticalItems.upcomingDeadlines.map(task => `
            <tr>
              <td>${task.taskTitle}</td>
              <td>${task.projectName}</td>
              <td>${task.dueDate.toLocaleDateString()}</td>
              <td>${task.daysUntilDue}</td>
            </tr>
          `).join('')}
        </table>
      ` : ''}

      <h2>📋 Project Details</h2>
      <table>
        <tr>
          <th>Project</th>
          <th>Status</th>
          <th>Progress</th>
          <th>Budget Usage</th>
          <th>Tasks</th>
        </tr>
        ${summary.projectDetails.map(project => `
          <tr>
            <td><strong>${project.projectName}</strong></td>
            <td>${project.status}</td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${project.progress}%"></div>
              </div>
              ${project.progress}%
            </td>
            <td style="color: ${project.budgetUsage > 100 ? '#dc3545' : project.budgetUsage > 90 ? '#ffc107' : '#28a745'}">${project.budgetUsage}%</td>
            <td>${project.tasksCompleted}/${project.totalTasks}</td>
          </tr>
        `).join('')}
      </table>

      <div class="footer">
        <p>🤖 This report was automatically generated by the Project Management App</p>
        <p>For more details, visit your <a href="${process.env.FRONTEND_URL}/dashboard">dashboard</a></p>
      </div>
    </body>
    </html>
  `;
}

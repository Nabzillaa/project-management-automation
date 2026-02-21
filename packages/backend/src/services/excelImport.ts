import * as XLSX from 'xlsx';
import prisma from '../utils/db.js';
import { logger } from '../utils/logger.js';

export interface ExcelImportResult {
  projectsImported: number;
  tasksImported: number;
  errors: string[];
}

interface ExcelRow {
  [key: string]: any;
}

/**
 * Import projects and tasks from Excel file (JIRA export format)
 * Expected columns: Epic/Project Name, Task ID, Task Summary, Status, Start Date, End Date, Assignee, Priority
 */
export async function importFromExcel(
  fileBuffer: Buffer,
  organizationId: string,
  userId: string
): Promise<ExcelImportResult> {
  const result: ExcelImportResult = {
    projectsImported: 0,
    tasksImported: 0,
    errors: [],
  };

  try {
    // Ensure organization exists
    let organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          id: organizationId,
          name: 'Default Organization',
          slug: 'default-org',
        },
      });
      logger.info('Created default organization');
    }

    // Parse Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      result.errors.push('Excel file is empty');
      return result;
    }

    logger.info(`Parsing Excel file with ${data.length} rows`);

    // Check if this is MS Project format (has Task Name, Start, Finish columns)
    const isMSProject = data.length > 0 &&
      (data[0]['Task Name'] || data[0]['Task name']) &&
      (data[0]['Start'] || data[0]['start']) &&
      (data[0]['Finish'] || data[0]['finish'] || data[0]['End']);

    logger.info(`Format detected: ${isMSProject ? 'MS Project' : 'Generic Excel'}`);

    // Group tasks by epic/project
    const projectMap = new Map<string, any[]>();

    if (isMSProject) {
      // For MS Project files, use the first row's task name as project name
      // Skip the first row (it's usually the project summary) and use rest as tasks
      const projectName = data[0]['Task Name'] || data[0]['Task name'] || 'MS Project Import';
      const projectTasks = data.slice(1); // Skip first row (project summary)

      if (projectTasks.length > 0) {
        projectMap.set(projectName, projectTasks);
      }

      logger.info(`MS Project format: project "${projectName}" with ${projectTasks.length} tasks`);
    } else {
      // For other Excel formats, group by epic/project
      for (const row of data) {
        // Try to find epic/project name in various column formats
        const epicName =
          row['Epic'] ||
          row['Epic Name'] ||
          row['Project'] ||
          row['Project Name'] ||
          row['Epic Link'] ||
          'Imported Project';

        if (!projectMap.has(epicName)) {
          projectMap.set(epicName, []);
        }
        projectMap.get(epicName)!.push(row);
      }
    }

    logger.info(`Found ${projectMap.size} unique projects/epics`);

    // Import each project and its tasks
    for (const [epicName, tasks] of projectMap.entries()) {
      try {
        // Determine project start and end dates from tasks
        const taskDates = tasks
          .map((t) => ({
            start: parseDate(
              t['Start Date'] || t['Start'] || t['start'] || t['Created'] || t['Created Date']
            ),
            end: parseDate(
              t['End Date'] || t['Finish'] || t['finish'] || t['End'] || t['end'] || t['Due Date'] || t['Due']
            ),
          }))
          .filter((d) => d.start || d.end);

        const startDates = taskDates.map((d) => d.start).filter(Boolean) as Date[];
        const endDates = taskDates.map((d) => d.end).filter(Boolean) as Date[];

        const projectStartDate = startDates.length > 0 ? new Date(Math.min(...startDates.map((d) => d.getTime()))) : new Date();
        const projectEndDate = endDates.length > 0 ? new Date(Math.max(...endDates.map((d) => d.getTime()))) : undefined;

        // Create or update project
        let project = await prisma.project.findFirst({
          where: {
            name: epicName,
            organizationId,
          },
        });

        if (project) {
          project = await prisma.project.update({
            where: { id: project.id },
            data: {
              startDate: projectStartDate,
              endDate: projectEndDate,
            },
          });
          logger.info(`Updated existing project: ${epicName}`);
        } else {
          project = await prisma.project.create({
            data: {
              organizationId,
              name: epicName,
              description: `Imported from Excel - ${tasks.length} tasks`,
              status: 'active',
              priority: 'medium',
              startDate: projectStartDate,
              endDate: projectEndDate,
              createdBy: userId,
            },
          });
          result.projectsImported++;
          logger.info(`Created new project: ${epicName}`);
        }

        // Import tasks
        for (const taskRow of tasks) {
          try {
            const taskId =
              taskRow['Issue Key'] ||
              taskRow['Key'] ||
              taskRow['Task ID'] ||
              taskRow['ID'] ||
              taskRow['Issue ID'];

            let taskTitle =
              taskRow['Task Name'] ||
              taskRow['Task name'] ||
              taskRow['Summary'] ||
              taskRow['Task Summary'] ||
              taskRow['Title'] ||
              taskRow['Issue Summary'] ||
              taskRow['Subject'] ||
              'Imported Task';

            // Trim whitespace from task title to handle hierarchical indentation in Excel files
            taskTitle = taskTitle.trim();

            const taskDescription =
              taskRow['Description'] ||
              taskRow['Task Description'] ||
              taskRow['Details'] ||
              taskRow['Notes'] ||
              '';

            // Calculate status from % Complete for MS Project files
            let status = 'todo';
            if (taskRow['% Complete'] !== undefined) {
              const percentComplete = typeof taskRow['% Complete'] === 'number'
                ? taskRow['% Complete']
                : parseFloat(String(taskRow['% Complete']));

              if (!isNaN(percentComplete)) {
                if (percentComplete >= 1 || percentComplete === 100) {
                  status = 'completed';
                } else if (percentComplete > 0) {
                  status = 'in_progress';
                }
              }
            } else {
              status = mapStatus(
                taskRow['Status'] ||
                  taskRow['Task Status'] ||
                  taskRow['State'] ||
                  ''
              );
            }

            const priority = mapPriority(
              taskRow['Priority'] ||
                taskRow['Task Priority'] ||
                'Medium'
            );

            const taskType = mapTaskType(
              taskRow['Type'] ||
                taskRow['Issue Type'] ||
                taskRow['Task Type'] ||
                'Task'
            );

            const startDate = parseDate(
              taskRow['Start'] ||
                taskRow['start'] ||
                taskRow['Start Date'] ||
                taskRow['Created'] ||
                taskRow['Created Date']
            );

            let endDate = parseDate(
              taskRow['Finish'] ||
                taskRow['finish'] ||
                taskRow['End'] ||
                taskRow['end'] ||
                taskRow['End Date'] ||
                taskRow['Due Date'] ||
                taskRow['Due']
            );

            // Extract baseline and actual work hours
            let estimatedHours = 40; // Default
            let actualHours = 0;
            let estimatedCost = 0; // Baseline Cost
            let actualCost = 0; // Actual Cost

            // Parse Baseline Work (format: "3,411.93 hrs" or number)
            if (taskRow['Baseline Work']) {
              const baselineStr = String(taskRow['Baseline Work']);
              const match = baselineStr.match(/[\d,]+\.?\d*/);
              if (match) {
                const value = parseFloat(match[0].replace(/,/g, ''));
                if (!isNaN(value)) {
                  estimatedHours = value;
                }
              }
            }

            // Parse Actual Work (format: "1,174.98 hrs" or number)
            if (taskRow['Actual Work']) {
              const actualStr = String(taskRow['Actual Work']);
              const match = actualStr.match(/[\d,]+\.?\d*/);
              if (match) {
                const value = parseFloat(match[0].replace(/,/g, ''));
                if (!isNaN(value)) {
                  actualHours = value;
                }
              }
            }

            // Parse Baseline Cost (format: "$265,735.20" or number)
            if (taskRow['Baseline Cost']) {
              const baselineCostStr = String(taskRow['Baseline Cost']);
              const match = baselineCostStr.match(/[\d,]+\.?\d*/);
              if (match) {
                const value = parseFloat(match[0].replace(/,/g, ''));
                if (!isNaN(value)) {
                  estimatedCost = value;
                }
              }
            }

            // Parse Actual Cost (format: "$114,124.77" or number)
            if (taskRow['Actual Cost']) {
              const actualCostStr = String(taskRow['Actual Cost']);
              const match = actualCostStr.match(/[\d,]+\.?\d*/);
              if (match) {
                const value = parseFloat(match[0].replace(/,/g, ''));
                if (!isNaN(value)) {
                  actualCost = value;
                }
              }
            }

            // If no end date and we have start date + estimated hours, calculate it
            if (!endDate && startDate && estimatedHours > 0) {
              const durationDays = Math.ceil(estimatedHours / 8);
              endDate = new Date(startDate);
              endDate.setDate(endDate.getDate() + durationDays);
            }

            // Check if task already exists
            let task = await prisma.task.findFirst({
              where: {
                projectId: project.id,
                title: taskTitle,
              },
            });

            if (task) {
              // Update existing task
              await prisma.task.update({
                where: { id: task.id },
                data: {
                  description: taskDescription,
                  status,
                  priority,
                  taskType,
                  startDate,
                  endDate,
                  estimatedHours: estimatedHours || 40,
                  actualHours: actualHours || 0,
                  estimatedCost: estimatedCost || 0,
                  actualCost: actualCost || 0,
                },
              });
            } else {
              // Create new task
              await prisma.task.create({
                data: {
                  projectId: project.id,
                  title: taskTitle,
                  description: taskDescription,
                  status,
                  priority,
                  taskType,
                  assignedTo: userId,
                  createdBy: userId,
                  startDate,
                  endDate,
                  estimatedHours: estimatedHours || 40,
                  actualHours: actualHours || 0,
                  estimatedCost: estimatedCost || 0,
                  actualCost: actualCost || 0,
                  jiraIssueKey: taskId?.toString(),
                },
              });
              result.tasksImported++;
            }
          } catch (taskError: any) {
            logger.error(`Failed to import task: ${taskError.message}`);
            result.errors.push(`Task import error: ${taskError.message}`);
          }
        }

        // After importing all tasks, aggregate costs to project level
        const projectTasks = await prisma.task.findMany({
          where: { projectId: project.id },
          select: {
            estimatedCost: true,
            actualCost: true,
          },
        });

        const totalBudget = projectTasks.reduce((sum, task) => sum + Number(task.estimatedCost || 0), 0);
        const totalActualCost = projectTasks.reduce((sum, task) => sum + Number(task.actualCost || 0), 0);

        // Update project with aggregated costs
        await prisma.project.update({
          where: { id: project.id },
          data: {
            budget: totalBudget,
            actualCost: totalActualCost,
          },
        });

        logger.info(`Project "${epicName}" - Budget: $${totalBudget}, Actual: $${totalActualCost}`);

      } catch (projectError: any) {
        logger.error(`Failed to import project ${epicName}: ${projectError.message}`);
        result.errors.push(`Project ${epicName}: ${projectError.message}`);
      }
    }

    logger.info(
      `Excel import completed: ${result.projectsImported} projects, ${result.tasksImported} tasks, ${result.errors.length} errors`
    );
  } catch (error: any) {
    logger.error('Excel import failed:', error);
    result.errors.push(`Import failed: ${error.message}`);
  }

  return result;
}

/**
 * Parse date from various formats
 */
function parseDate(value: any): Date | undefined {
  if (!value) return undefined;

  // If it's already a Date object
  if (value instanceof Date) {
    return value;
  }

  // Try parsing as string
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try parsing as Excel serial date number
  if (typeof value === 'number') {
    // Excel dates are stored as days since 1900-01-01
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return undefined;
}

/**
 * Map JIRA/Excel status to our status
 */
function mapStatus(status: string): string {
  const statusLower = status.toLowerCase().trim();

  if (statusLower.includes('done') || statusLower.includes('closed') || statusLower.includes('complete')) {
    return 'completed';
  }
  if (statusLower.includes('progress') || statusLower.includes('development') || statusLower.includes('in dev')) {
    return 'in_progress';
  }
  if (statusLower.includes('review') || statusLower.includes('testing') || statusLower.includes('qa')) {
    return 'review';
  }
  if (statusLower.includes('blocked') || statusLower.includes('hold')) {
    return 'blocked';
  }

  return 'todo';
}

/**
 * Map JIRA/Excel priority to our priority
 */
function mapPriority(priority: string): string {
  const priorityLower = priority.toLowerCase().trim();

  if (
    priorityLower.includes('high') ||
    priorityLower.includes('critical') ||
    priorityLower.includes('blocker') ||
    priorityLower.includes('urgent')
  ) {
    return 'high';
  }
  if (priorityLower.includes('low') || priorityLower.includes('trivial') || priorityLower.includes('minor')) {
    return 'low';
  }

  return 'medium';
}

/**
 * Map JIRA/Excel task type to our task type
 */
function mapTaskType(type: string): string {
  const typeLower = type.toLowerCase().trim();

  if (typeLower.includes('bug') || typeLower.includes('defect')) {
    return 'bug';
  }
  if (typeLower.includes('epic') || typeLower.includes('milestone')) {
    return 'milestone';
  }

  return 'task';
}

export interface CostUpdateResult {
  tasksUpdated: number;
  tasksNotFound: number;
  totalBudget: number;
  totalActualCost: number;
  errors: string[];
}

/**
 * Update only cost data from Excel file for existing tasks
 * This is a safer operation that won't modify task titles, dates, or statuses
 */
export async function updateCostsFromExcel(
  fileBuffer: Buffer,
  projectId: string
): Promise<CostUpdateResult> {
  const result: CostUpdateResult = {
    tasksUpdated: 0,
    tasksNotFound: 0,
    totalBudget: 0,
    totalActualCost: 0,
    errors: [],
  };

  try {
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      result.errors.push('Project not found');
      return result;
    }

    // Parse Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      result.errors.push('Excel file is empty');
      return result;
    }

    logger.info(`Updating costs from Excel file with ${data.length} rows for project ${projectId}`);

    // Log the column names found in the Excel file
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      logger.info(`Excel columns found: ${columns.join(', ')}`);
    }

    // Skip first row if it's MS Project format (project summary row)
    const isMSProject = data.length > 0 &&
      (data[0]['Task Name'] || data[0]['Task name']) &&
      (data[0]['Start'] || data[0]['start']);

    const taskRows = isMSProject ? data.slice(1) : data;
    logger.info(`Processing ${taskRows.length} task rows (MS Project format: ${isMSProject})`);

    // Process each row
    for (const taskRow of taskRows) {
      try {
        let taskTitle =
          taskRow['Task Name'] ||
          taskRow['Task name'] ||
          taskRow['Summary'] ||
          taskRow['Task Summary'] ||
          taskRow['Title'];

        if (!taskTitle) {
          continue; // Skip rows without task title
        }

        // Trim whitespace from task title to handle hierarchical indentation in Excel files
        taskTitle = taskTitle.trim();

        // Parse cost values
        let estimatedCost = 0;
        let actualCost = 0;
        let estimatedHours = 0;
        let actualHours = 0;

        // Parse Baseline Cost (format: "$265,735.20" or number)
        if (taskRow['Baseline Cost']) {
          const baselineCostStr = String(taskRow['Baseline Cost']);
          const match = baselineCostStr.match(/[\d,]+\.?\d*/);
          if (match) {
            const value = parseFloat(match[0].replace(/,/g, ''));
            if (!isNaN(value)) {
              estimatedCost = value;
            }
          }
        }

        // Parse Actual Cost (format: "$114,124.77" or number)
        if (taskRow['Actual Cost']) {
          const actualCostStr = String(taskRow['Actual Cost']);
          const match = actualCostStr.match(/[\d,]+\.?\d*/);
          if (match) {
            const value = parseFloat(match[0].replace(/,/g, ''));
            if (!isNaN(value)) {
              actualCost = value;
            }
          }
        }

        // Parse Baseline Work hours
        if (taskRow['Baseline Work']) {
          const baselineStr = String(taskRow['Baseline Work']);
          const match = baselineStr.match(/[\d,]+\.?\d*/);
          if (match) {
            const value = parseFloat(match[0].replace(/,/g, ''));
            if (!isNaN(value)) {
              estimatedHours = value;
            }
          }
        }

        // Parse Actual Work hours
        if (taskRow['Actual Work']) {
          const actualStr = String(taskRow['Actual Work']);
          const match = actualStr.match(/[\d,]+\.?\d*/);
          if (match) {
            const value = parseFloat(match[0].replace(/,/g, ''));
            if (!isNaN(value)) {
              actualHours = value;
            }
          }
        }

        // Find existing task by title (trimmed to match database entries)
        const existingTask = await prisma.task.findFirst({
          where: {
            projectId,
            title: taskTitle,
          },
        });

        if (existingTask) {
          // Update only cost-related fields
          await prisma.task.update({
            where: { id: existingTask.id },
            data: {
              estimatedCost,
              actualCost,
              estimatedHours: estimatedHours > 0 ? estimatedHours : existingTask.estimatedHours,
              actualHours: actualHours > 0 ? actualHours : existingTask.actualHours,
            },
          });
          result.tasksUpdated++;
          logger.debug(`Updated costs for task "${taskTitle}": budget=$${estimatedCost}, actual=$${actualCost}`);
        } else {
          result.tasksNotFound++;
          logger.debug(`Task not found: "${taskTitle}"`);
        }
      } catch (taskError: any) {
        logger.error(`Failed to update task costs: ${taskError.message}`);
        result.errors.push(`Task cost update error: ${taskError.message}`);
      }
    }

    // Aggregate costs to project level
    const projectTasks = await prisma.task.findMany({
      where: { projectId },
      select: {
        estimatedCost: true,
        actualCost: true,
      },
    });

    result.totalBudget = projectTasks.reduce((sum, task) => sum + Number(task.estimatedCost || 0), 0);
    result.totalActualCost = projectTasks.reduce((sum, task) => sum + Number(task.actualCost || 0), 0);

    // Update project with aggregated costs
    await prisma.project.update({
      where: { id: projectId },
      data: {
        budget: result.totalBudget,
        actualCost: result.totalActualCost,
      },
    });

    logger.info(
      `Cost update completed: ${result.tasksUpdated} updated, ${result.tasksNotFound} not found, Budget: $${result.totalBudget}, Actual: $${result.totalActualCost}`
    );
  } catch (error: any) {
    logger.error('Cost update from Excel failed:', error);
    result.errors.push(`Update failed: ${error.message}`);
  }

  return result;
}

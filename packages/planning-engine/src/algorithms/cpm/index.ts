import { CPMTask, CPMResult } from '../../types/index.js';
import { addWorkingDays } from '../../utils/dateUtils.js';

/**
 * Critical Path Method (CPM) Algorithm
 * Calculates the critical path and schedule for a set of tasks with dependencies
 *
 * Steps:
 * 1. Forward Pass: Calculate earliest start/finish times
 * 2. Backward Pass: Calculate latest start/finish times
 * 3. Calculate slack (float)
 * 4. Identify critical path (tasks with zero slack)
 *
 * @param tasks Array of tasks with dependencies
 * @param projectStartDate Start date of the project
 * @returns Array of CPM results for each task
 */
export function calculateCPM(tasks: CPMTask[], projectStartDate: Date): CPMResult[] {
  // Build task map for quick lookup
  const taskMap = new Map<string, CPMTask>();
  tasks.forEach((task) => taskMap.set(task.id, task));

  // Build dependency graph
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();

  tasks.forEach((task) => {
    if (!predecessors.has(task.id)) {
      predecessors.set(task.id, []);
    }
    predecessors.set(task.id, task.dependencies);

    task.dependencies.forEach((depId) => {
      if (!successors.has(depId)) {
        successors.set(depId, []);
      }
      successors.get(depId)!.push(task.id);
    });
  });

  // Initialize results
  const results = new Map<string, CPMResult>();

  // FORWARD PASS: Calculate earliest start/finish times
  const visited = new Set<string>();
  const forwardPass = (taskId: string): void => {
    if (visited.has(taskId)) return;

    const task = taskMap.get(taskId);
    if (!task) return;

    // Ensure all predecessors are processed first
    for (const predId of task.dependencies) {
      if (!visited.has(predId)) {
        forwardPass(predId);
      }
    }

    // Calculate earliest start
    let earliestStart = projectStartDate;

    if (task.dependencies.length > 0) {
      // ES = max(EF of all predecessors)
      const predecessorFinishes = task.dependencies
        .map((depId) => results.get(depId)?.earliestFinish)
        .filter((date): date is Date => date !== undefined);

      if (predecessorFinishes.length > 0) {
        earliestStart = new Date(
          Math.max(...predecessorFinishes.map((d) => d.getTime()))
        );
      }
    }

    // Calculate earliest finish
    // EF = ES + duration
    const earliestFinish = addWorkingDays(earliestStart, task.duration);

    results.set(taskId, {
      taskId,
      earliestStart,
      earliestFinish,
      latestStart: new Date(0), // Will be calculated in backward pass
      latestFinish: new Date(0),
      slack: 0,
      isCritical: false,
    });

    visited.add(taskId);
  };

  // Process all tasks in forward pass
  tasks.forEach((task) => forwardPass(task.id));

  // Find project end date (maximum earliest finish)
  const projectEndDate = new Date(
    Math.max(...Array.from(results.values()).map((r) => r.earliestFinish.getTime()))
  );

  // BACKWARD PASS: Calculate latest start/finish times
  const backwardVisited = new Set<string>();
  const backwardPass = (taskId: string): void => {
    if (backwardVisited.has(taskId)) return;

    const task = taskMap.get(taskId);
    if (!task) return;

    const result = results.get(taskId);
    if (!result) return;

    // Get successors for this task
    const taskSuccessors = successors.get(taskId) || [];

    // Ensure all successors are processed first
    for (const succId of taskSuccessors) {
      if (!backwardVisited.has(succId)) {
        backwardPass(succId);
      }
    }

    // Calculate latest finish
    let latestFinish = projectEndDate;

    if (taskSuccessors.length > 0) {
      // LF = min(LS of all successors)
      const successorStarts = taskSuccessors
        .map((succId) => results.get(succId)?.latestStart)
        .filter((date): date is Date => date !== undefined);

      if (successorStarts.length > 0) {
        latestFinish = new Date(Math.min(...successorStarts.map((d) => d.getTime())));
      }
    }

    // Calculate latest start
    // LS = LF - duration
    const latestStart = addWorkingDays(latestFinish, -task.duration);

    // Update result
    result.latestStart = latestStart;
    result.latestFinish = latestFinish;

    backwardVisited.add(taskId);
  };

  // Process all tasks in backward pass (start from tasks with no successors)
  tasks.forEach((task) => backwardPass(task.id));

  // CALCULATE SLACK AND IDENTIFY CRITICAL PATH
  results.forEach((result) => {
    // Slack (Total Float) = LS - ES or LF - EF
    const slackMs = result.latestStart.getTime() - result.earliestStart.getTime();
    result.slack = slackMs / (1000 * 60 * 60 * 24); // Convert to days

    // Critical path tasks have zero or near-zero slack
    result.isCritical = Math.abs(result.slack) < 0.01; // Allow for floating point errors
  });

  return Array.from(results.values());
}

/**
 * Get the critical path as an ordered array of task IDs
 *
 * @param cpmResults Results from calculateCPM
 * @param tasks Original task array
 * @returns Array of task IDs in the critical path
 */
export function getCriticalPath(cpmResults: CPMResult[], tasks: CPMTask[]): string[] {
  const criticalTasks = cpmResults.filter((r) => r.isCritical);
  const taskMap = new Map<string, CPMTask>();
  tasks.forEach((task) => taskMap.set(task.id, task));

  // Sort critical tasks by earliest start time
  return criticalTasks
    .sort((a, b) => a.earliestStart.getTime() - b.earliestStart.getTime())
    .map((r) => r.taskId);
}

/**
 * Calculate the project duration based on CPM results
 *
 * @param cpmResults Results from calculateCPM
 * @returns Project duration in days
 */
export function getProjectDuration(cpmResults: CPMResult[]): number {
  if (cpmResults.length === 0) return 0;

  const criticalPath = cpmResults.filter((r) => r.isCritical);
  if (criticalPath.length === 0) return 0;

  // Find the latest finish date among critical tasks
  const latestFinish = new Date(
    Math.max(...criticalPath.map((r) => r.earliestFinish.getTime()))
  );

  // Find the earliest start date among all tasks
  const earliestStart = new Date(
    Math.min(...cpmResults.map((r) => r.earliestStart.getTime()))
  );

  // Calculate duration in days
  const durationMs = latestFinish.getTime() - earliestStart.getTime();
  return durationMs / (1000 * 60 * 60 * 24);
}

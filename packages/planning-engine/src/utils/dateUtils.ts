import { addDays, startOfDay } from 'date-fns';

/**
 * Add working days to a date (excludes weekends)
 */
export function addWorkingDays(date: Date, days: number): Date {
  let current = startOfDay(date);
  let remaining = days;

  while (remaining > 0) {
    current = addDays(current, 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      remaining--;
    }
  }

  return current;
}

/**
 * Calculate working days between two dates (excludes weekends)
 */
export function getWorkingDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  let current = startOfDay(startDate);
  const end = startOfDay(endDate);

  while (current < end) {
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      count++;
    }
    current = addDays(current, 1);
  }

  return count;
}

/**
 * Convert hours to days (assuming 8-hour workday)
 */
export function hoursToDays(hours: number): number {
  return hours / 8;
}

/**
 * Convert days to hours (assuming 8-hour workday)
 */
export function daysToHours(days: number): number {
  return days * 8;
}

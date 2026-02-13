import { PERTEstimate, PERTResult } from '../../types/index.js';

/**
 * Calculate PERT estimates for a task
 * PERT uses three-point estimation to calculate expected time and variance
 *
 * Expected Time (TE) = (O + 4M + P) / 6
 * Variance = ((P - O) / 6)²
 * Standard Deviation = √Variance
 *
 * @param estimate Three-point estimate (optimistic, most likely, pessimistic)
 * @returns PERT calculation results
 */
export function calculatePERT(estimate: PERTEstimate): PERTResult {
  const { optimistic, mostLikely, pessimistic } = estimate;

  // Validate inputs
  if (optimistic < 0 || mostLikely < 0 || pessimistic < 0) {
    throw new Error('All estimates must be non-negative');
  }

  if (optimistic > mostLikely || mostLikely > pessimistic) {
    throw new Error('Estimates must satisfy: Optimistic ≤ Most Likely ≤ Pessimistic');
  }

  // Calculate expected time using weighted average
  const expected = (optimistic + 4 * mostLikely + pessimistic) / 6;

  // Calculate variance
  const variance = Math.pow((pessimistic - optimistic) / 6, 2);

  // Calculate standard deviation
  const stdDev = Math.sqrt(variance);

  // Calculate confidence intervals (assuming normal distribution)
  // 68% confidence interval (±1 standard deviation)
  const confidence68 = {
    min: expected - stdDev,
    max: expected + stdDev,
  };

  // 95% confidence interval (±2 standard deviations)
  const confidence95 = {
    min: expected - 2 * stdDev,
    max: expected + 2 * stdDev,
  };

  return {
    expected,
    variance,
    stdDev,
    confidence68,
    confidence95,
  };
}

/**
 * Aggregate PERT estimates for multiple tasks
 */
export function aggregatePERT(estimates: PERTResult[]): PERTResult {
  const totalExpected = estimates.reduce((sum, e) => sum + e.expected, 0);
  const totalVariance = estimates.reduce((sum, e) => sum + e.variance, 0);
  const totalStdDev = Math.sqrt(totalVariance);

  return {
    expected: totalExpected,
    variance: totalVariance,
    stdDev: totalStdDev,
    confidence68: {
      min: totalExpected - totalStdDev,
      max: totalExpected + totalStdDev,
    },
    confidence95: {
      min: totalExpected - 2 * totalStdDev,
      max: totalExpected + 2 * totalStdDev,
    },
  };
}

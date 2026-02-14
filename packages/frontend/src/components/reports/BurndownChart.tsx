import { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  TextField,
  Stack,
  Button,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  TrendingDown as TrendingDownIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import type { Task } from '@pm-app/shared';
import { format, differenceInDays, addDays, startOfDay, isBefore, isAfter } from 'date-fns';

interface BurndownChartProps {
  tasks: Task[];
  projectStartDate: Date;
  projectEndDate?: Date;
}

interface BurndownData {
  date: string;
  dateObj: Date;
  idealRemaining: number;
  actualRemaining: number | null;
}

// Helper function to format hours as years + days + hours
// Assumes 8 hours/day and 250 working days/year (2000 hours/year)
function formatHours(hours: number): string {
  if (hours < 8) {
    return `${hours.toFixed(2)}h`;
  }

  const HOURS_PER_DAY = 8;
  const HOURS_PER_YEAR = 2000; // 250 working days * 8 hours

  // Calculate years
  const years = Math.floor(hours / HOURS_PER_YEAR);
  let remaining = hours - (years * HOURS_PER_YEAR);

  // Calculate days from remaining hours
  const days = Math.floor(remaining / HOURS_PER_DAY);
  remaining = remaining - (days * HOURS_PER_DAY);

  const remainingHours = remaining;

  // Build the string based on what we have
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (days > 0) parts.push(`${days}d`);
  if (remainingHours >= 0.1) parts.push(`${remainingHours.toFixed(1)}h`);

  // If no parts (less than 0.1 hours), return just hours
  if (parts.length === 0) {
    return years > 0 ? `${years}y` : days > 0 ? `${days}d` : '0h';
  }

  return parts.join(' ');
}

function BurndownChart({ tasks, projectStartDate, projectEndDate }: BurndownChartProps) {
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  const burndownData = useMemo(() => {
    if (tasks.length === 0) return [];

    // Calculate total estimated hours
    const totalHours = tasks.reduce((sum, task) => {
      const hours = Number(task.estimatedHours || task.expectedHours || 0);
      return sum + (isNaN(hours) ? 0 : hours);
    }, 0);

    if (totalHours === 0) return [];

    // Determine date range
    const startDate = startOfDay(new Date(projectStartDate));
    const endDate = projectEndDate
      ? startOfDay(new Date(projectEndDate))
      : tasks.reduce((latest, task) => {
          const taskEnd = task.endDate ? new Date(task.endDate) : new Date();
          return isAfter(taskEnd, latest) ? taskEnd : latest;
        }, startDate);

    const today = startOfDay(new Date());
    const totalDays = differenceInDays(endDate, startDate);

    if (totalDays <= 0) return [];

    const data: BurndownData[] = [];

    // Build daily burndown data
    for (let i = 0; i <= totalDays; i++) {
      const currentDate = addDays(startDate, i);
      const isInPast = isBefore(currentDate, today) || currentDate.getTime() === today.getTime();

      // Ideal remaining (linear burndown)
      const idealRemaining = totalHours * (1 - i / totalDays);

      // Actual remaining (only for past/today dates)
      let actualRemaining: number | null = null;
      if (isInPast) {
        // Calculate completed hours up to this date
        const completedHours = tasks.reduce((sum, task) => {
          if (task.status === 'completed' && task.endDate) {
            const taskEndDate = startOfDay(new Date(task.endDate));
            if (isBefore(taskEndDate, currentDate) || taskEndDate.getTime() === currentDate.getTime()) {
              const hours = Number(task.estimatedHours || task.expectedHours || 0);
              return sum + (isNaN(hours) ? 0 : hours);
            }
          }
          return sum;
        }, 0);

        actualRemaining = totalHours - completedHours;
      }

      data.push({
        date: format(currentDate, 'MMM d'),
        dateObj: currentDate,
        idealRemaining: Math.max(0, idealRemaining),
        actualRemaining,
      });
    }

    return data;
  }, [tasks, projectStartDate, projectEndDate]);

  // Filter burndown data by date range
  const filteredBurndownData = useMemo(() => {
    if (burndownData.length === 0) return [];
    if (!filterStartDate && !filterEndDate) return burndownData;

    const startFilter = filterStartDate ? new Date(filterStartDate) : null;
    const endFilter = filterEndDate ? new Date(filterEndDate) : null;

    return burndownData.filter((item) => {
      if (startFilter && isBefore(item.dateObj, startFilter)) return false;
      if (endFilter && isAfter(item.dateObj, endFilter)) return false;
      return true;
    });
  }, [burndownData, filterStartDate, filterEndDate]);

  // Calculate statistics (respecting date range filter)
  const statistics = useMemo(() => {
    const dataSource = filteredBurndownData.length > 0 ? filteredBurndownData : burndownData;

    if (dataSource.length === 0) {
      return {
        totalHours: 0,
        completedHours: 0,
        remainingHours: 0,
        percentComplete: 0,
        isAhead: false,
        variance: 0,
      };
    }

    const totalHours = tasks.reduce((sum, task) => {
      const hours = Number(task.estimatedHours || task.expectedHours || 0);
      return sum + (isNaN(hours) ? 0 : hours);
    }, 0);

    const completedHours = tasks.reduce((sum, task) => {
      if (task.status === 'completed') {
        const hours = Number(task.estimatedHours || task.expectedHours || 0);
        return sum + (isNaN(hours) ? 0 : hours);
      }
      return sum;
    }, 0);

    const remainingHours = totalHours - completedHours;
    const percentComplete = totalHours > 0 ? (completedHours / totalHours) * 100 : 0;

    // Find the last data point in the filtered range
    const today = startOfDay(new Date());
    const lastDataPoint = dataSource[dataSource.length - 1];
    const referenceData = lastDataPoint || burndownData.find((d) => d.dateObj.getTime() === today.getTime());

    let isAhead = false;
    let variance = 0;

    if (referenceData && referenceData.actualRemaining !== null) {
      variance = referenceData.idealRemaining - referenceData.actualRemaining;
      isAhead = variance < 0; // Ahead if actual is less than ideal (completed more)
    }

    return {
      totalHours,
      completedHours,
      remainingHours,
      percentComplete: Math.round(percentComplete),
      isAhead,
      variance: Math.abs(variance),
    };
  }, [burndownData, filteredBurndownData, tasks]);

  const handleResetFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
  };

  if (tasks.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingDownIcon />
          Burndown Chart
        </Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          No tasks available. Add tasks with estimated hours to see the burndown chart.
        </Alert>
      </Paper>
    );
  }

  if (burndownData.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingDownIcon />
          Burndown Chart
        </Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>
          Unable to generate burndown chart. Ensure tasks have start dates, end dates, and estimated hours.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrendingDownIcon />
        Burndown Chart
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Track project progress against the ideal burndown rate
      </Typography>

      {/* Date Range Filter */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          type="date"
          label="Start Date"
          value={filterStartDate}
          onChange={(e) => setFilterStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ flex: 1, maxWidth: { xs: '100%', sm: 250 } }}
        />
        <TextField
          type="date"
          label="End Date"
          value={filterEndDate}
          onChange={(e) => setFilterEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ flex: 1, maxWidth: { xs: '100%', sm: 250 } }}
        />
        <Button
          variant="outlined"
          onClick={handleResetFilters}
          disabled={!filterStartDate && !filterEndDate}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
        >
          Reset
        </Button>
      </Stack>

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ScheduleIcon color="primary" fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  Total Hours
                </Typography>
              </Box>
              <Typography variant="h5">{formatHours(statistics.totalHours)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  Completed
                </Typography>
              </Box>
              <Typography variant="h5" color="success.main">
                {formatHours(statistics.completedHours)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({statistics.percentComplete}%)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingDownIcon color="warning" fontSize="small" />
                <Typography variant="caption" color="text.secondary">
                  Remaining
                </Typography>
              </Box>
              <Typography variant="h5" color="warning.main">
                {formatHours(statistics.remainingHours)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
              </Box>
              <Typography
                variant="h6"
                color={statistics.isAhead ? 'success.main' : 'warning.main'}
                sx={{ fontSize: '1.1rem' }}
              >
                {statistics.isAhead ? '✓ Ahead' : '⚠ Behind'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {statistics.variance.toFixed(1)}h variance
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Burndown Chart */}
      <Box sx={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <LineChart
            data={filteredBurndownData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="date"
              stroke="#666"
              style={{ fontSize: '0.75rem' }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#666"
              style={{ fontSize: '0.75rem' }}
              label={{ value: 'Hours Remaining', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
              formatter={(value: any) => {
                if (value === null) return ['N/A', ''];
                return [`${value.toFixed(1)}h`, ''];
              }}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />

            {/* Ideal Burndown Line */}
            <Line
              type="monotone"
              dataKey="idealRemaining"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Ideal Burndown"
              dot={false}
            />

            {/* Actual Burndown Line */}
            <Line
              type="monotone"
              dataKey="actualRemaining"
              stroke="#3b82f6"
              strokeWidth={3}
              name="Actual Progress"
              dot={{ fill: '#3b82f6', r: 3 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      {/* Help Text */}
      <Box sx={{ mt: 2, p: 2, backgroundColor: 'info.lighter', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>How to read:</strong> The dashed gray line shows the ideal burndown rate.
          The blue line shows actual progress. If the blue line is below the gray line, you're ahead of schedule.
          If it's above, you're behind schedule.
        </Typography>
      </Box>
    </Paper>
  );
}

export default BurndownChart;

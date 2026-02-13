import { useState, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  InputAdornment,
  Alert,
  Button,
  Stack,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Today as TodayIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { Task } from '@pm-app/shared';
import {
  startOfDay,
  addDays,
  differenceInDays,
  format,
  isWeekend,
  isSameDay,
} from 'date-fns';

interface GanttChartProps {
  tasks: Task[];
  projectStartDate: Date;
  onTaskUpdate?: (taskId: string, newStartDate: Date, newEndDate: Date) => void;
}

type TimeScale = 'day' | 'week' | 'month';

interface GanttTask {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  status: string;
  assignee?: string;
  isCriticalPath: boolean;
  dependencies: string[];
  progress: number;
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  blocked: '#ef4444',
};

function GanttChart({ tasks, projectStartDate, onTaskUpdate }: GanttChartProps) {
  const [timeScale, setTimeScale] = useState<TimeScale>('day');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCount, setShowCount] = useState(100); // Initial limit
  const chartRef = useRef<HTMLDivElement>(null);

  // Filter tasks first
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }

    // Limit to showCount for performance
    return filtered.slice(0, showCount);
  }, [tasks, searchQuery, statusFilter, showCount]);

  // Transform tasks to Gantt format
  const ganttTasks: GanttTask[] = useMemo(() => {
    return filteredTasks.map((task) => {
      const startDate = task.startDate ? new Date(task.startDate) : new Date();
      const durationHours = Number(task.estimatedHours || task.expectedHours || 8);
      const duration = isNaN(durationHours) ? 8 : durationHours;
      const endDate = task.endDate
        ? new Date(task.endDate)
        : addDays(startDate, Math.ceil(duration / 8));

      return {
        id: task.id,
        title: task.title,
        startDate: startOfDay(startDate),
        endDate: startOfDay(endDate),
        status: task.status || 'todo',
        assignee: (task as any).assignee?.name,
        isCriticalPath: (task as any).isCriticalPath || false,
        dependencies: (task as any).predecessorDeps?.map((dep: any) => dep.predecessorTaskId) || [],
        progress: task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0,
      };
    });
  }, [filteredTasks]);

  // Calculate timeline dimensions
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    if (ganttTasks.length === 0) {
      const start = startOfDay(projectStartDate);
      return {
        timelineStart: start,
        timelineEnd: addDays(start, 30),
        totalDays: 30,
      };
    }

    const allDates = ganttTasks.flatMap((t) => [t.startDate, t.endDate]);
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    // Add padding
    const start = addDays(startOfDay(minDate), -2);
    const end = addDays(startOfDay(maxDate), 7);
    const days = differenceInDays(end, start);

    return {
      timelineStart: start,
      timelineEnd: end,
      totalDays: days,
    };
  }, [ganttTasks, projectStartDate]);

  // Calculate column width based on time scale
  const columnWidth = useMemo(() => {
    switch (timeScale) {
      case 'day':
        return 40;
      case 'week':
        return 80;
      case 'month':
        return 120;
      default:
        return 40;
    }
  }, [timeScale]);

  // Generate timeline columns
  const timelineColumns = useMemo(() => {
    const columns: { date: Date; label: string; isToday: boolean }[] = [];
    let currentDate = new Date(timelineStart);

    while (currentDate <= timelineEnd) {
      const isToday = isSameDay(currentDate, new Date());
      let label = '';

      switch (timeScale) {
        case 'day':
          label = format(currentDate, 'EEE d');
          break;
        case 'week':
          label = format(currentDate, 'MMM d');
          break;
        case 'month':
          label = format(currentDate, 'MMM yyyy');
          break;
      }

      columns.push({ date: new Date(currentDate), label, isToday });

      // Increment based on scale
      switch (timeScale) {
        case 'day':
          currentDate = addDays(currentDate, 1);
          break;
        case 'week':
          currentDate = addDays(currentDate, 7);
          break;
        case 'month':
          currentDate = addDays(currentDate, 30);
          break;
      }
    }

    return columns;
  }, [timelineStart, timelineEnd, timeScale]);

  // Calculate task position and width
  const getTaskStyle = (task: GanttTask) => {
    const daysSinceStart = differenceInDays(task.startDate, timelineStart);
    const taskDuration = differenceInDays(task.endDate, task.startDate) || 1;

    const left = (daysSinceStart / totalDays) * (timelineColumns.length * columnWidth);
    const width = (taskDuration / totalDays) * (timelineColumns.length * columnWidth);

    return {
      left: `${left}px`,
      width: `${Math.max(width, 60)}px`,
    };
  };

  const handleTaskDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleTaskDrop = (columnDate: Date) => {
    if (!draggedTask) return;

    const task = ganttTasks.find((t) => t.id === draggedTask);
    if (!task || !onTaskUpdate) {
      setDraggedTask(null);
      return;
    }

    const duration = differenceInDays(task.endDate, task.startDate);
    const newStartDate = columnDate;
    const newEndDate = addDays(columnDate, duration);

    onTaskUpdate(draggedTask, newStartDate, newEndDate);
    setDraggedTask(null);
  };

  const scrollToToday = () => {
    if (!chartRef.current) return;

    const todayColumn = timelineColumns.findIndex((col) => col.isToday);
    if (todayColumn === -1) return;

    const scrollPosition = todayColumn * columnWidth - chartRef.current.clientWidth / 2;
    chartRef.current.scrollTo({ left: scrollPosition, behavior: 'smooth' });
  };

  const rowHeight = 50;
  const chartHeight = ganttTasks.length * rowHeight + 100;

  const hasMoreTasks = tasks.length > showCount || (statusFilter !== 'all' || searchQuery);
  const totalMatchingTasks = useMemo(() => {
    let count = tasks.length;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      count = tasks.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)
      ).length;
    }
    if (statusFilter !== 'all') {
      count = tasks.filter((task) => task.status === statusFilter).length;
    }
    if (searchQuery && statusFilter !== 'all') {
      const query = searchQuery.toLowerCase();
      count = tasks.filter(
        (task) =>
          (task.title.toLowerCase().includes(query) ||
            task.description?.toLowerCase().includes(query)) &&
          task.status === statusFilter
      ).length;
    }
    return count;
  }, [tasks, searchQuery, statusFilter]);

  return (
    <Paper elevation={2} sx={{ p: 2, overflow: 'hidden' }}>
      {/* Performance Warning */}
      {tasks.length > 100 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Large dataset ({tasks.length.toLocaleString()} tasks):</strong> Use the filters below to narrow down the view for better performance.
            Currently showing {ganttTasks.length} of {totalMatchingTasks.toLocaleString()} matching tasks.
          </Typography>
        </Alert>
      )}

      {/* Filter Controls */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1, maxWidth: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Filter by Status</InputLabel>
          <Select
            value={statusFilter}
            label="Filter by Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="todo">To Do</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="blocked">Blocked</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* Header Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Project Timeline</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Scale</InputLabel>
            <Select
              value={timeScale}
              label="Time Scale"
              onChange={(e) => setTimeScale(e.target.value as TimeScale)}
            >
              <MenuItem value="day">Day</MenuItem>
              <MenuItem value="week">Week</MenuItem>
              <MenuItem value="month">Month</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Zoom In">
            <IconButton
              size="small"
              onClick={() => {
                if (timeScale === 'month') setTimeScale('week');
                else if (timeScale === 'week') setTimeScale('day');
              }}
              disabled={timeScale === 'day'}
            >
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton
              size="small"
              onClick={() => {
                if (timeScale === 'day') setTimeScale('week');
                else if (timeScale === 'week') setTimeScale('month');
              }}
              disabled={timeScale === 'month'}
            >
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Scroll to Today">
            <IconButton size="small" onClick={scrollToToday}>
              <TodayIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Gantt Chart */}
      <Box
        ref={chartRef}
        sx={{
          display: 'flex',
          overflow: 'auto',
          height: chartHeight,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          backgroundColor: 'background.paper',
        }}
      >
        {/* Task Names Column */}
        <Box
          sx={{
            minWidth: 250,
            maxWidth: 250,
            borderRight: '2px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            position: 'sticky',
            left: 0,
            zIndex: 2,
          }}
        >
          {/* Header */}
          <Box
            sx={{
              height: 60,
              display: 'flex',
              alignItems: 'center',
              px: 2,
              borderBottom: '2px solid',
              borderColor: 'divider',
              backgroundColor: 'grey.50',
              fontWeight: 'bold',
            }}
          >
            Task Name
          </Box>

          {/* Task Rows */}
          {ganttTasks.map((task, index) => (
            <Box
              key={task.id}
              sx={{
                height: rowHeight,
                display: 'flex',
                alignItems: 'center',
                px: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                backgroundColor: index % 2 === 0 ? 'background.paper' : 'grey.50',
              }}
            >
              <Box sx={{ overflow: 'hidden' }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  {task.title}
                </Typography>
                {task.assignee && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {task.assignee}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Timeline Grid and Task Bars */}
        <Box sx={{
          position: 'relative',
          minWidth: timelineColumns.length * columnWidth,
          backgroundColor: 'background.paper',
        }}>
          {/* Timeline Header */}
          <Box
            sx={{
              height: 60,
              display: 'flex',
              borderBottom: '2px solid',
              borderColor: 'divider',
              backgroundColor: 'grey.50',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            {timelineColumns.map((column, index) => (
              <Box
                key={index}
                sx={{
                  width: columnWidth,
                  minWidth: columnWidth,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: column.isToday ? 'primary.light' : 'transparent',
                  color: column.isToday ? 'primary.contrastText' : 'text.primary',
                  fontWeight: column.isToday ? 'bold' : 'normal',
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleTaskDrop(column.date)}
              >
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  {column.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Task Bars */}
          {ganttTasks.map((task, index) => {
            const style = getTaskStyle(task);
            const backgroundColor = task.isCriticalPath
              ? '#ef4444'
              : STATUS_COLORS[task.status] || '#94a3b8';

            return (
              <Box
                key={task.id}
                sx={{
                  position: 'absolute',
                  top: 60 + index * rowHeight,
                  height: rowHeight,
                  pointerEvents: 'none',
                }}
              >
                {/* Task Bar */}
                <Box
                  draggable={!!onTaskUpdate}
                  onDragStart={() => handleTaskDragStart(task.id)}
                  sx={{
                    position: 'absolute',
                    ...style,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    height: 32,
                    backgroundColor,
                    borderRadius: 1,
                    cursor: onTaskUpdate ? 'grab' : 'default',
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    px: 1,
                    boxShadow: draggedTask === task.id ? 4 : 1,
                    opacity: draggedTask === task.id ? 0.7 : 1,
                    '&:hover': {
                      boxShadow: 3,
                      opacity: 0.9,
                    },
                  }}
                >
                  <Tooltip title={`${task.title} (${task.progress}%)`}>
                    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'white',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {task.title}
                      </Typography>
                      {task.isCriticalPath && (
                        <Chip
                          label="CP"
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.6rem',
                            backgroundColor: 'rgba(255,255,255,0.3)',
                            color: 'white',
                          }}
                        />
                      )}
                    </Box>
                  </Tooltip>

                  {/* Progress Bar */}
                  {task.progress > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        bottom: 0,
                        height: 3,
                        width: `${task.progress}%`,
                        backgroundColor: 'rgba(255,255,255,0.5)',
                        borderRadius: '0 0 4px 4px',
                      }}
                    />
                  )}
                </Box>
              </Box>
            );
          })}

          {/* Grid Lines */}
          <Box
            sx={{
              position: 'absolute',
              top: 60,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
            }}
          >
            {timelineColumns.map((column, index) => (
              <Box
                key={index}
                sx={{
                  position: 'absolute',
                  left: index * columnWidth,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  backgroundColor: column.isToday ? 'primary.main' : 'divider',
                  opacity: column.isToday ? 0.5 : 0.2,
                }}
              />
            ))}

            {ganttTasks.map((_, index) => (
              <Box
                key={index}
                sx={{
                  position: 'absolute',
                  top: index * rowHeight,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: 'divider',
                  opacity: 0.2,
                }}
              />
            ))}
          </Box>

          {/* Weekend Highlighting */}
          {timeScale === 'day' &&
            timelineColumns.map((column, index) => {
              if (!isWeekend(column.date)) return null;
              return (
                <Box
                  key={`weekend-${index}`}
                  sx={{
                    position: 'absolute',
                    left: index * columnWidth,
                    top: 60,
                    width: columnWidth,
                    bottom: 0,
                    backgroundColor: 'grey.100',
                    opacity: 0.3,
                    pointerEvents: 'none',
                  }}
                />
              );
            })}
        </Box>
      </Box>

      {/* Load More Button */}
      {totalMatchingTasks > ganttTasks.length && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ExpandMoreIcon />}
            onClick={() => setShowCount((prev) => prev + 100)}
          >
            Load More Tasks ({ganttTasks.length} of {totalMatchingTasks.toLocaleString()} shown)
          </Button>
        </Box>
      )}

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 16, height: 16, backgroundColor: '#ef4444', borderRadius: 0.5 }} />
            <Typography variant="caption">Critical Path</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 16, height: 16, backgroundColor: '#3b82f6', borderRadius: 0.5 }} />
            <Typography variant="caption">In Progress</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 16, height: 16, backgroundColor: '#22c55e', borderRadius: 0.5 }} />
            <Typography variant="caption">Completed</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 16, height: 16, backgroundColor: '#94a3b8', borderRadius: 0.5 }} />
            <Typography variant="caption">To Do</Typography>
          </Box>
        </Box>
        {ganttTasks.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            Rendering {ganttTasks.length.toLocaleString()} tasks
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

export default GanttChart;

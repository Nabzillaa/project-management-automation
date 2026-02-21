import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Typography,
  Avatar,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Stack,
  InputAdornment,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Flag as FlagIcon,
  AccountTree as DependencyIcon,
  CloudUpload as ExportIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
} from '@mui/material';
import type { Task, TaskStatus, Priority } from '@pm-app/shared';
import { tasksApi } from '../../services/api/tasks';
import { integrationsApi } from '../../services/api/integrations';
import { useSnackbar } from 'notistack';
import TaskForm from './TaskForm';
import TaskDependencyDialog from './TaskDependencyDialog';

interface TaskListProps {
  tasks: Task[];
  projectId: string;
  onTaskCreated?: () => void;
  onTaskUpdated?: () => void;
  onTaskDeleted?: () => void;
}

const statusColors: Record<TaskStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  todo: 'default',
  in_progress: 'primary',
  review: 'info',
  completed: 'success',
  blocked: 'error',
};

const priorityColors: Record<Priority, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  low: 'info',
  medium: 'default',
  high: 'warning',
  critical: 'error',
};

function TaskList({ tasks, projectId, onTaskCreated, onTaskUpdated, onTaskDeleted }: TaskListProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dependencyDialogOpen, setDependencyDialogOpen] = useState(false);
  const [dependencyTask, setDependencyTask] = useState<Task | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportJiraKey, setExportJiraKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter tasks
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

    return filtered;
  }, [tasks, searchQuery, statusFilter]);

  const createMutation = useMutation({
    mutationFn: (data: any) => tasksApi.create({ ...data, projectId }),
    onSuccess: () => {
      onTaskCreated?.();
      handleFormClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tasksApi.update(id, data),
    onSuccess: () => {
      onTaskUpdated?.();
      handleFormClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      onTaskDeleted?.();
      handleMenuClose();
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTask || !exportJiraKey) {
        throw new Error('Task and JIRA project key are required');
      }
      const organizationId = '00000000-0000-0000-0000-000000000000'; // TODO: Get from context
      const credentials = await integrationsApi.getJiraCredentials(organizationId);
      if (!credentials) {
        throw new Error('JIRA credentials not configured. Please configure them in Settings.');
      }
      return integrationsApi.exportTaskToJira(
        selectedTask.id,
        organizationId,
        exportJiraKey,
        {
          domain: credentials.domain,
          email: credentials.email,
          apiToken: (credentials as any).apiToken,
        }
      );
    },
    onSuccess: (result) => {
      enqueueSnackbar(`Task exported to JIRA issue ${result.issueKey}`, { variant: 'success' });
      handleMenuClose();
      setExportDialogOpen(false);
      setExportJiraKey('');
      onTaskUpdated?.();
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.error || 'Failed to export task to JIRA',
        { variant: 'error' }
      );
    },
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, task: Task) => {
    setAnchorEl(event.currentTarget);
    setSelectedTask(task);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTask(null);
  };

  const handleEdit = () => {
    if (selectedTask) {
      setEditingTask(selectedTask);
      setTaskFormOpen(true);
    }
    handleMenuClose();
  };

  const handleManageDependencies = () => {
    if (selectedTask) {
      setDependencyTask(selectedTask);
      setDependencyDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (selectedTask && window.confirm('Are you sure you want to delete this task?')) {
      deleteMutation.mutate(selectedTask.id);
    } else {
      handleMenuClose();
    }
  };

  const handleExport = () => {
    if (selectedTask && selectedTask.jiraIssueKey) {
      enqueueSnackbar(`Task already exported to JIRA issue ${selectedTask.jiraIssueKey}`, { variant: 'info' });
      handleMenuClose();
      return;
    }
    setExportDialogOpen(true);
    handleMenuClose();
  };

  const handleExportConfirm = () => {
    if (!exportJiraKey.trim()) {
      enqueueSnackbar('Please enter a JIRA project key', { variant: 'warning' });
      return;
    }
    exportMutation.mutate();
  };

  const handleFormClose = () => {
    setTaskFormOpen(false);
    setEditingTask(null);
  };

  const handleTaskSubmit = async (data: any) => {
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Tasks {filteredTasks.length < tasks.length && `(${filteredTasks.length} of ${tasks.length})`}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setTaskFormOpen(true)}
        >
          Add Task
        </Button>
      </Box>

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
          sx={{ flex: 1, maxWidth: { xs: '100%', sm: 300 } }}
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
            <MenuItem value="review">In Review</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="blocked">Blocked</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell align="right">Baseline Work</TableCell>
              <TableCell align="right">Actual Work</TableCell>
              <TableCell align="right">Baseline Cost</TableCell>
              <TableCell align="right">Actual Cost</TableCell>
              <TableCell align="right">Cost Variance</TableCell>
              <TableCell align="center">Critical Path</TableCell>
              <TableCell align="center">Dependencies</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    {searchQuery || statusFilter !== 'all'
                      ? 'No tasks match the current filters. Try adjusting your search or status filter.'
                      : 'No tasks yet. Create your first task to get started.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map((task) => (
                <TableRow key={task.id} hover>
                  <TableCell>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {task.title}
                        </Typography>
                        {task.jiraIssueKey && (
                          <Chip
                            label={`JIRA: ${task.jiraIssueKey}`}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        )}
                      </Box>
                      {task.description && (
                        <Typography variant="caption" color="text.secondary">
                          {task.description.substring(0, 50)}
                          {task.description.length > 50 && '...'}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={task.status.replace('_', ' ')}
                      color={statusColors[task.status]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={task.priority}
                      color={priorityColors[task.priority]}
                      size="small"
                      icon={<FlagIcon />}
                    />
                  </TableCell>
                  <TableCell>
                    {task.assignedTo ? (
                      <Tooltip title={task.assignedTo}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                          {task.assignedTo.substring(0, 2).toUpperCase()}
                        </Avatar>
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Unassigned
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(task.endDate)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {task.estimatedHours ? `${Number(task.estimatedHours).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hrs` : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {task.actualHours ? `${Number(task.actualHours).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hrs` : '0.00 hrs'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {task.estimatedCost ? `$${Number(task.estimatedCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {task.actualCost ? `$${Number(task.actualCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      color={
                        task.estimatedCost && task.actualCost
                          ? (Number(task.estimatedCost) - Number(task.actualCost)) >= 0
                            ? 'success.main'
                            : 'error.main'
                          : 'text.secondary'
                      }
                    >
                      {task.estimatedCost && task.actualCost
                        ? `$${(Number(task.estimatedCost) - Number(task.actualCost)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {task.isCriticalPath && (
                      <Chip label="Critical" color="error" size="small" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {(task as any)._count && (task as any)._count.predecessors > 0 && (
                      <Tooltip title={`${(task as any)._count.predecessors} dependencies`}>
                        <DependencyIcon fontSize="small" color="action" />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, task)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>Edit</MenuItem>
        <MenuItem onClick={handleManageDependencies}>Manage Dependencies</MenuItem>
        <MenuItem onClick={handleExport}>
          Export to JIRA
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          Delete
        </MenuItem>
      </Menu>

      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Task to JIRA</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedTask?.jiraIssueKey && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This task is already linked to JIRA issue {selectedTask.jiraIssueKey}. It will be updated instead of creating a new issue.
            </Alert>
          )}
          <TextField
            fullWidth
            label="JIRA Project Key"
            placeholder="e.g., PROJ"
            value={exportJiraKey}
            onChange={(e) => setExportJiraKey(e.target.value)}
            disabled={exportMutation.isPending}
            helperText="The key of the JIRA project where the issue will be created"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)} disabled={exportMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleExportConfirm}
            variant="contained"
            disabled={exportMutation.isPending}
            startIcon={exportMutation.isPending ? <CircularProgress size={20} /> : <ExportIcon />}
          >
            {exportMutation.isPending ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>

      <TaskForm
        open={taskFormOpen}
        onClose={handleFormClose}
        onSubmit={handleTaskSubmit}
        task={editingTask || undefined}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <TaskDependencyDialog
        open={dependencyDialogOpen}
        onClose={() => setDependencyDialogOpen(false)}
        task={dependencyTask}
        allTasks={tasks}
        onUpdate={onTaskUpdated || (() => {})}
      />
    </Box>
  );
}

export default TaskList;

import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Task, Priority, TaskStatus, TaskType } from '@pm-app/shared';

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['todo', 'in_progress', 'review', 'blocked', 'completed']).optional(),
  taskType: z.enum(['task', 'milestone', 'epic']),
  estimatedHours: z.string().optional(),
  optimisticHours: z.string().optional(),
  mostLikelyHours: z.string().optional(),
  pessimisticHours: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  task?: Task;
  loading?: boolean;
}

function TaskForm({ open, onClose, onSubmit, task, loading }: TaskFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      priority: 'medium',
      status: 'todo',
      taskType: 'task',
    },
  });

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description || '',
        priority: task.priority as Priority,
        status: task.status as TaskStatus,
        taskType: task.taskType as TaskType,
        estimatedHours: task.estimatedHours?.toString() || '',
        optimisticHours: task.optimisticHours?.toString() || '',
        mostLikelyHours: task.mostLikelyHours?.toString() || '',
        pessimisticHours: task.pessimisticHours?.toString() || '',
        startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
        endDate: task.endDate ? new Date(task.endDate).toISOString().split('T')[0] : '',
      });
    } else {
      reset({
        priority: 'medium',
        status: 'todo',
        taskType: 'task',
      });
    }
  }, [task, reset]);

  const handleFormSubmit = async (data: TaskFormData) => {
    const submitData: any = {
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: data.status,
      taskType: data.taskType,
    };

    if (data.estimatedHours) submitData.estimatedHours = parseFloat(data.estimatedHours);
    if (data.optimisticHours) submitData.optimisticHours = parseFloat(data.optimisticHours);
    if (data.mostLikelyHours) submitData.mostLikelyHours = parseFloat(data.mostLikelyHours);
    if (data.pessimisticHours) submitData.pessimisticHours = parseFloat(data.pessimisticHours);
    if (data.startDate) submitData.startDate = new Date(data.startDate).toISOString();
    if (data.endDate) submitData.endDate = new Date(data.endDate).toISOString();

    await onSubmit(submitData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Task Title"
                {...register('title')}
                error={!!errors.title}
                helperText={errors.title?.message}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                {...register('description')}
                error={!!errors.description}
                helperText={errors.description?.message}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                label="Priority"
                defaultValue="medium"
                {...register('priority')}
                error={!!errors.priority}
                helperText={errors.priority?.message}
                disabled={loading}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                label="Status"
                defaultValue="todo"
                {...register('status')}
                error={!!errors.status}
                helperText={errors.status?.message}
                disabled={loading}
              >
                <MenuItem value="todo">To Do</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="review">Review</MenuItem>
                <MenuItem value="blocked">Blocked</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                label="Type"
                defaultValue="task"
                {...register('taskType')}
                error={!!errors.taskType}
                helperText={errors.taskType?.message}
                disabled={loading}
              >
                <MenuItem value="task">Task</MenuItem>
                <MenuItem value="milestone">Milestone</MenuItem>
                <MenuItem value="epic">Epic</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Estimated Hours"
                type="number"
                {...register('estimatedHours')}
                error={!!errors.estimatedHours}
                helperText={errors.estimatedHours?.message}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Optimistic (PERT)"
                type="number"
                {...register('optimisticHours')}
                error={!!errors.optimisticHours}
                helperText={errors.optimisticHours?.message}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Most Likely (PERT)"
                type="number"
                {...register('mostLikelyHours')}
                error={!!errors.mostLikelyHours}
                helperText={errors.mostLikelyHours?.message}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Pessimistic (PERT)"
                type="number"
                {...register('pessimisticHours')}
                error={!!errors.pessimisticHours}
                helperText={errors.pessimisticHours?.message}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                {...register('startDate')}
                error={!!errors.startDate}
                helperText={errors.startDate?.message}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                {...register('endDate')}
                error={!!errors.endDate}
                helperText={errors.endDate?.message}
                disabled={loading}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Saving...' : task ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default TaskForm;

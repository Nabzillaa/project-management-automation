import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  MenuItem,
  Box,
  Typography,
  Autocomplete,
  Chip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import type { Task } from '@pm-app/shared';
import apiClient from '../../services/api/client';

interface TaskDependencyDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  allTasks: Task[];
  onUpdate: () => void;
}

const dependencyTypes = [
  { value: 'finish_to_start', label: 'Finish to Start (FS)' },
  { value: 'start_to_start', label: 'Start to Start (SS)' },
  { value: 'finish_to_finish', label: 'Finish to Finish (FF)' },
  { value: 'start_to_finish', label: 'Start to Finish (SF)' },
];

function TaskDependencyDialog({ open, onClose, task, allTasks, onUpdate }: TaskDependencyDialogProps) {
  const [selectedPredecessor, setSelectedPredecessor] = useState<Task | null>(null);
  const [dependencyType, setDependencyType] = useState('finish_to_start');
  const [lagDays, setLagDays] = useState(0);

  const addDependencyMutation = useMutation({
    mutationFn: async (data: { predecessorTaskId: string; dependencyType: string; lagDays: number }) => {
      const response = await apiClient.post(`/tasks/${task!.id}/dependencies`, data);
      return response.data;
    },
    onSuccess: () => {
      onUpdate();
      setSelectedPredecessor(null);
      setDependencyType('finish_to_start');
      setLagDays(0);
    },
  });

  const removeDependencyMutation = useMutation({
    mutationFn: async (dependencyId: string) => {
      const response = await apiClient.delete(`/tasks/${task!.id}/dependencies/${dependencyId}`);
      return response.data;
    },
    onSuccess: () => {
      onUpdate();
    },
  });

  const handleAddDependency = () => {
    if (selectedPredecessor) {
      addDependencyMutation.mutate({
        predecessorTaskId: selectedPredecessor.id,
        dependencyType,
        lagDays,
      });
    }
  };

  const handleRemoveDependency = (dependencyId: string) => {
    if (window.confirm('Are you sure you want to remove this dependency?')) {
      removeDependencyMutation.mutate(dependencyId);
    }
  };

  // Filter out the current task and tasks that are already dependencies
  const availableTasks = allTasks.filter(t => {
    if (t.id === task?.id) return false;
    const existingDeps = task?.predecessorDeps || [];
    return !existingDeps.some((dep: any) => dep.predecessorTaskId === t.id);
  });

  if (!task) return null;

  const predecessorDeps = task.predecessorDeps || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Manage Dependencies: {task.title}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Existing Dependencies
          </Typography>
          {predecessorDeps.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No dependencies yet. Add predecessor tasks to define the task sequence.
            </Typography>
          ) : (
            <List>
              {predecessorDeps.map((dep: any) => (
                <ListItem key={dep.id}>
                  <ListItemText
                    primary={dep.predecessorTask?.title || 'Unknown Task'}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                        <Chip
                          label={dependencyTypes.find(dt => dt.value === dep.dependencyType)?.label || dep.dependencyType}
                          size="small"
                          variant="outlined"
                        />
                        {dep.lagDays !== 0 && (
                          <Chip
                            label={`Lag: ${dep.lagDays} days`}
                            size="small"
                            color="info"
                          />
                        )}
                        <Chip
                          label={dep.predecessorTask?.status || 'unknown'}
                          size="small"
                          color="default"
                        />
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveDependency(dep.id)}
                      disabled={removeDependencyMutation.isPending}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Add New Dependency
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Autocomplete
              options={availableTasks}
              getOptionLabel={(option) => option.title}
              value={selectedPredecessor}
              onChange={(_, newValue) => setSelectedPredecessor(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Predecessor Task"
                  helperText="This task will wait for the selected task"
                />
              )}
              disabled={addDependencyMutation.isPending}
            />
            <TextField
              select
              label="Dependency Type"
              value={dependencyType}
              onChange={(e) => setDependencyType(e.target.value)}
              disabled={addDependencyMutation.isPending}
            >
              {dependencyTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label="Lag Days"
              value={lagDays}
              onChange={(e) => setLagDays(parseInt(e.target.value) || 0)}
              helperText="Delay after predecessor completes (can be negative for lead time)"
              disabled={addDependencyMutation.isPending}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddDependency}
              disabled={!selectedPredecessor || addDependencyMutation.isPending}
              fullWidth
            >
              {addDependencyMutation.isPending ? 'Adding...' : 'Add Dependency'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default TaskDependencyDialog;

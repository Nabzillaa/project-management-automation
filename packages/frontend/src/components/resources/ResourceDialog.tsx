import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Alert,
  Slider,
  Typography,
} from '@mui/material';
import { resourcesApi, Resource } from '../../services/api/resources';

interface ResourceDialogProps {
  open: boolean;
  onClose: () => void;
  resource: Resource | null;
  organizationId: string;
}

function ResourceDialog({ open, onClose, resource, organizationId }: ResourceDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    type: 'person' as 'person' | 'equipment' | 'material',
    costPerHour: '',
    availabilityHoursPerDay: 100,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resource) {
      setFormData({
        name: resource.name,
        type: resource.type,
        costPerHour: resource.costPerHour?.toString() || '',
        availabilityHoursPerDay: resource.availabilityHoursPerDay || 100,
      });
    } else {
      setFormData({
        name: '',
        type: 'person',
        costPerHour: '',
        availabilityHoursPerDay: 100,
      });
    }
    setError(null);
  }, [resource, open]);

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      type: 'person' | 'equipment' | 'material';
      costPerHour?: number;
      availability?: number;
      organizationId: string;
    }) => resourcesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['resource-summary'] });
      onClose();
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Failed to create resource');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string;
      name?: string;
      costPerHour?: number;
      availability?: number;
    }) => resourcesApi.update(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['resource-summary'] });
      onClose();
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Failed to update resource');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    const data: any = {
      name: formData.name.trim(),
      type: formData.type,
      availabilityHoursPerDay: formData.availabilityHoursPerDay,
    };

    if (formData.costPerHour) {
      data.costPerHour = parseFloat(formData.costPerHour);
    }

    if (resource) {
      updateMutation.mutate({ id: resource.id, ...data });
    } else {
      createMutation.mutate({ ...data, organizationId });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {resource ? 'Edit Resource' : 'Add New Resource'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
              disabled={isLoading}
            />

            <TextField
              select
              label="Type"
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as 'person' | 'equipment' | 'material',
                })
              }
              fullWidth
              disabled={isLoading || !!resource}
              helperText={resource ? 'Type cannot be changed after creation' : ''}
            >
              <MenuItem value="person">Person</MenuItem>
              <MenuItem value="equipment">Equipment</MenuItem>
              <MenuItem value="material">Material</MenuItem>
            </TextField>

            <TextField
              label="Hourly Rate"
              type="number"
              value={formData.costPerHour}
              onChange={(e) => setFormData({ ...formData, costPerHour: e.target.value })}
              fullWidth
              disabled={isLoading}
              InputProps={{
                startAdornment: '$',
              }}
              helperText="Optional: Cost per hour for this resource"
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Availability: {formData.availabilityHoursPerDay}%
              </Typography>
              <Slider
                value={formData.availabilityHoursPerDay}
                onChange={(_, value) =>
                  setFormData({ ...formData, availabilityHoursPerDay: value as number })
                }
                min={0}
                max={100}
                step={5}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 50, label: '50%' },
                  { value: 100, label: '100%' },
                ]}
                valueLabelDisplay="auto"
                disabled={isLoading}
              />
              <Typography variant="caption" color="text.secondary">
                How much of this resource's capacity is available for allocation
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : resource ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default ResourceDialog;

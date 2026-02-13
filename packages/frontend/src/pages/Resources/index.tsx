import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  LinearProgress,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Build as EquipmentIcon,
  Inventory as MaterialIcon,
} from '@mui/icons-material';
import { resourcesApi } from '../../services/api/resources';
import { projectsApi } from '../../services/api/projects';
import { format, addDays } from 'date-fns';
import ResourceDialog from '../../components/resources/ResourceDialog';

const RESOURCE_TYPE_ICONS = {
  person: <PersonIcon />,
  equipment: <EquipmentIcon />,
  material: <MaterialIcon />,
};

function ResourcesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<any>(null);

  // Use default organization ID (placeholder for single-org setup)
  const organizationId = '00000000-0000-0000-0000-000000000000';

  // Calculate date range for utilization (next 30 days)
  const startDate = format(new Date(), 'yyyy-MM-dd');
  const endDate = format(addDays(new Date(), 30), 'yyyy-MM-dd');

  const { data: resources = [], isLoading, error } = useQuery({
    queryKey: ['resources', organizationId],
    queryFn: () => resourcesApi.getAll(organizationId!),
    enabled: !!organizationId,
  });

  const { data: summary = [] } = useQuery({
    queryKey: ['resource-summary', organizationId, startDate, endDate],
    queryFn: () => resourcesApi.getOrganizationSummary(organizationId!, startDate, endDate),
    enabled: !!organizationId && resources.length > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => resourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['resource-summary'] });
    },
  });

  const handleAdd = () => {
    setSelectedResource(null);
    setDialogOpen(true);
  };

  const handleEdit = (resource: any) => {
    setSelectedResource(resource);
    setDialogOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete resource "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedResource(null);
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization > 100) return 'error';
    if (utilization > 80) return 'warning';
    return 'success';
  };

  // Merge resources with summary data
  const resourcesWithUtilization = resources.map((resource) => {
    const summaryData = summary.find((s) => s.id === resource.id);
    return {
      ...resource,
      utilizationPercentage: summaryData?.utilizationPercentage || 0,
      isOverallocated: summaryData?.isOverallocated || false,
      totalAllocated: summaryData?.totalAllocated || 0,
    };
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load resources. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1">
            Resource Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Manage people, equipment, and materials for your projects
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          Add Resource
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PersonIcon color="primary" />
                <Typography variant="caption" color="text.secondary">
                  Total Resources
                </Typography>
              </Box>
              <Typography variant="h4">{resources.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PersonIcon color="success" />
                <Typography variant="caption" color="text.secondary">
                  People
                </Typography>
              </Box>
              <Typography variant="h4">
                {resources.filter((r) => r.type === 'person').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <EquipmentIcon color="info" />
                <Typography variant="caption" color="text.secondary">
                  Equipment
                </Typography>
              </Box>
              <Typography variant="h4">
                {resources.filter((r) => r.type === 'equipment').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <MaterialIcon color="warning" />
                <Typography variant="caption" color="text.secondary">
                  Materials
                </Typography>
              </Box>
              <Typography variant="h4">
                {resources.filter((r) => r.type === 'material').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Resources Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Resources Overview
          </Typography>
          {resources.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No resources yet. Click "Add Resource" to create your first resource.
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Hourly Rate</TableCell>
                    <TableCell>Availability</TableCell>
                    <TableCell>Utilization (30 days)</TableCell>
                    <TableCell>Allocations</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resourcesWithUtilization.map((resource) => (
                    <TableRow key={resource.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {RESOURCE_TYPE_ICONS[resource.type]}
                          <Typography variant="body2" fontWeight="medium">
                            {resource.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={resource.type}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {resource.costPerHour ? `$${resource.costPerHour}/hr` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                          <LinearProgress
                            variant="determinate"
                            value={resource.availabilityHoursPerDay || 100}
                            sx={{ flex: 1, height: 8, borderRadius: 4 }}
                          />
                          <Typography variant="caption">
                            {resource.availabilityHoursPerDay || 100}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(resource.utilizationPercentage, 100)}
                            color={getUtilizationColor(resource.utilizationPercentage)}
                            sx={{ flex: 1, height: 8, borderRadius: 4 }}
                          />
                          <Typography
                            variant="caption"
                            color={resource.isOverallocated ? 'error' : 'text.secondary'}
                            fontWeight={resource.isOverallocated ? 'bold' : 'normal'}
                          >
                            {resource.utilizationPercentage.toFixed(0)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={resource._count?.allocations || 0}
                          size="small"
                          color={resource._count?.allocations ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(resource)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(resource.id, resource.name)}
                            disabled={deleteMutation.isPending}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <ResourceDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        resource={selectedResource}
        organizationId={organizationId || ''}
      />
    </Box>
  );
}

export default ResourcesPage;

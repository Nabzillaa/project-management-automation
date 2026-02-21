import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  LinearProgress,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { projectsApi } from '../../services/api/projects';
import { Project, ProjectStatus } from '@pm-app/shared';
import ProjectForm from '../../components/projects/ProjectForm';
import { format } from 'date-fns';

const statusColors: Record<ProjectStatus, 'default' | 'primary' | 'warning' | 'success' | 'error'> = {
  planning: 'default',
  active: 'primary',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'error',
};

const statusLabels: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function ProjectsPage() {
  const navigate = useNavigate();
  // Use default organization ID (placeholder for single-org setup)
  const queryClient = useQueryClient();
  const organizationId = '00000000-0000-0000-0000-000000000000';
  const [formOpen, setFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects', organizationId],
    queryFn: () => projectsApi.getAll({ organizationId }),
    enabled: !!organizationId,
  });

  const handleAddProject = () => {
    setSelectedProject(null);
    setFormOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setSelectedProject(project);
    setFormOpen(true);
  };

  const handleViewProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (selectedProject) {
        return projectsApi.update(selectedProject.id, data);
      }
      return projectsApi.create({ ...data, organizationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      handleFormClose();
    },
  });

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedProject(null);
  };

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getProjectHealth = (project: Project) => {
    const budget = Number(project.budget || 0);
    const spent = Number(project.actualCost || 0);
    const isOverBudget = budget > 0 && spent > budget;
    const isNearBudget = budget > 0 && spent > budget * 0.9 && spent <= budget;
    const isOverdue = project.endDate && new Date(project.endDate) < new Date() && project.status !== 'completed';

    if (isOverBudget || isOverdue) {
      return { color: 'error' as const, label: 'At Risk' };
    }
    if (isNearBudget) {
      return { color: 'warning' as const, label: 'Attention' };
    }
    return { color: 'success' as const, label: 'On Track' };
  };

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
        Failed to load projects. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1">
            All Projects
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
            {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' ? ' (filtered)' : ''}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddProject}
        >
          New Project
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1 }}
              size="small"
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="planning">Planning</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="on_hold">On Hold</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priorityFilter}
                label="Priority"
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <MenuItem value="all">All Priorities</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card>
        <CardContent>
          {filteredProjects.length === 0 ? (
            <Alert severity="info">
              {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No projects match your filters.'
                : 'No projects yet. Click "New Project" to create your first project.'}
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Project Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Timeline</TableCell>
                    <TableCell>Budget</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Health</TableCell>
                    <TableCell>Tasks</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProjects.map((project) => {
                    const health = getProjectHealth(project);
                    const totalTasks = (project as any)._count?.tasks || 0;
                    // Estimate progress based on project status
                    const progress = project.status === 'completed' ? 100 :
                                   project.status === ProjectStatus.ACTIVE ? 50 :
                                   project.status === 'planning' ? 10 : 0;

                    return (
                      <TableRow
                        key={project.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleViewProject(project.id)}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {project.name}
                          </Typography>
                          {project.description && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {project.description.substring(0, 60)}
                              {project.description.length > 60 ? '...' : ''}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusLabels[project.status]}
                            color={statusColors[project.status]}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={project.priority.toUpperCase()}
                            size="small"
                            variant="outlined"
                            color={
                              project.priority === 'high' ? 'error' :
                              project.priority === 'medium' ? 'warning' : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" display="block">
                            {project.startDate ? format(new Date(project.startDate), 'MMM d, yyyy') : 'Not set'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            to {project.endDate ? format(new Date(project.endDate), 'MMM d, yyyy') : 'TBD'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            ${Number(project.actualCost || 0).toLocaleString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            of ${Number(project.budget || 0).toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                            <LinearProgress
                              variant="determinate"
                              value={progress}
                              sx={{ flex: 1, height: 8, borderRadius: 4 }}
                            />
                            <Typography variant="caption">
                              {progress.toFixed(0)}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={health.label}
                            color={health.color}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={totalTasks}
                            size="small"
                            color={totalTasks > 0 ? 'primary' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewProject(project.id);
                              }}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditProject(project);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <ProjectForm
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={async (data) => { await saveMutation.mutateAsync(data); }}
        project={selectedProject ?? undefined}
        loading={saveMutation.isPending}
      />
    </Box>
  );
}

export default ProjectsPage;

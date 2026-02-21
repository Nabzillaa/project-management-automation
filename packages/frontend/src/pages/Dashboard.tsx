import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Box,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Alert,
  LinearProgress,
  Paper,
  Divider,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Add as AddIcon,
  Folder as ProjectIcon,
  AttachMoney as MoneyIcon,
  Assignment as TaskIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Event as EventIcon,
  People as PeopleIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { projectsApi } from '../services/api/projects';
import { useAuthStore } from '../stores/authStore';
import { Project } from '@pm-app/shared';
import ProjectForm from '../components/projects/ProjectForm';

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const user = useAuthStore((state) => state.user);
  const [formOpen, setFormOpen] = useState(false);

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      return projectsApi.create({
        ...data,
        organizationId: '00000000-0000-0000-0000-000000000000'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setFormOpen(false);
      enqueueSnackbar('Project created successfully', { variant: 'success' });
    },
    onError: (error: any) => {
      enqueueSnackbar(error.response?.data?.error || 'Failed to create project', { variant: 'error' });
    },
  });

  // Calculate comprehensive statistics
  const statistics = useMemo(() => {
    if (!projects) return null;

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p: Project) => p.status === 'active').length;
    const completedProjects = projects.filter((p: Project) => p.status === 'completed').length;
    const onHoldProjects = projects.filter((p: Project) => p.status === 'on_hold').length;
    const planningProjects = projects.filter((p: Project) => p.status === 'planning').length;

    const totalBudget = projects.reduce((sum: number, p: Project) => sum + Number(p.budget || 0), 0);
    const totalSpent = projects.reduce((sum: number, p: Project) => sum + Number(p.actualCost || 0), 0);
    const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    // Count total tasks across all projects
    const totalTasks = projects.reduce((sum: number, p: any) => sum + (p._count?.tasks || 0), 0);

    const projectsOverBudget = projects.filter((p: Project) => {
      const budget = Number(p.budget || 0);
      const spent = Number(p.actualCost || 0);
      return budget > 0 && spent > budget;
    }).length;

    const projectsNearBudget = projects.filter((p: Project) => {
      const budget = Number(p.budget || 0);
      const spent = Number(p.actualCost || 0);
      const utilization = budget > 0 ? (spent / budget) * 100 : 0;
      return utilization >= 75 && utilization < 100;
    }).length;

    // Find upcoming deadlines (within 7 days)
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = projects.filter((p: Project) => {
      if (!p.endDate) return false;
      const endDate = new Date(p.endDate);
      return endDate > now && endDate <= sevenDaysFromNow;
    });

    // Find overdue projects
    const overdueProjects = projects.filter((p: Project) => {
      if (!p.endDate || p.status === 'completed' || p.status === 'cancelled') return false;
      const endDate = new Date(p.endDate);
      return endDate < now;
    });

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      onHoldProjects,
      planningProjects,
      totalBudget,
      totalSpent,
      budgetUtilization,
      projectsOverBudget,
      projectsNearBudget,
      totalTasks,
      upcomingDeadlines: upcomingDeadlines.length,
      overdueProjects: overdueProjects.length,
      upcomingDeadlinesList: upcomingDeadlines,
      overdueProjectsList: overdueProjects,
    };
  }, [projects]);

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

  const getProjectHealth = (project: Project) => {
    const budget = Number(project.budget || 0);
    const spent = Number(project.actualCost || 0);
    const isOverBudget = budget > 0 && spent > budget;
    const isNearBudget = budget > 0 && (spent / budget) * 100 >= 75 && (spent / budget) * 100 < 100;
    const isOverdue = project.endDate && new Date(project.endDate) < new Date() && project.status !== 'completed';

    if (isOverBudget || isOverdue) return { color: 'error', label: 'At Risk' };
    if (isNearBudget) return { color: 'warning', label: 'Needs Attention' };
    return { color: 'success', label: 'On Track' };
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Portfolio Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Welcome back, {user?.firstName}! Here's your comprehensive portfolio overview.
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<AddIcon />}
          onClick={() => setFormOpen(true)}
        >
          New Project
        </Button>
      </Box>

      {/* Statistics Cards */}
      {statistics && projects && projects.length > 0 && (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Total Projects */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ProjectIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Total Projects</Typography>
                </Box>
                <Typography variant="h3" fontWeight="bold">
                  {statistics.totalProjects}
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Active</Typography>
                    <Typography variant="h6">{statistics.activeProjects}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>Completed</Typography>
                    <Typography variant="h6">{statistics.completedProjects}</Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>

            {/* Total Tasks */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  color: 'white',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TaskIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Total Tasks</Typography>
                </Box>
                <Typography variant="h3" fontWeight="bold">
                  {statistics.totalTasks}
                </Typography>
                <Typography variant="body2" sx={{ mt: 2, opacity: 0.9 }}>
                  Across all projects
                </Typography>
              </Paper>
            </Grid>

            {/* Budget Health */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <MoneyIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Budget Health</Typography>
                </Box>
                <Typography variant="h3" fontWeight="bold">
                  {statistics.budgetUtilization.toFixed(0)}%
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                  ${statistics.totalSpent.toLocaleString()} / ${statistics.totalBudget.toLocaleString()}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(statistics.budgetUtilization, 100)}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: 'white',
                      },
                    }}
                  />
                </Box>
              </Paper>
            </Grid>

            {/* Alerts & Deadlines */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  background: statistics.overdueProjects > 0
                    ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
                    : statistics.upcomingDeadlines > 0
                    ? 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
                    : 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                  color: 'white',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <EventIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Deadlines</Typography>
                </Box>
                <Typography variant="h3" fontWeight="bold">
                  {statistics.upcomingDeadlines}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                  Due within 7 days
                </Typography>
                {statistics.overdueProjects > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      {statistics.overdueProjects} projects overdue
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Alerts Section */}
          {(statistics.overdueProjects > 0 || statistics.projectsOverBudget > 0) && (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {statistics.overdueProjects > 0 && (
                <Grid item xs={12} md={6}>
                  <Alert severity="error" sx={{ mb: 0 }}>
                    <Typography variant="subtitle2" fontWeight="600">
                      {statistics.overdueProjects} Overdue Project{statistics.overdueProjects > 1 ? 's' : ''}
                    </Typography>
                    <Typography variant="body2">
                      {statistics.overdueProjectsList?.slice(0, 3).map((p: Project) => p.name).join(', ')}
                      {statistics.overdueProjects > 3 && ` and ${statistics.overdueProjects - 3} more`}
                    </Typography>
                  </Alert>
                </Grid>
              )}
              {statistics.projectsOverBudget > 0 && (
                <Grid item xs={12} md={6}>
                  <Alert severity="warning" sx={{ mb: 0 }}>
                    <Typography variant="subtitle2" fontWeight="600">
                      {statistics.projectsOverBudget} Project{statistics.projectsOverBudget > 1 ? 's' : ''} Over Budget
                    </Typography>
                    <Typography variant="body2">
                      {statistics.projectsNearBudget} more approaching budget limit
                    </Typography>
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}

          {/* Visual Analytics */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Project Status Distribution */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight="600" gutterBottom>
                  Portfolio Status Distribution
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Current breakdown by project status
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Active', value: statistics.activeProjects, color: '#3b82f6' },
                        { name: 'Planning', value: statistics.planningProjects, color: '#94a3b8' },
                        { name: 'On Hold', value: statistics.onHoldProjects, color: '#f59e0b' },
                        { name: 'Completed', value: statistics.completedProjects, color: '#10b981' },
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: 'Active', value: statistics.activeProjects, color: '#3b82f6' },
                        { name: 'Planning', value: statistics.planningProjects, color: '#94a3b8' },
                        { name: 'On Hold', value: statistics.onHoldProjects, color: '#f59e0b' },
                        { name: 'Completed', value: statistics.completedProjects, color: '#10b981' },
                      ].filter(d => d.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Budget Overview Chart */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight="600" gutterBottom>
                  Budget vs Actual Spending
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Portfolio-wide financial overview
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={[
                      {
                        name: 'Budget',
                        Allocated: statistics.totalBudget,
                        Spent: statistics.totalSpent,
                      },
                    ]}
                  >
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(value: any) => `$${Number(value).toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="Allocated" fill="#94a3b8" />
                    <Bar dataKey="Spent" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">
                      Remaining Budget
                    </Typography>
                    <Typography variant="body2" fontWeight="600" color="success.main">
                      ${(statistics.totalBudget - statistics.totalSpent).toLocaleString()}
                    </Typography>
                  </Stack>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Critical Items & Recent Activity */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Items Requiring Attention */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <WarningIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6" fontWeight="600">
                    Requires Attention
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <List dense>
                  {statistics.overdueProjectsList?.slice(0, 3).map((project: Project) => (
                    <ListItem
                      key={project.id}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        borderRadius: 1,
                        mb: 1,
                      }}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <ListItemIcon>
                        <ErrorIcon color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={project.name}
                        secondary={`Overdue: ${project.endDate ? new Date(project.endDate).toLocaleDateString() : ''}`}
                      />
                    </ListItem>
                  ))}
                  {projects?.filter((p: Project) => {
                    const budget = Number(p.budget || 0);
                    const spent = Number(p.actualCost || 0);
                    return budget > 0 && spent > budget;
                  }).slice(0, 3 - (statistics.overdueProjectsList?.length || 0)).map((project: Project) => (
                    <ListItem
                      key={project.id}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        borderRadius: 1,
                        mb: 1,
                      }}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <ListItemIcon>
                        <MoneyIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={project.name}
                        secondary="Over budget"
                      />
                    </ListItem>
                  ))}
                  {!statistics.overdueProjectsList?.length && statistics.projectsOverBudget === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        All projects are on track!
                      </Typography>
                    </Box>
                  )}
                </List>
              </Paper>
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SpeedIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6" fontWeight="600">
                    Quick Actions
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<AddIcon />}
                    onClick={() => setFormOpen(true)}
                    sx={{ justifyContent: 'flex-start', py: 1.5 }}
                  >
                    Create New Project
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<ProjectIcon />}
                    onClick={() => navigate('/projects')}
                    sx={{ justifyContent: 'flex-start', py: 1.5 }}
                  >
                    View All Projects
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<TaskIcon />}
                    onClick={() => navigate('/projects')}
                    sx={{ justifyContent: 'flex-start', py: 1.5 }}
                  >
                    Browse All Tasks ({statistics.totalTasks})
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<PeopleIcon />}
                    onClick={() => navigate('/resources')}
                    sx={{ justifyContent: 'flex-start', py: 1.5 }}
                  >
                    Manage Resources
                  </Button>
                </Stack>

                {/* Portfolio Health Summary */}
                <Box sx={{ mt: 4, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                    Portfolio Health Score
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={
                          (projects?.filter((p: Project) => {
                            const health = getProjectHealth(p);
                            return health.color === 'success';
                          }).length || 0) / (projects?.length || 1) * 100
                        }
                        sx={{ height: 8, borderRadius: 4 }}
                        color="success"
                      />
                    </Box>
                    <Typography variant="h6" fontWeight="600">
                      {Math.round((projects?.filter((p: Project) => {
                        const health = getProjectHealth(p);
                        return health.color === 'success';
                      }).length || 0) / (projects?.length || 1) * 100)}%
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {projects?.filter((p: Project) => {
                      const health = getProjectHealth(p);
                      return health.color === 'success';
                    }).length || 0} of {projects?.length || 0} projects on track
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      {/* Empty State */}
      {projects && projects.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <ProjectIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No projects yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Get started by creating your first project
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
            Create Project
          </Button>
        </Box>
      )}

      <ProjectForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={async (data) => { await createMutation.mutateAsync(data); }}
        loading={createMutation.isPending}
      />
    </Box>
  );
}

export default Dashboard;

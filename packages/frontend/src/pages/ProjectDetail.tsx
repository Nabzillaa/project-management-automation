import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import { useState, useMemo } from 'react';
import { projectsApi } from '../services/api/projects';
import { tasksApi } from '../services/api/tasks';
import TaskList from '../components/tasks/TaskList';
import CriticalPathDisplay from '../components/planning/CriticalPathDisplay';
import GanttChart from '../components/timeline/GanttChart';
import BurndownChart from '../components/reports/BurndownChart';
import CostDashboard from '../components/costs/CostDashboard';
import apiClient from '../services/api/client';

function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState(0);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  });

  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasksApi.getAll(id!),
    enabled: !!id,
  });

  const updateTaskDatesMutation = useMutation({
    mutationFn: async ({
      taskId,
      startDate,
      endDate,
    }: {
      taskId: string;
      startDate: Date;
      endDate: Date;
    }) => {
      const response = await apiClient.patch(`/tasks/${taskId}`, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      return response.data;
    },
    onSuccess: () => {
      refetchTasks();
    },
  });

  const handleTaskUpdate = (taskId: string, newStartDate: Date, newEndDate: Date) => {
    updateTaskDatesMutation.mutate({ taskId, startDate: newStartDate, endDate: newEndDate });
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
        Failed to load project. Please try again.
      </Alert>
    );
  }

  if (!project) {
    return (
      <Alert severity="info">
        Project not found.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h4" component="h1">
            {project.name}
          </Typography>
          <Chip label={project.status} color="primary" />
          <Chip label={project.priority} variant="outlined" />
        </Box>
        <Typography variant="body1" color="text.secondary">
          {project.description || 'No description'}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Budget
              </Typography>
              <Typography variant="h4">
                ${Number(project.budget || 0).toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Spent: ${Number(project.actualCost).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Timeline
              </Typography>
              <Typography variant="body2">
                Start: {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'}
              </Typography>
              <Typography variant="body2">
                End: {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'Not set'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tasks
              </Typography>
              <Typography variant="h4">
                {/* @ts-ignore */}
                {project._count?.tasks || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total tasks
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        <CriticalPathDisplay projectId={id!} onCalculated={refetchTasks} />
      </Box>

      <Box sx={{ mt: 4 }}>
        {tasks.length > 1000 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Large dataset detected:</strong> This project has {tasks.length.toLocaleString()} tasks.
              Visualizations may take longer to load and could affect browser performance.
              Consider using the Task List tab with filters for better performance.
            </Typography>
          </Alert>
        )}

        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
          <Tab label="Task List" />
          <Tab label="Gantt Chart" />
          <Tab label="Burndown Chart" />
          <Tab label="Cost Tracking" />
        </Tabs>

        {activeTab === 0 && (
          <>
            {tasksLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TaskList
                tasks={tasks}
                projectId={id!}
                onTaskCreated={refetchTasks}
                onTaskUpdated={refetchTasks}
                onTaskDeleted={refetchTasks}
              />
            )}
          </>
        )}

        {activeTab === 1 && (
          <>
            {tasksLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : tasks.length === 0 ? (
              <Alert severity="info">
                No tasks available. Add tasks to see them on the Gantt chart.
              </Alert>
            ) : tasks.length > 2000 ? (
              <Alert severity="error">
                <Typography variant="body2" fontWeight="medium" gutterBottom>
                  Too many tasks to display in Gantt Chart
                </Typography>
                <Typography variant="body2">
                  This project has {tasks.length.toLocaleString()} tasks. The Gantt Chart is limited to 2,000 tasks for performance reasons.
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Recommendations:
                </Typography>
                <ul style={{ marginTop: 4, marginBottom: 0 }}>
                  <li>Use the Task List tab to view and manage all tasks</li>
                  <li>Filter tasks by status, priority, or assignee</li>
                  <li>Consider breaking this into smaller sub-projects</li>
                  <li>Focus on active and high-priority tasks</li>
                </ul>
              </Alert>
            ) : (
              <>
                {tasks.length > 1000 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Large dataset:</strong> This project has {tasks.length.toLocaleString()} tasks.
                      The Gantt Chart may take a moment to render and could be slow to interact with.
                      Consider using filters in the Task List tab for better performance.
                    </Typography>
                  </Alert>
                )}
                {tasks.length > 100 && tasks.length <= 1000 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Loading {tasks.length} tasks... This may take a moment.
                    </Typography>
                  </Alert>
                )}
                <GanttChart
                  tasks={tasks}
                  projectStartDate={project.startDate ? new Date(project.startDate) : new Date()}
                  onTaskUpdate={handleTaskUpdate}
                />
              </>
            )}
          </>
        )}

        {activeTab === 2 && (
          <>
            {tasksLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <BurndownChart
                tasks={tasks}
                projectStartDate={project.startDate ? new Date(project.startDate) : new Date()}
                projectEndDate={project.endDate ? new Date(project.endDate) : undefined}
              />
            )}
          </>
        )}

        {activeTab === 3 && (
          <CostDashboard projectId={id!} />
        )}
      </Box>
    </Box>
  );
}

export default ProjectDetail;

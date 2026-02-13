import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  TrendingFlat as PathIcon,
  Calculate as CalculateIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import apiClient from '../../services/api/client';

interface CriticalPathDisplayProps {
  projectId: string;
  onCalculated?: () => void;
}

interface CPMResult {
  projectId: string;
  projectName: string;
  startDate: string;
  totalDuration: number;
  criticalPath: Array<{
    taskId: string;
    task: string;
    earliestStart: string;
    earliestFinish: string;
  }>;
  results: Array<{
    taskId: string;
    earliestStart: Date;
    earliestFinish: Date;
    latestStart: Date;
    latestFinish: Date;
    slack: number;
    isCriticalPath: boolean;
  }>;
}

function CriticalPathDisplay({ projectId, onCalculated }: CriticalPathDisplayProps) {
  const [cpmResults, setCpmResults] = useState<CPMResult | null>(null);

  const calculateCPM = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/planning/cpm/${projectId}`);
      return response.data.data as CPMResult;
    },
    onSuccess: (data) => {
      setCpmResults(data);
      onCalculated?.();
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (hours: number) => {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return days > 0 ? `${days}d ${remainingHours}h` : `${remainingHours}h`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PathIcon />
          Critical Path Analysis
        </Typography>
        <Button
          variant="contained"
          startIcon={calculateCPM.isPending ? <CircularProgress size={20} /> : <CalculateIcon />}
          onClick={() => calculateCPM.mutate()}
          disabled={calculateCPM.isPending}
        >
          {calculateCPM.isPending ? 'Calculating...' : 'Calculate CPM'}
        </Button>
      </Box>

      {calculateCPM.isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="medium" gutterBottom>
            Unable to calculate critical path
          </Typography>
          <Typography variant="body2">
            This project may not have task dependencies defined yet. The Critical Path Method requires tasks to have:
          </Typography>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
            <li>Estimated durations</li>
            <li>Dependencies between tasks (predecessor/successor relationships)</li>
          </ul>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Add task dependencies in the Task List tab to enable critical path analysis.
          </Typography>
        </Alert>
      )}

      {cpmResults && (
        <Box>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Project Summary
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Project
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {cpmResults.projectName}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography variant="body1">
                    {new Date(cpmResults.startDate).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Duration
                  </Typography>
                  <Typography variant="body1" fontWeight="medium" color="primary">
                    {formatDuration(cpmResults.totalDuration)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Critical Tasks
                  </Typography>
                  <Typography variant="body1" fontWeight="medium" color="error">
                    {cpmResults.criticalPath.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon color="error" />
                Critical Path Tasks
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These tasks directly impact the project completion date. Any delay in these tasks will delay the entire project.
              </Typography>

              {cpmResults.criticalPath.length === 0 ? (
                <Alert severity="info">
                  No critical path identified. Ensure tasks have dependencies and durations set.
                </Alert>
              ) : (
                <List>
                  {cpmResults.criticalPath.map((item, index) => (
                    <Box key={item.taskId}>
                      <ListItem sx={{ py: 2 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip label={`#${index + 1}`} size="small" color="error" />
                              <Typography variant="body1" fontWeight="medium">
                                {item.task}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                              <Typography variant="caption">
                                Start: {formatDate(item.earliestStart)}
                              </Typography>
                              <Typography variant="caption">
                                Finish: {formatDate(item.earliestFinish)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < cpmResults.criticalPath.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              )}

              {cpmResults.results.some(r => r.slack > 0 && !r.isCriticalPath) && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Tasks with Slack Time
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {cpmResults.results.filter(r => r.slack > 0 && !r.isCriticalPath).length} tasks have flexibility in scheduling without affecting the project deadline.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {!cpmResults && !calculateCPM.isPending && !calculateCPM.isError && (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              Click "Calculate CPM" to analyze the critical path for this project.
              <br />
              Make sure your tasks have estimated durations and dependencies defined.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default CriticalPathDisplay;

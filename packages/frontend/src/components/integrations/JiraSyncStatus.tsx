import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { integrationsApi, JiraCredentials } from '../../services/api/integrations';

interface JiraSyncStatusProps {
  projectId: string;
  organizationId: string;
  credentials: JiraCredentials;
}

export default function JiraSyncStatus({ projectId, organizationId, credentials }: JiraSyncStatusProps) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: history } = useQuery({
    queryKey: ['sync-history', organizationId],
    queryFn: () => integrationsApi.getSyncHistory(organizationId),
  });

  const syncMutation = useMutation({
    mutationFn: () => integrationsApi.syncJiraProject(projectId, organizationId, credentials),
    onSuccess: (result) => {
      enqueueSnackbar(`Synced ${result.itemsSynced} items`, { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['sync-history'] });
      setIsSyncing(false);
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.error || 'Failed to sync',
        { variant: 'error' }
      );
      setIsSyncing(false);
    },
  });

  const lastSync = history?.[0];

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6">JIRA Sync Status</Typography>
          {lastSync && (
            <Typography variant="body2" color="text.secondary">
              Last sync: {new Date(lastSync.completedAt).toLocaleString()}
            </Typography>
          )}
        </Box>

        {lastSync?.status === 'failed' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Last sync failed: {lastSync.errorMessage}
          </Alert>
        )}

        {history && history.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Items</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{new Date(item.startedAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.status}
                        color={item.status === 'success' ? 'success' : item.status === 'partial' ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{item.itemsSynced}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
      <CardActions>
        <Button
          startIcon={isSyncing ? <CircularProgress size={20} /> : <RefreshIcon />}
          onClick={() => {
            setIsSyncing(true);
            syncMutation.mutate();
          }}
          disabled={isSyncing}
        >
          Sync Now
        </Button>
      </CardActions>
    </Card>
  );
}

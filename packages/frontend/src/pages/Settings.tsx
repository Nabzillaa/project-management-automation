import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Divider,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Chip,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CloudDownload as ImportIcon,
} from '@mui/icons-material';
import { integrationsApi, JiraCredentials, JiraProject } from '../services/api/integrations';
import { projectsApi } from '../services/api/projects';
import { adminApi } from '../services/api/admin';

function Settings() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // Use default organization ID (placeholder for single-org setup)
  const organizationId = '00000000-0000-0000-0000-000000000000';

  const [credentials, setCredentials] = useState<JiraCredentials>({
    domain: '',
    email: '',
    apiToken: '',
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<JiraProject | null>(null);
  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch saved credentials
  const { data: savedCredentials, isLoading } = useQuery({
    queryKey: ['jira-credentials', organizationId],
    queryFn: () => integrationsApi.getJiraCredentials(organizationId),
    enabled: !!organizationId,
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: (creds: JiraCredentials) => integrationsApi.testJiraConnection(creds),
    onMutate: () => {
      setTestStatus('testing');
    },
    onSuccess: () => {
      setTestStatus('success');
      enqueueSnackbar('Successfully connected to JIRA!', { variant: 'success' });
    },
    onError: () => {
      setTestStatus('error');
      enqueueSnackbar('Failed to connect to JIRA. Please check your credentials.', { variant: 'error' });
    },
  });

  // Save credentials mutation
  const saveCredentialsMutation = useMutation({
    mutationFn: (creds: JiraCredentials) => {
      if (!organizationId) throw new Error('Organization ID not found');
      return integrationsApi.saveJiraCredentials(organizationId, creds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-credentials'] });
      enqueueSnackbar('JIRA credentials saved successfully!', { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar('Failed to save JIRA credentials', { variant: 'error' });
    },
  });

  // Fetch JIRA projects mutation
  const fetchProjectsMutation = useMutation({
    mutationFn: (creds: JiraCredentials) => integrationsApi.getJiraProjects(creds),
    onSuccess: (projects) => {
      setJiraProjects(projects);
      setImportDialogOpen(true);
    },
    onError: () => {
      enqueueSnackbar('Failed to fetch JIRA projects', { variant: 'error' });
    },
  });

  // Import project mutation
  const importProjectMutation = useMutation({
    mutationFn: (projectKey: string) => {
      if (!organizationId) throw new Error('Organization ID not found');
      return integrationsApi.importJiraProject(projectKey, organizationId, credentials);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setImportDialogOpen(false);
      setSelectedProject(null);
      enqueueSnackbar(
        `Successfully imported ${result.tasksImported} tasks from JIRA project!`,
        { variant: 'success' }
      );
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.error || 'Failed to import JIRA project',
        { variant: 'error' }
      );
    },
  });

  // Excel upload mutation
  const uploadExcelMutation = useMutation({
    mutationFn: (file: File) => {
      if (!organizationId) throw new Error('Organization ID not found');
      return integrationsApi.uploadExcelFile(file, organizationId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSelectedFile(null);
      if (result.errors.length > 0) {
        enqueueSnackbar(
          `Imported ${result.projectsImported} projects and ${result.tasksImported} tasks with ${result.errors.length} errors`,
          { variant: 'warning' }
        );
      } else {
        enqueueSnackbar(
          `Successfully imported ${result.projectsImported} projects and ${result.tasksImported} tasks!`,
          { variant: 'success' }
        );
      }
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.error || 'Failed to import file',
        { variant: 'error' }
      );
    },
  });

  // Reset data mutation
  const resetDataMutation = useMutation({
    mutationFn: () => adminApi.resetAllData(),
    onSuccess: () => {
      enqueueSnackbar('All data cleared successfully', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (error: any) => {
      enqueueSnackbar(
        error.response?.data?.error || 'Failed to clear data',
        { variant: 'error' }
      );
    },
  });

  const handleTestConnection = () => {
    if (!credentials.domain || !credentials.email || !credentials.apiToken) {
      enqueueSnackbar('Please fill in all JIRA credentials', { variant: 'warning' });
      return;
    }
    testConnectionMutation.mutate(credentials);
  };

  const handleSaveCredentials = () => {
    if (!credentials.domain || !credentials.email || !credentials.apiToken) {
      enqueueSnackbar('Please fill in all JIRA credentials', { variant: 'warning' });
      return;
    }
    saveCredentialsMutation.mutate(credentials);
  };

  const handleImportProjects = () => {
    if (!credentials.domain || !credentials.email || !credentials.apiToken) {
      enqueueSnackbar('Please enter JIRA credentials first', { variant: 'warning' });
      return;
    }
    fetchProjectsMutation.mutate(credentials);
  };

  const handleImportProject = () => {
    if (!selectedProject) {
      enqueueSnackbar('Please select a project to import', { variant: 'warning' });
      return;
    }
    importProjectMutation.mutate(selectedProject.key);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.name.match(/\.(xlsx|xls|ods|csv|xml)$/i)) {
        enqueueSnackbar(
          'Please select a valid file (.xlsx, .xls, .ods, .csv, or .xml). Binary .mpp files must be exported to XML format first.',
          { variant: 'error' }
        );
        return;
      }
      // Check file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        enqueueSnackbar('File size must be less than 10MB', { variant: 'error' });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadExcel = () => {
    if (!selectedFile) {
      enqueueSnackbar('Please select an Excel file first', { variant: 'warning' });
      return;
    }
    uploadExcelMutation.mutate(selectedFile);
  };

  if (isLoading || !organizationId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <SettingsIcon sx={{ fontSize: 32, mr: 2 }} />
        <Typography variant="h4" component="h1" fontWeight="bold">
          Settings & Integrations
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* JIRA Integration Section */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom fontWeight="600">
              JIRA Integration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Connect your JIRA account to import projects and sync tasks
            </Typography>

            <Divider sx={{ mb: 3 }} />

            {savedCredentials && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <strong>Connected to JIRA</strong>
                <br />
                Domain: {savedCredentials.domain}
                <br />
                Email: {savedCredentials.email}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="JIRA Domain"
                  placeholder="yourcompany.atlassian.net"
                  value={credentials.domain}
                  onChange={(e) => setCredentials({ ...credentials, domain: e.target.value })}
                  helperText="Your JIRA cloud domain"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  placeholder="your.email@company.com"
                  value={credentials.email}
                  onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  helperText="Your JIRA account email"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="API Token"
                  type="password"
                  placeholder="Enter your JIRA API token"
                  value={credentials.apiToken}
                  onChange={(e) => setCredentials({ ...credentials, apiToken: e.target.value })}
                  helperText={
                    <span>
                      Generate from{' '}
                      <a
                        href="https://id.atlassian.com/manage-profile/security/api-tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Atlassian
                      </a>
                    </span>
                  }
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={handleTestConnection}
                disabled={testConnectionMutation.isPending}
                startIcon={
                  testStatus === 'testing' ? (
                    <CircularProgress size={20} />
                  ) : testStatus === 'success' ? (
                    <CheckCircleIcon />
                  ) : testStatus === 'error' ? (
                    <ErrorIcon />
                  ) : null
                }
                color={testStatus === 'success' ? 'success' : testStatus === 'error' ? 'error' : 'primary'}
              >
                {testStatus === 'testing'
                  ? 'Testing...'
                  : testStatus === 'success'
                  ? 'Connected'
                  : 'Test Connection'}
              </Button>

              <Button
                variant="contained"
                onClick={handleSaveCredentials}
                disabled={saveCredentialsMutation.isPending}
              >
                {saveCredentialsMutation.isPending ? 'Saving...' : 'Save Credentials'}
              </Button>

              <Button
                variant="contained"
                color="secondary"
                startIcon={<ImportIcon />}
                onClick={handleImportProjects}
                disabled={fetchProjectsMutation.isPending}
              >
                {fetchProjectsMutation.isPending ? 'Loading...' : 'Import from JIRA'}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* File Import Section */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom fontWeight="600">
              Import from File
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Upload Excel, CSV, or Microsoft Project files with your project and task data
            </Typography>

            <Divider sx={{ mb: 3 }} />

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight="600" gutterBottom>
                Supported Formats & Expected Structure:
              </Typography>
              <Typography variant="caption" component="div" sx={{ mb: 1 }}>
                <strong>Excel/CSV Files:</strong>
              </Typography>
              <Typography variant="caption" component="div">
                • <strong>Epic/Project Name</strong>: Name of the project or epic
              </Typography>
              <Typography variant="caption" component="div">
                • <strong>Task ID/Issue Key</strong>: Unique identifier (e.g., PROJ-123)
              </Typography>
              <Typography variant="caption" component="div">
                • <strong>Summary/Title</strong>: Task name or summary
              </Typography>
              <Typography variant="caption" component="div">
                • <strong>Status</strong>: Task status (To Do, In Progress, Done, etc.)
              </Typography>
              <Typography variant="caption" component="div">
                • <strong>Priority</strong>: High, Medium, or Low
              </Typography>
              <Typography variant="caption" component="div">
                • <strong>Start Date</strong>: Task start date
              </Typography>
              <Typography variant="caption" component="div">
                • <strong>End Date/Due Date</strong>: Task end/due date
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: 1, mb: 1 }}>
                <strong>Microsoft Project Files (.xml):</strong> Standard MS Project XML export format
              </Typography>
              <Alert severity="warning" sx={{ mt: 1 }}>
                <Typography variant="caption">
                  <strong>Note:</strong> Binary .mpp files are not directly supported. Please export from MS Project to XML format:
                  <br />
                  In Microsoft Project: <strong>File → Save As → Save as type: XML Format (*.xml)</strong>
                </Typography>
              </Alert>
            </Alert>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="outlined" component="label">
                Choose File
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls,.ods,.csv,.xml"
                  onChange={handleFileChange}
                />
              </Button>

              {selectedFile && (
                <Chip
                  label={selectedFile.name}
                  onDelete={() => setSelectedFile(null)}
                  color="primary"
                  variant="outlined"
                />
              )}

              <Button
                variant="contained"
                color="success"
                startIcon={<ImportIcon />}
                onClick={handleUploadExcel}
                disabled={!selectedFile || uploadExcelMutation.isPending}
              >
                {uploadExcelMutation.isPending ? 'Importing...' : 'Import Data'}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Data Management Section */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom fontWeight="600" color="error">
              Danger Zone
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Irreversible actions that will permanently delete data
            </Typography>

            <Divider sx={{ mb: 3 }} />

            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="600">
                Warning: This action cannot be undone!
              </Typography>
              <Typography variant="caption">
                Clicking "Clear All Data" will permanently delete all projects, tasks, costs, resources, and dependencies from the database.
              </Typography>
            </Alert>

            <Button
              variant="outlined"
              color="error"
              disabled={resetDataMutation.isPending}
              onClick={() => {
                if (window.confirm('Are you absolutely sure you want to delete ALL project data? This action cannot be undone!')) {
                  if (window.confirm('This is your final warning. All projects, tasks, costs, and resources will be permanently deleted. Continue?')) {
                    resetDataMutation.mutate();
                  }
                }
              }}
            >
              {resetDataMutation.isPending ? 'Clearing...' : 'Clear All Data'}
            </Button>
          </Paper>
        </Grid>

        {/* Additional Integration Cards */}
        <Grid item xs={12} md={6}>
          <Card sx={{ opacity: 0.6 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Microsoft Integration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Connect with Microsoft Teams and Outlook (Coming Soon)
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" disabled>
                Connect
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ opacity: 0.6 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Slack Integration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Send notifications to Slack channels (Coming Soon)
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" disabled>
                Connect
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      {/* Import Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Import JIRA Project</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a JIRA project to import into the system. All issues will be imported as tasks.
          </Typography>

          {jiraProjects.length === 0 ? (
            <Alert severity="info">No JIRA projects found</Alert>
          ) : (
            <List>
              {jiraProjects.map((project) => (
                <ListItem key={project.id} disablePadding>
                  <ListItemButton
                    selected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label={project.key} size="small" />
                          <Typography>{project.name}</Typography>
                        </Box>
                      }
                      secondary={project.description || 'No description'}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleImportProject}
            disabled={!selectedProject || importProjectMutation.isPending}
          >
            {importProjectMutation.isPending ? 'Importing...' : 'Import Project'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Settings;

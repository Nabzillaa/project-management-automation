import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AttachMoney as MoneyIcon,
  Refresh as RefreshIcon,
  UploadFile as UploadIcon,
} from '@mui/icons-material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { costsApi, CostEntry } from '../../services/api/costs';
import { format } from 'date-fns';

interface CostDashboardProps {
  projectId: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  labor: '#3b82f6',
  materials: '#22c55e',
  equipment: '#f59e0b',
  software: '#8b5cf6',
  overhead: '#ef4444',
  other: '#6b7280',
};

const CATEGORIES = [
  { value: 'labor', label: 'Labor' },
  { value: 'materials', label: 'Materials' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'software', label: 'Software' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'other', label: 'Other' },
];

function CostDashboard({ projectId }: CostDashboardProps) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCost, setSelectedCost] = useState<CostEntry | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    category: 'labor' as any,
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  const { data: costs, isLoading } = useQuery({
    queryKey: ['costs', projectId],
    queryFn: () => costsApi.getProjectCosts(projectId),
  });

  const { data: budgetStatus } = useQuery({
    queryKey: ['budget-status', projectId],
    queryFn: () => costsApi.getBudgetStatus(projectId),
  });

  const { data: breakdown } = useQuery({
    queryKey: ['cost-breakdown', projectId],
    queryFn: () => costsApi.getBreakdown(projectId),
  });

  const { data: taskCosts } = useQuery({
    queryKey: ['task-costs', projectId],
    queryFn: () => costsApi.getTaskCosts(projectId),
  });

  const recalculateMutation = useMutation({
    mutationFn: () => costsApi.recalculateFromTasks(projectId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
      queryClient.invalidateQueries({ queryKey: ['task-costs'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      enqueueSnackbar(
        `Recalculated from ${data.taskCount} tasks: Budget $${data.budget.toLocaleString()}, Actual $${data.actualCost.toLocaleString()}`,
        { variant: 'success' }
      );
    },
    onError: (error: any) => {
      console.error('Recalculate error:', error);
      enqueueSnackbar(
        error.response?.data?.error || 'Failed to recalculate costs',
        { variant: 'error' }
      );
    },
  });

  const updateCostsFromExcelMutation = useMutation({
    mutationFn: (file: File) => costsApi.updateCostsFromExcel(projectId, file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
      queryClient.invalidateQueries({ queryKey: ['task-costs'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      enqueueSnackbar(
        `Updated ${data.tasksUpdated} tasks. Budget: $${data.totalBudget.toLocaleString()}, Actual: $${data.totalActualCost.toLocaleString()}`,
        { variant: 'success' }
      );
      if (data.tasksNotFound > 0) {
        enqueueSnackbar(
          `${data.tasksNotFound} tasks in Excel were not found in the project`,
          { variant: 'warning' }
        );
      }
    },
    onError: (error: any) => {
      console.error('Update costs from Excel error:', error);
      enqueueSnackbar(
        error.response?.data?.error || 'Failed to update costs from Excel',
        { variant: 'error' }
      );
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      updateCostsFromExcelMutation.mutate(file);
      // Reset the input so the same file can be selected again
      event.target.value = '';
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => costsApi.create({ ...data, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
      queryClient.invalidateQueries({ queryKey: ['cost-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      enqueueSnackbar('Cost entry created successfully', { variant: 'success' });
      handleCloseDialog();
    },
    onError: (error: any) => {
      console.error('Create cost error:', error);
      enqueueSnackbar(
        error.response?.data?.error || 'Failed to create cost entry',
        { variant: 'error' }
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => costsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
      queryClient.invalidateQueries({ queryKey: ['cost-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      enqueueSnackbar('Cost entry updated successfully', { variant: 'success' });
      handleCloseDialog();
    },
    onError: (error: any) => {
      console.error('Update cost error:', error);
      enqueueSnackbar(
        error.response?.data?.error || 'Failed to update cost entry',
        { variant: 'error' }
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => costsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      queryClient.invalidateQueries({ queryKey: ['budget-status'] });
      queryClient.invalidateQueries({ queryKey: ['cost-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      enqueueSnackbar('Cost entry deleted successfully', { variant: 'success' });
    },
    onError: (error: any) => {
      console.error('Delete cost error:', error);
      enqueueSnackbar(
        error.response?.data?.error || 'Failed to delete cost entry',
        { variant: 'error' }
      );
    },
  });

  const handleOpenDialog = (cost?: CostEntry) => {
    if (cost) {
      setSelectedCost(cost);
      setFormData({
        amount: cost.amount.toString(),
        category: cost.category,
        description: cost.description,
        date: format(new Date(cost.date), 'yyyy-MM-dd'),
      });
    } else {
      setSelectedCost(null);
      setFormData({
        amount: '',
        category: 'labor',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedCost(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      amount: parseFloat(formData.amount),
      category: formData.category,
      description: formData.description,
      date: new Date(formData.date).toISOString(),
    };

    if (selectedCost) {
      updateMutation.mutate({ id: selectedCost.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this cost entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const getBudgetStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      case 'over_budget': return 'error';
      default: return 'info';
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const pieData = breakdown?.breakdown.map(item => ({
    name: item.category,
    value: item.amount,
    percentage: item.percentage,
  })) || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Cost Tracking</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.ods"
            style={{ display: 'none' }}
          />
          <Button
            variant="outlined"
            color="secondary"
            startIcon={updateCostsFromExcelMutation.isPending ? <CircularProgress size={20} /> : <UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={updateCostsFromExcelMutation.isPending}
          >
            {updateCostsFromExcelMutation.isPending ? 'Updating...' : 'Update Costs from Excel'}
          </Button>
          <Button
            variant="outlined"
            startIcon={recalculateMutation.isPending ? <CircularProgress size={20} /> : <RefreshIcon />}
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
          >
            {recalculateMutation.isPending ? 'Recalculating...' : 'Recalculate from Tasks'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add Cost
          </Button>
        </Box>
      </Box>

      {/* Budget Status */}
      {budgetStatus && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Budget Status</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">Budget</Typography>
                <Typography variant="h5">${budgetStatus.budget.toLocaleString()}</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">Spent</Typography>
                <Typography variant="h5" color={budgetStatus.isOverBudget ? 'error' : 'primary'}>
                  ${budgetStatus.spent.toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">Remaining</Typography>
                <Typography variant="h5" color={budgetStatus.remaining < 0 ? 'error' : 'success.main'}>
                  ${Math.abs(budgetStatus.remaining).toLocaleString()}
                  {budgetStatus.remaining < 0 && ' over'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Chip
                  label={budgetStatus.status.replace('_', ' ').toUpperCase()}
                  color={getBudgetStatusColor(budgetStatus.status) as any}
                  sx={{ mt: 0.5 }}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(budgetStatus.percentageUsed, 100)}
                color={getBudgetStatusColor(budgetStatus.status) as any}
                sx={{ height: 10, borderRadius: 5 }}
              />
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                {budgetStatus.percentageUsed.toFixed(1)}% of budget used
              </Typography>
            </Box>
            {budgetStatus.percentageUsed >= 75 && (
              <Alert severity={budgetStatus.isOverBudget ? 'error' : 'warning'} sx={{ mt: 2 }}>
                {budgetStatus.isOverBudget
                  ? 'Project is over budget! Consider cost reduction measures.'
                  : `Budget threshold reached. ${budgetStatus.remaining > 0 ? `$${budgetStatus.remaining.toLocaleString()} remaining` : ''}`
                }
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Cost Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Cost Breakdown</Typography>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Alert severity="info">No cost data available</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Summary Stats */}
        <Grid item xs={12} md={6}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MoneyIcon color="primary" />
                    <Typography variant="caption" color="text.secondary">Total Cost</Typography>
                  </Box>
                  <Typography variant="h4">${costs?.total.toLocaleString() || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {costs?.count || 0} entries
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {breakdown?.breakdown.slice(0, 3).map((item) => (
              <Grid item xs={12} key={item.category}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" textTransform="capitalize">
                          {item.category}
                        </Typography>
                        <Typography variant="h6">${item.amount.toLocaleString()}</Typography>
                      </Box>
                      <Chip label={`${item.percentage}%`} size="small" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>

      {/* Task Cost Summary - from imported data */}
      {taskCosts && taskCosts.summary.tasksWithCosts > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Imported Task Costs</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Found <strong>{taskCosts.summary.tasksWithCosts}</strong> tasks with cost data (from MS Project import).
                Click "Recalculate from Tasks" to update the project budget.
              </Typography>
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Total Baseline Cost</Typography>
                <Typography variant="h5" color="primary">
                  ${taskCosts.summary.totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Total Actual Cost</Typography>
                <Typography variant="h5">
                  ${taskCosts.summary.totalActualCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Cost Variance</Typography>
                <Typography
                  variant="h5"
                  color={taskCosts.summary.totalVariance >= 0 ? 'success.main' : 'error.main'}
                >
                  ${Math.abs(taskCosts.summary.totalVariance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {taskCosts.summary.totalVariance < 0 && ' over'}
                </Typography>
              </Grid>
            </Grid>

            {/* Top tasks by cost */}
            {taskCosts.tasks.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Top Tasks by Actual Cost</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Task</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Baseline Cost</TableCell>
                        <TableCell align="right">Actual Cost</TableCell>
                        <TableCell align="right">Variance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {taskCosts.tasks.slice(0, 10).map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>{task.title}</TableCell>
                          <TableCell>
                            <Chip label={task.status} size="small" />
                          </TableCell>
                          <TableCell align="right">
                            ${task.estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell align="right">
                            ${task.actualCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: task.variance >= 0 ? 'success.main' : 'error.main', fontWeight: 'medium' }}
                          >
                            ${Math.abs(task.variance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            {task.variance < 0 && ' over'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cost History Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Cost History (Manual Entries)</Typography>
          {costs && costs.entries.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {costs.entries.map((cost) => (
                    <TableRow key={cost.id}>
                      <TableCell>{format(new Date(cost.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{cost.description}</TableCell>
                      <TableCell>
                        <Chip
                          label={cost.category}
                          size="small"
                          sx={{ backgroundColor: CATEGORY_COLORS[cost.category], color: 'white' }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        ${cost.amount.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleOpenDialog(cost)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(cost.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">No cost entries yet. Click "Add Cost" to create your first entry.</Alert>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{selectedCost ? 'Edit Cost' : 'Add Cost'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                InputProps={{ startAdornment: '$' }}
              />
              <TextField
                select
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                required
              >
                {CATEGORIES.map((cat) => (
                  <MenuItem key={cat.value} value={cat.value}>{cat.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                multiline
                rows={3}
              />
              <TextField
                label="Date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

export default CostDashboard;

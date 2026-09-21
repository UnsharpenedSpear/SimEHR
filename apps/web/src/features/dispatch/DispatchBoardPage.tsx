import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tabs,
  Tab,
  Tooltip,
  CircularProgress,
  Alert,
  Paper,
  Divider,
} from '@mui/material';
import {
  Truck,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Filter,
  RefreshCw,
  Plus,
  Play,
  Pause,
  ArrowRight,
  Activity,
  Printer,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient.js';

interface DispatchItem {
  _id: string;
  orderId?: { _id: string; name: string; type: string; priority: string; indication?: string };
  patientId?: { _id: string; mrn: string; name: { given: string[]; family: string }; dob: string; sex: string };
  fromDeptId?: { _id: string; name: string; code: string };
  toDeptId?: { _id: string; name: string; code: string };
  assignedStaffId?: { _id: string; name: { given: string[]; family: string } };
  type: string;
  status: string;
  priority: string;
  notes?: string;
  slaMinutes: number;
  slaDueAt: string;
  isBreached: boolean;
  createdAt: string;
  events: Array<{ fromStatus: string; toStatus: string; timestamp: string; reason?: string }>;
}

export const DispatchBoardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'KANBAN' | 'LIST'>('KANBAN');
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchItem | null>(null);
  const [transitionDialogOpen, setTransitionDialogOpen] = useState<boolean>(false);
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [transitionReason, setTransitionReason] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);

  // Queries
  const { data: dispatches = [], isLoading, refetch } = useQuery<DispatchItem[]>({
    queryKey: ['dispatches', selectedDept, priorityFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedDept !== 'ALL') params.departmentId = selectedDept;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;
      const res = await apiClient.get('/dispatch', { params });
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await apiClient.get('/departments');
      return res.data.data;
    },
  });

  // Mutations
  const transitionMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const res = await apiClient.patch(`/dispatch/${id}/transition`, {
        targetStatus: status,
        reason,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      setTransitionDialogOpen(false);
      setTargetStatus('');
      setTransitionReason('');
      setSelectedDispatch(null);
    },
  });

  // KPI calculations
  const totalActive = dispatches.filter((d) => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(d.status)).length;
  const breachedCount = dispatches.filter((d) => d.isBreached).length;
  const statCount = dispatches.filter((d) => d.priority === 'STAT' && !['COMPLETED', 'REJECTED'].includes(d.status)).length;
  const inProgressCount = dispatches.filter((d) => d.status === 'IN_PROGRESS').length;

  const handleOpenTransition = (item: DispatchItem, nextStatus: string) => {
    setSelectedDispatch(item);
    setTargetStatus(nextStatus);
    setTransitionReason('');
    setTransitionDialogOpen(true);
  };

  const executeTransition = () => {
    if (!selectedDispatch || !targetStatus) return;
    transitionMutation.mutate({
      id: selectedDispatch._id,
      status: targetStatus,
      reason: transitionReason || undefined,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'STAT':
        return 'error';
      case 'URGENT':
        return 'warning';
      default:
        return 'info';
    }
  };

  const renderSlaBadge = (item: DispatchItem) => {
    const due = new Date(item.slaDueAt).getTime();
    const now = Date.now();
    const diffMins = Math.round((due - now) / 60000);

    if (item.isBreached || diffMins < 0) {
      return (
        <Chip
          size="small"
          color="error"
          variant="filled"
          icon={<AlertTriangle size={14} />}
          label={`Breached (${Math.abs(diffMins)}m overdue)`}
          sx={{ fontWeight: 'bold' }}
        />
      );
    }
    if (diffMins <= 10) {
      return (
        <Chip
          size="small"
          color="warning"
          variant="filled"
          icon={<Clock size={14} />}
          label={`${diffMins}m remaining`}
          sx={{ fontWeight: 'bold' }}
        />
      );
    }
    return (
      <Chip
        size="small"
        variant="outlined"
        icon={<Clock size={14} />}
        label={`${diffMins}m remaining`}
      />
    );
  };

  const kanbanColumns = [
    { id: 'CREATED', title: 'Created', color: '#E0E0E0' },
    { id: 'DISPATCHED', title: 'Dispatched', color: '#BBDEFB' },
    { id: 'ACKNOWLEDGED', title: 'Acknowledged', color: '#FFF9C4' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: '#FFE0B2' },
    { id: 'COMPLETED', title: 'Completed', color: '#C8E6C9' },
  ];

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header & Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Truck size={32} color="#005B94" />
            Real-Time Clinical Dispatch Board
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live telemetry, department worklists, specimen tracking, and SLA escalation monitor
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<RefreshCw size={18} />}
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant={viewMode === 'KANBAN' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('KANBAN')}
          >
            Kanban Board
          </Button>
          <Button
            variant={viewMode === 'LIST' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('LIST')}
          >
            List View
          </Button>
        </Stack>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.main' }}>
                <Activity size={28} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {totalActive}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Active Dispatch Tasks
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'error.light', color: 'error.main' }}>
                <AlertTriangle size={28} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: breachedCount > 0 ? 'error.main' : 'inherit' }}>
                  {breachedCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  SLA Breached Tasks
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'warning.light', color: 'warning.main' }}>
                <Clock size={28} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {statCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  STAT Priority Tasks
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'info.light', color: 'info.main' }}>
                <Truck size={28} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {inProgressCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Currently In Transit / Lab
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Bar */}
      <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Filter size={18} /> Department:
        </Typography>
        <Chip
          label="All Departments"
          clickable
          color={selectedDept === 'ALL' ? 'primary' : 'default'}
          onClick={() => setSelectedDept('ALL')}
        />
        {departments.map((dept: any) => (
          <Chip
            key={dept._id}
            label={dept.name}
            clickable
            color={selectedDept === dept._id ? 'primary' : 'default'}
            onClick={() => setSelectedDept(dept._id)}
          />
        ))}
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          Priority:
        </Typography>
        {['ALL', 'STAT', 'URGENT', 'ROUTINE'].map((p) => (
          <Chip
            key={p}
            label={p}
            clickable
            color={priorityFilter === p ? (p === 'STAT' ? 'error' : p === 'URGENT' ? 'warning' : 'primary') : 'default'}
            onClick={() => setPriorityFilter(p)}
          />
        ))}
      </Paper>

      {/* Kanban Board View */}
      {viewMode === 'KANBAN' && (
        <Grid container spacing={2} sx={{ minHeight: 500 }}>
          {kanbanColumns.map((col) => {
            const items = dispatches.filter((d) => d.status === col.id);
            return (
              <Grid item xs={12} md={2.4} key={col.id}>
                <Paper
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                    minHeight: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {col.title}
                    </Typography>
                    <Chip size="small" label={items.length} sx={{ fontWeight: 'bold' }} />
                  </Box>
                  <Divider />

                  <Stack spacing={1.5} sx={{ overflowY: 'auto', maxHeight: 600 }}>
                    {items.map((item) => (
                      <Card
                        key={item._id}
                        sx={{
                          borderRadius: 2,
                          boxShadow: item.isBreached ? 3 : 1,
                          borderLeft: '4px solid',
                          borderColor: item.isBreached
                            ? 'error.main'
                            : item.priority === 'STAT'
                            ? 'error.light'
                            : item.priority === 'URGENT'
                            ? 'warning.light'
                            : 'primary.light',
                          '&:hover': { boxShadow: 4 },
                        }}
                      >
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Chip
                              size="small"
                              label={item.priority}
                              color={getPriorityColor(item.priority) as any}
                              sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                            />
                            {renderSlaBadge(item)}
                          </Box>

                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {item.orderId?.name || item.type}
                          </Typography>

                          {item.patientId && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              Pt: {item.patientId.name?.family}, {item.patientId.name?.given?.[0]} (MRN: {item.patientId.mrn})
                            </Typography>
                          )}

                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Route: {item.fromDeptId?.code || 'ED'} &rarr; {item.toDeptId?.code || 'LAB'}
                          </Typography>

                          {item.notes && (
                            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                              "{item.notes}"
                            </Typography>
                          )}

                          <Divider sx={{ my: 1 }} />

                          {/* Quick Transitions */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Tooltip title="View Routing Slip (PDF)">
                              <IconButton
                                size="small"
                                onClick={() => window.open(`/api/v1/dispatch/${item._id}/routing-slip`, '_blank')}
                              >
                                <Printer size={16} />
                              </IconButton>
                            </Tooltip>

                            <Stack direction="row" spacing={0.5}>
                              {col.id === 'CREATED' && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  onClick={() => handleOpenTransition(item, 'DISPATCHED')}
                                >
                                  Dispatch
                                </Button>
                              )}
                              {col.id === 'DISPATCHED' && (
                                <>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    onClick={() => handleOpenTransition(item, 'REJECTED')}
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="primary"
                                    onClick={() => handleOpenTransition(item, 'ACKNOWLEDGED')}
                                  >
                                    Acknowledge
                                  </Button>
                                </>
                              )}
                              {col.id === 'ACKNOWLEDGED' && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  onClick={() => handleOpenTransition(item, 'IN_PROGRESS')}
                                >
                                  Start
                                </Button>
                              )}
                              {col.id === 'IN_PROGRESS' && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  onClick={() => handleOpenTransition(item, 'COMPLETED')}
                                >
                                  Complete
                                </Button>
                              )}
                            </Stack>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Transition Dialog with Mandatory Reason for Rejection / Hold */}
      <Dialog open={transitionDialogOpen} onClose={() => setTransitionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Transition Dispatch Task Status
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2">
              Transitioning task <strong>{selectedDispatch?._id}</strong> from{' '}
              <Chip size="small" label={selectedDispatch?.status} /> to{' '}
              <Chip size="small" color="primary" label={targetStatus} />
            </Typography>

            {['REJECTED', 'ON_HOLD', 'CANCELLED'].includes(targetStatus) && (
              <Alert severity="warning">
                A detailed clinical / logistical reason is <strong>mandatory</strong> for {targetStatus}.
              </Alert>
            )}

            <TextField
              label="Clinical / Logistical Reason"
              placeholder={
                targetStatus === 'REJECTED'
                  ? 'e.g., Hemolyzed specimen, incorrect tube type, insufficient volume'
                  : 'Enter notes or reason'
              }
              fullWidth
              multiline
              rows={3}
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
              required={['REJECTED', 'ON_HOLD', 'CANCELLED'].includes(targetStatus)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransitionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={targetStatus === 'REJECTED' ? 'error' : 'primary'}
            onClick={executeTransition}
            disabled={
              transitionMutation.isPending ||
              (['REJECTED', 'ON_HOLD', 'CANCELLED'].includes(targetStatus) && !transitionReason.trim())
            }
          >
            {transitionMutation.isPending ? <CircularProgress size={20} /> : 'Confirm Transition'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

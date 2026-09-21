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
  Tooltip,
  CircularProgress,
  Alert,
  Paper,
  Divider,
} from '@mui/material';
import {
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Video,
  Stethoscope,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient.js';

interface AppointmentItem {
  _id: string;
  patientId?: { _id: string; mrn: string; name: { given: string[]; family: string }; dob: string; sex: string };
  providerId?: { _id: string; name: { given: string[]; family: string }; professional?: { title: string; specialty: string } };
  departmentId?: { _id: string; name: string; code: string };
  encounterId?: string;
  type: string;
  status: string;
  start: string;
  end: string;
  durationMin: number;
  reason: string;
  room?: string;
  notes?: string;
  checkedInAt?: string;
}

export const AppointmentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Form state for creating appointment
  const [formPatientId, setFormPatientId] = useState('');
  const [formProviderId, setFormProviderId] = useState('');
  const [formDeptId, setFormDeptId] = useState('');
  const [formType, setFormType] = useState('ROUTINE');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formRoom, setFormRoom] = useState('Room 1');

  // Queries
  const { data: appointments = [], isLoading, refetch } = useQuery<AppointmentItem[]>({
    queryKey: ['appointments', selectedDate],
    queryFn: async () => {
      const startOfDay = `${selectedDate}T00:00:00.000Z`;
      const endOfDay = `${selectedDate}T23:59:59.999Z`;
      const res = await apiClient.get('/appointments', {
        params: { startDate: startOfDay, endDate: endOfDay },
      });
      return res.data.data;
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-list'],
    queryFn: async () => {
      const res = await apiClient.get('/patients', { params: { limit: 50 } });
      return res.data.data.patients || [];
    },
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers-list'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/users');
      return res.data.data || [];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const res = await apiClient.get('/departments');
      return res.data.data || [];
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/appointments', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setCreateDialogOpen(false);
      setErrorMessage('');
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || 'Failed to schedule appointment (possible double-booking conflict)');
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/appointments/${id}/check-in`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.patch(`/appointments/${id}/status`, { status });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const handleCreate = () => {
    if (!formPatientId || !formProviderId || !formDeptId || !formStart || !formEnd || !formReason) {
      setErrorMessage('Please fill in all mandatory fields');
      return;
    }
    const patientObj = patients.find((p: any) => p._id === formPatientId);
    createMutation.mutate({
      patientId: formPatientId,
      providerId: formProviderId,
      facilityId: patientObj?.facilityId || '650000000000000000000001',
      departmentId: formDeptId,
      type: formType,
      start: new Date(formStart).toISOString(),
      end: new Date(formEnd).toISOString(),
      reason: formReason,
      room: formRoom,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CHECKED_IN':
        return 'success';
      case 'IN_CONSULTATION':
        return 'primary';
      case 'COMPLETED':
        return 'default';
      case 'CANCELLED':
      case 'NO_SHOW':
        return 'error';
      default:
        return 'info';
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CalendarIcon size={32} color="#005B94" />
            Outpatient & Surgical Scheduling
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Multi-provider scheduling, collision-prevention engine, and automated clinical check-in
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField
            type="date"
            size="small"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
          />
          <Button variant="outlined" startIcon={<RefreshCw size={18} />} onClick={() => refetch()}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => {
              setErrorMessage('');
              setCreateDialogOpen(true);
            }}
          >
            New Appointment
          </Button>
        </Stack>
      </Box>

      {/* Appointments List / Grid */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : appointments.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3 }}>
          <CalendarIcon size={48} color="#999999" />
          <Typography variant="h6" sx={{ mt: 2, fontWeight: 'bold' }}>
            No appointments scheduled for {selectedDate}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click "New Appointment" above to book a clinical encounter.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {appointments.map((appt) => (
            <Grid item xs={12} md={6} lg={4} key={appt._id}>
              <Card
                sx={{
                  borderRadius: 3,
                  boxShadow: 2,
                  borderLeft: '5px solid',
                  borderColor:
                    appt.status === 'CHECKED_IN'
                      ? 'success.main'
                      : appt.status === 'IN_CONSULTATION'
                      ? 'primary.main'
                      : 'info.main',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Chip
                      size="small"
                      label={appt.status.replace('_', ' ')}
                      color={getStatusColor(appt.status) as any}
                      sx={{ fontWeight: 'bold' }}
                    />
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Clock size={14} color="#666" />
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                        {new Date(appt.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(appt.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({appt.durationMin}m)
                      </Typography>
                    </Stack>
                  </Box>

                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    {appt.patientId?.name?.family}, {appt.patientId?.name?.given?.join(' ')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    MRN: {appt.patientId?.mrn} | Sex: {appt.patientId?.sex} | DOB: {appt.patientId?.dob}
                  </Typography>

                  <Divider sx={{ my: 1.5 }} />

                  <Typography variant="body2" sx={{ fontWeight: '500' }}>
                    <strong>Provider:</strong> Dr. {appt.providerId?.name?.family}, {appt.providerId?.name?.given?.[0]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Dept / Room:</strong> {appt.departmentId?.name || 'Main Clinic'} ({appt.room || 'Room 1'})
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <strong>Reason:</strong> {appt.reason}
                  </Typography>

                  <Divider sx={{ my: 1.5 }} />

                  {/* Actions */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip size="small" variant="outlined" label={appt.type} />
                    <Stack direction="row" spacing={1}>
                      {appt.status === 'CONFIRMED' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<UserCheck size={16} />}
                          onClick={() => checkInMutation.mutate(appt._id)}
                          disabled={checkInMutation.isPending}
                        >
                          Check-In
                        </Button>
                      )}
                      {appt.status === 'CHECKED_IN' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<Stethoscope size={16} />}
                          onClick={() => statusMutation.mutate({ id: appt._id, status: 'IN_CONSULTATION' })}
                        >
                          Start Visit
                        </Button>
                      )}
                      {appt.status === 'IN_CONSULTATION' && (
                        <Button
                          size="small"
                          variant="contained"
                          color="info"
                          startIcon={<CheckCircle2 size={16} />}
                          onClick={() => statusMutation.mutate({ id: appt._id, status: 'COMPLETED' })}
                        >
                          Complete
                        </Button>
                      )}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Book Appointment Modal */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Schedule New Appointment</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

            <FormControl fullWidth size="small">
              <InputLabel>Patient</InputLabel>
              <Select value={formPatientId} label="Patient" onChange={(e) => setFormPatientId(e.target.value)}>
                {patients.map((p: any) => (
                  <MenuItem key={p._id} value={p._id}>
                    {p.name.family}, {p.name.given?.join(' ')} (MRN: {p.mrn})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Provider</InputLabel>
              <Select value={formProviderId} label="Provider" onChange={(e) => setFormProviderId(e.target.value)}>
                {providers.map((u: any) => (
                  <MenuItem key={u._id} value={u._id}>
                    Dr. {u.name.family}, {u.name.given?.join(' ')} ({u.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select value={formDeptId} label="Department" onChange={(e) => setFormDeptId(e.target.value)}>
                {departments.map((d: any) => (
                  <MenuItem key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select value={formType} label="Type" onChange={(e) => setFormType(e.target.value)}>
                    <MenuItem value="ROUTINE">Routine Consultation</MenuItem>
                    <MenuItem value="FOLLOW_UP">Follow-Up</MenuItem>
                    <MenuItem value="NEW_PATIENT">New Patient</MenuItem>
                    <MenuItem value="PROCEDURE">Procedure / Surgery</MenuItem>
                    <MenuItem value="TELEHEALTH">Telehealth</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Room"
                  size="small"
                  fullWidth
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Start Time"
                  type="datetime-local"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="End Time"
                  type="datetime-local"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                />
              </Grid>
            </Grid>

            <TextField
              label="Chief Complaint / Reason"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? <CircularProgress size={20} /> : 'Confirm Booking'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

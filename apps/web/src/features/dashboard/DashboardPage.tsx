import React from 'react';
import { Box, Typography, Grid, Paper, Stack, Button, Chip } from '@mui/material';
import {
  Users,
  Send,
  FlaskConical,
  AlertTriangle,
  Activity,
  Calendar,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { StatusChip } from '../../components/common/StatusChip.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const roleName = user?.roles?.[0] || 'Clinician';

  const kpis = [
    {
      title: "Today's Appointments",
      value: '18',
      subtitle: '3 checked-in, 2 in progress',
      icon: <Calendar size={24} color="#006874" />,
      action: () => navigate('/appointments'),
    },
    {
      title: 'Active Dispatches',
      value: '7',
      subtitle: '2 STAT, 1 SLA Warning',
      icon: <Send size={24} color="#e65100" />,
      action: () => navigate('/dispatch'),
    },
    {
      title: 'Pending Lab Orders',
      value: '12',
      subtitle: '4 awaiting collection',
      icon: <FlaskConical size={24} color="#0288d1" />,
      action: () => navigate('/lab'),
    },
    {
      title: 'Critical Results',
      value: '1',
      subtitle: 'Requires immediate physician sign-off',
      icon: <AlertTriangle size={24} color="#b3261e" />,
      action: () => navigate('/lab'),
    },
  ];

  return (
    <Box>
      {/* Welcome Banner */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 4,
          background: 'linear-gradient(135deg, #006874 0%, #004f58 100%)',
          color: '#ffffff',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Welcome back, {user?.name?.given?.[0] || 'Dr.'} {user?.name?.family || 'Staff'}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Simulated EHR Clinical Workspace • Role: <strong>{roleName}</strong> • Facility ID: {user?.activeFacilityId || 'FAC-MAIN'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              sx={{ bgcolor: '#97f0ff', color: '#001f24', fontWeight: 700, '&:hover': { bgcolor: '#cde7ec' } }}
              onClick={() => navigate('/patients/new')}
            >
              + Register Patient
            </Button>
            <Button
              variant="outlined"
              sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.6)', '&:hover': { borderColor: '#ffffff' } }}
              onClick={() => navigate('/dispatch')}
            >
              View Dispatch Board
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {kpis.map((kpi, idx) => (
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Paper
              sx={{
                p: 2.5,
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                },
              }}
              onClick={kpi.action}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
                    {kpi.title}
                  </Typography>
                  <Typography variant="h3" fontWeight={700} sx={{ my: 0.5 }}>
                    {kpi.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {kpi.subtitle}
                  </Typography>
                </Box>
                <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'action.hover' }}>{kpi.icon}</Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Recent Dispatches & Critical Alerts Preview */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>
                STAT & Urgent Dispatches
              </Typography>
              <Button size="small" endIcon={<ArrowRight size={16} />} onClick={() => navigate('/dispatch')}>
                View All
              </Button>
            </Stack>
            <Stack spacing={1.5}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#fff8f6' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2" fontWeight={700}>
                        DISP-9021 • STAT CBC + Differential
                      </Typography>
                      <StatusChip status="STAT" category="priority" />
                      <StatusChip status="IN_PROGRESS" category="dispatch" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Patient: John Doe (MRN: MRN-100234) • Destination: Central Lab • SLA Remaining: 14 mins
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2" fontWeight={700}>
                        DISP-9024 • URGENT Chest X-Ray 2-View
                      </Typography>
                      <StatusChip status="URGENT" category="priority" />
                      <StatusChip status="DISPATCHED" category="dispatch" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Patient: Jane Smith (MRN: MRN-100289) • Destination: Radiology • SLA Remaining: 42 mins
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              Quick Clinical Actions
            </Typography>
            <Stack spacing={1.5}>
              <Button
                variant="outlined"
                fullWidth
                sx={{ justifyContent: 'flex-start', py: 1.25, borderRadius: 2 }}
                onClick={() => navigate('/patients')}
              >
                🔍 Patient Search & Lookup (⌘K)
              </Button>
              <Button
                variant="outlined"
                fullWidth
                sx={{ justifyContent: 'flex-start', py: 1.25, borderRadius: 2 }}
                onClick={() => navigate('/appointments')}
              >
                📅 View Clinical Calendar & Schedule
              </Button>
              <Button
                variant="outlined"
                fullWidth
                sx={{ justifyContent: 'flex-start', py: 1.25, borderRadius: 2 }}
                onClick={() => navigate('/reports')}
              >
                📊 Department Operational Reports
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Paper,
  Divider,
  Stack,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  BarChart3,
  TrendingUp,
  Activity,
  Users,
  Clock,
  DollarSign,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient.js';

export const ReportsPage: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);

  // Queries
  const { data: censusData, isLoading: censusLoading, refetch: refetchCensus } = useQuery({
    queryKey: ['report-census'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/census');
      return res.data.data;
    },
  });

  const { data: slaData, isLoading: slaLoading, refetch: refetchSla } = useQuery({
    queryKey: ['report-sla'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/dispatch-sla');
      return res.data.data;
    },
  });

  const { data: financialData, isLoading: finLoading, refetch: refetchFin } = useQuery({
    queryKey: ['report-financial'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/financial');
      return res.data.data;
    },
  });

  const COLORS = ['#005B94', '#00A86B', '#FFB000', '#D32F2F', '#9C27B0', '#00BCD4'];

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BarChart3 size={32} color="#005B94" />
            Executive & Clinical Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Daily census, dispatch turnaround telemetry, SLA compliance, and revenue cycle reporting
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshCw size={18} />}
          onClick={() => {
            refetchCensus();
            refetchSla();
            refetchFin();
          }}
        >
          Refresh All Data
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<Users size={18} />} iconPosition="start" label="Hospital Census & Occupancy" />
        <Tab icon={<Clock size={18} />} iconPosition="start" label="Dispatch SLA & Turnaround" />
        <Tab icon={<DollarSign size={18} />} iconPosition="start" label="Financial Performance" />
      </Tabs>

      {/* Tab 0: Hospital Census */}
      {currentTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.main' }}>
                    <Users size={28} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {censusData?.totalActivePatients || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Active Inpatients / ED Patients
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Patient Distribution by Department
            </Typography>
            {censusLoading ? (
              <CircularProgress />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={censusData?.byDepartment || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="departmentName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="activeCount" name="Active Patients" fill="#005B94" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Box>
      )}

      {/* Tab 1: Dispatch SLA */}
      {currentTab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'success.light', color: 'success.main' }}>
                    <ShieldCheck size={28} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      {slaData?.overallCompliancePercent || 100}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Overall SLA Compliance Rate
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'info.light', color: 'info.main' }}>
                    <Activity size={28} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {slaData?.overallTotal || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Dispatched Tasks
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'error.light', color: 'error.main' }}>
                    <Clock size={28} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                      {slaData?.overallBreached || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      SLA Breaches
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              Compliance Rate (%) by Dispatch Type
            </Typography>
            {slaLoading ? (
              <CircularProgress />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={slaData?.byType || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="complianceRatePercent" name="Compliance %" fill="#00A86B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Box>
      )}

      {/* Tab 2: Financial Performance */}
      {currentTab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Total Billed (Gross)
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mt: 1 }}>
                    ${(financialData?.summary?.totalBilled || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Total Collected (Cash & Claims)
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main', mt: 1 }}>
                    ${(financialData?.summary?.totalCollected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Total Accounts Receivable (A/R)
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.main', mt: 1 }}>
                    ${(financialData?.summary?.totalOutstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
};

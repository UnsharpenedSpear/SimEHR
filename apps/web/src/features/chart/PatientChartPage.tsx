import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Stack,
  Chip,
  Grid,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Activity,
  Calendar,
  FileText,
  AlertCircle,
  ShieldAlert,
  TrendingUp,
  Plus,
  CheckCircle2,
  Lock,
  Edit,
  Clock,
  Send,
  Upload,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Legend } from 'recharts';
import { apiClient } from '../../services/apiClient.js';
import { useAuthStore } from '../../stores/authStore.js';
import { PatientBanner } from '../../components/common/PatientBanner.js';
import { StatusChip } from '../../components/common/StatusChip.js';
import { PERMISSIONS } from '@ehr/shared';

export const PatientChartPage: React.FC = () => {
  const { id: patientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuthStore();
  const [currentTab, setCurrentTab] = useState(0);

  // Dialog States
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [amendModalOpen, setAmendModalOpen] = useState<string | null>(null);
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [allergyModalOpen, setAllergyModalOpen] = useState(false);
  const [encounterModalOpen, setEncounterModalOpen] = useState(false);
  const [breakGlassModalOpen, setBreakGlassModalOpen] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState('');

  // Form states
  const [vitalsForm, setVitalsForm] = useState({
    systolic: '',
    diastolic: '',
    hr: '',
    rr: '',
    tempC: '',
    spo2: '',
    weightKg: '',
    heightCm: '',
  });

  const [noteForm, setNoteForm] = useState({
    encounterId: '',
    title: 'Progress Note',
    template: 'SOAP',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  const [amendReason, setAmendReason] = useState('');
  const [amendContent, setAmendContent] = useState('');

  const [problemForm, setProblemForm] = useState({
    icd10: '',
    description: '',
    status: 'ACTIVE',
  });

  const [allergyForm, setAllergyForm] = useState({
    substance: '',
    category: 'MEDICATION',
    reactions: '',
    severity: 'MODERATE',
  });

  const [encounterForm, setEncounterForm] = useState({
    type: 'OUTPATIENT',
    departmentId: '65f0a1b2c3d4e5f6a7b8c902',
    reasonForVisit: '',
    diagnosisCode: '',
    diagnosisDisplay: '',
  });

  // Queries
  const { data: chartSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['patient-chart-summary', patientId],
    queryFn: async () => {
      const res = await apiClient.get(`/patients/${patientId}/chart-summary`);
      return res.data.data;
    },
    enabled: !!patientId,
  });

  const { data: timeline } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: async () => {
      const res = await apiClient.get(`/patients/${patientId}/timeline`);
      return res.data.data;
    },
    enabled: !!patientId,
  });

  const { data: vitalsTrend } = useQuery({
    queryKey: ['patient-vitals-trend', patientId],
    queryFn: async () => {
      const res = await apiClient.get(`/patients/${patientId}/vitals/trend`);
      return res.data.data;
    },
    enabled: !!patientId,
  });

  const { data: encounters } = useQuery({
    queryKey: ['patient-encounters', patientId],
    queryFn: async () => {
      const res = await apiClient.get(`/patients/${patientId}/encounters`);
      return res.data.data;
    },
    enabled: !!patientId,
  });

  const { data: notes } = useQuery({
    queryKey: ['patient-notes', patientId],
    queryFn: async () => {
      const res = await apiClient.get(`/patients/${patientId}/notes`);
      return res.data.data;
    },
    enabled: !!patientId,
  });

  // Mutations
  const addVitalsMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post(`/patients/${patientId}/vitals`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-chart-summary', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-vitals-trend', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
      setVitalsModalOpen(false);
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post(`/patients/${patientId}/notes`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-notes', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
      setNoteModalOpen(false);
    },
  });

  const signNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await apiClient.post(`/notes/${noteId}/sign`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-notes', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
    },
  });

  const amendNoteMutation = useMutation({
    mutationFn: async ({ noteId, reason, content }: { noteId: string; reason: string; content: string }) => {
      const res = await apiClient.post(`/notes/${noteId}/amend`, {
        amendmentReason: reason,
        content: { addendum: content },
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-notes', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
      setAmendModalOpen(null);
    },
  });

  const addProblemMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post(`/patients/${patientId}/problems`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-chart-summary', patientId] });
      setProblemModalOpen(false);
    },
  });

  const addAllergyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post(`/patients/${patientId}/allergies`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-chart-summary', patientId] });
      setAllergyModalOpen(false);
    },
  });

  const createEncounterMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post(`/patients/${patientId}/encounters`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-encounters', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-chart-summary', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] });
      setEncounterModalOpen(false);
    },
  });

  const breakGlassMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiClient.post(`/patients/${patientId}/break-glass`, { reason });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-chart-summary', patientId] });
      setBreakGlassModalOpen(false);
    },
  });

  if (summaryLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const patient = chartSummary?.banner;

  return (
    <Box>
      {/* Persistent Patient Banner */}
      {patient && (
        <PatientBanner
          patient={patient}
          onBreakGlass={() => setBreakGlassModalOpen(true)}
          isRestrictedView={patient.flags?.restricted}
        />
      )}

      {/* Main Tabs Navigation */}
      <Paper sx={{ mb: 3, borderRadius: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(_, val) => setCurrentTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2 }}
        >
          <Tab icon={<Activity size={18} />} iconPosition="start" label="Overview & Timeline" />
          <Tab icon={<Calendar size={18} />} iconPosition="start" label="Encounters" />
          <Tab icon={<TrendingUp size={18} />} iconPosition="start" label="Vitals & Trends" />
          <Tab icon={<FileText size={18} />} iconPosition="start" label="Clinical Notes" />
          <Tab icon={<AlertCircle size={18} />} iconPosition="start" label="Problems & Diagnoses" />
          <Tab icon={<AlertCircle size={18} />} iconPosition="start" label="Allergies" />
        </Tabs>
      </Paper>

      {/* Tab 0: Overview & Timeline */}
      {currentTab === 0 && (
        <Grid container spacing={3}>
          {/* Left Column: Quick Snapshot Cards */}
          <Grid item xs={12} md={4}>
            <Stack spacing={2.5}>
              {/* Active Problems Card */}
              <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Active Problems (ICD-10)
                  </Typography>
                  <IconButton size="small" onClick={() => setProblemModalOpen(true)}>
                    <Plus size={18} />
                  </IconButton>
                </Stack>
                {chartSummary?.problems && chartSummary.problems.length > 0 ? (
                  <Stack spacing={1}>
                    {chartSummary.problems.map((prob: any) => (
                      <Paper key={prob._id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {prob.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ICD-10: <code>{prob.icd10}</code> • Status: {prob.status}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No active problem records documented.
                  </Typography>
                )}
              </Paper>

              {/* Latest Vitals Snapshot */}
              <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Latest Vital Signs
                  </Typography>
                  <Button size="small" startIcon={<Plus size={14} />} onClick={() => setVitalsModalOpen(true)}>
                    Record
                  </Button>
                </Stack>
                {chartSummary?.lastVitals ? (
                  <Grid container spacing={1.5}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Blood Pressure
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>
                        {chartSummary.lastVitals.bp?.systolic}/{chartSummary.lastVitals.bp?.diastolic} mmHg
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Heart Rate
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>
                        {chartSummary.lastVitals.hr} bpm
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Oxygen Saturation
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>
                        {chartSummary.lastVitals.spo2}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Temperature
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>
                        {chartSummary.lastVitals.tempC}°C
                      </Typography>
                    </Grid>
                    {chartSummary.lastVitals.abnormalFlags?.length > 0 && (
                      <Grid item xs={12}>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {chartSummary.lastVitals.abnormalFlags.map((flag: string) => (
                            <Chip key={flag} label={flag} size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />
                          ))}
                        </Stack>
                      </Grid>
                    )}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No vitals recorded yet.
                  </Typography>
                )}
              </Paper>
            </Stack>
          </Grid>

          {/* Right Column: Unified Chronological Timeline Feed */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Patient Care Timeline & History
              </Typography>
              {timeline && timeline.length > 0 ? (
                <Stack spacing={2}>
                  {timeline.map((item: any, idx: number) => (
                    <Paper
                      key={item._id || idx}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        borderLeft: '4px solid',
                        borderLeftColor:
                          item.type === 'ENCOUNTER'
                            ? 'primary.main'
                            : item.type === 'CLINICAL_NOTE'
                            ? 'secondary.main'
                            : item.type === 'VITALS'
                            ? item.status === 'ABNORMAL'
                              ? 'error.main'
                              : 'success.main'
                            : 'info.main',
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Typography variant="subtitle2" fontWeight={700}>
                            {item.title}
                          </Typography>
                          <Chip label={item.type} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(item.timestamp).toLocaleString()}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {item.subtitle}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No activity history on record for this patient.
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Tab 1: Encounters */}
      {currentTab === 1 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Clinical Encounters & Visits
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Outpatient, Inpatient, Emergency, and Telehealth visits documented with primary diagnoses.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => setEncounterModalOpen(true)}
                sx={{ borderRadius: 2 }}
              >
                Start Encounter
              </Button>
            </Stack>
          </Paper>

          <Stack spacing={2}>
            {encounters?.map((enc: any) => (
              <Paper key={enc._id} sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="subtitle1" fontWeight={700}>
                        {enc.type} Encounter • {new Date(enc.start).toLocaleDateString()}
                      </Typography>
                      <StatusChip status={enc.status} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      <strong>Reason for Visit:</strong> {enc.reasonForVisit}
                    </Typography>
                    {enc.diagnoses?.length > 0 && (
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        {enc.diagnoses.map((d: any, idx: number) => (
                          <Chip
                            key={idx}
                            label={`${d.display} (${d.code})`}
                            size="small"
                            color={d.isPrimary ? 'primary' : 'default'}
                          />
                        ))}
                      </Stack>
                    )}
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setNoteForm((prev) => ({ ...prev, encounterId: enc._id }));
                      setNoteModalOpen(true);
                    }}
                  >
                    + Add SOAP Note
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      {/* Tab 2: Vitals & Trends */}
      {currentTab === 2 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Vitals History & Physiological Trends
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Continuous multi-parameter tracking with automatic BMI derivation and abnormal alerts.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => setVitalsModalOpen(true)}
                sx={{ borderRadius: 2 }}
              >
                Record Vitals
              </Button>
            </Stack>
          </Paper>

          {/* Blood Pressure & Heart Rate Trend Chart */}
          {vitalsTrend && vitalsTrend.length > 0 ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, borderRadius: 3 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                    Blood Pressure Trend (mmHg)
                  </Typography>
                  <Box sx={{ height: 280, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={vitalsTrend}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="dateLabel" />
                        <YAxis domain={[40, 200]} />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="systolic" stroke="#b3261e" strokeWidth={2} name="Systolic (mmHg)" />
                        <Line type="monotone" dataKey="diastolic" stroke="#006874" strokeWidth={2} name="Diastolic (mmHg)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, borderRadius: 3 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                    Heart Rate & SpO2 Trends
                  </Typography>
                  <Box sx={{ height: 280, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={vitalsTrend}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="dateLabel" />
                        <YAxis domain={[40, 160]} />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="hr" stroke="#e65100" strokeWidth={2} name="Heart Rate (bpm)" />
                        <Line type="monotone" dataKey="spo2" stroke="#0288d1" strokeWidth={2} name="SpO2 (%)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
              <Typography variant="body1" color="text.secondary">
                No longitudinal vitals recordings yet to render trend charts.
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Tab 3: Clinical Notes */}
      {currentTab === 3 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Clinical Documentation & SOAP Notes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Structured narrative documentation. Signed notes are immutable; amendments create versioned audit trails.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => setNoteModalOpen(true)}
                sx={{ borderRadius: 2 }}
              >
                Create Note Draft
              </Button>
            </Stack>
          </Paper>

          <Stack spacing={2.5}>
            {notes?.map((note: any) => (
              <Paper key={note._id} sx={{ p: 3, borderRadius: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="h6" fontWeight={700}>
                        {note.title}
                      </Typography>
                      <StatusChip status={note.status} category="note" />
                      {note.version > 1 && (
                        <Chip label={`v${note.version}`} size="small" variant="outlined" sx={{ height: 20 }} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Authored by: {note.authorId?.name?.given?.join(' ')} {note.authorId?.name?.family} •{' '}
                      {new Date(note.createdAt).toLocaleString()}
                      {note.signedAt && ` • Signed: ${new Date(note.signedAt).toLocaleString()}`}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    {note.status === 'DRAFT' && (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<CheckCircle2 size={16} />}
                        onClick={() => signNoteMutation.mutate(note._id)}
                      >
                        Sign Note (Finalize)
                      </Button>
                    )}
                    {note.status === 'SIGNED' && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Edit size={16} />}
                        onClick={() => setAmendModalOpen(note._id)}
                      >
                        Amend Note
                      </Button>
                    )}
                  </Stack>
                </Stack>

                {note.amendmentReason && (
                  <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                    <strong>Amendment Reason:</strong> {note.amendmentReason}
                  </Alert>
                )}

                {/* Structured Sections */}
                <Grid container spacing={2}>
                  {note.content && typeof note.content === 'object' ? (
                    Object.entries(note.content).map(([key, value]: [string, any]) => (
                      <Grid item xs={12} sm={6} key={key}>
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                          <Typography variant="subtitle2" fontWeight={700} textTransform="uppercase" color="primary.main">
                            {key}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                            {value}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))
                  ) : (
                    <Grid item xs={12}>
                      <Typography variant="body2">{String(note.content)}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      {/* Tab 4: Problems List */}
      {currentTab === 4 && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              ICD-10 Problem & Diagnosis List
            </Typography>
            <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setProblemModalOpen(true)}>
              Add Problem
            </Button>
          </Stack>
          <Stack spacing={1.5}>
            {chartSummary?.problems?.map((prob: any) => (
              <Paper key={prob._id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {prob.description} (ICD-10: <code>{prob.icd10}</code>)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Status: <strong>{prob.status}</strong> • Onset: {prob.onset || 'Not specified'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Tab 5: Allergies */}
      {currentTab === 5 && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              Documented Allergies & Adverse Reactions
            </Typography>
            <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAllergyModalOpen(true)}>
              Add Allergy
            </Button>
          </Stack>
          <Stack spacing={1.5}>
            {chartSummary?.allergies?.map((allergy: any) => (
              <Paper key={allergy._id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2" fontWeight={700}>
                        {allergy.substance}
                      </Typography>
                      <Chip label={allergy.severity} size="small" color="error" />
                      <Chip label={allergy.category} size="small" variant="outlined" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Reactions: {allergy.reactions?.join(', ')} • Status: {allergy.status}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Record Vitals Dialog */}
      <Dialog open={vitalsModalOpen} onClose={() => setVitalsModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Record Patient Vital Signs</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <TextField
                label="Systolic BP (mmHg)"
                fullWidth
                type="number"
                value={vitalsForm.systolic}
                onChange={(e) => setVitalsForm({ ...vitalsForm, systolic: e.target.value })}
                placeholder="120"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Diastolic BP (mmHg)"
                fullWidth
                type="number"
                value={vitalsForm.diastolic}
                onChange={(e) => setVitalsForm({ ...vitalsForm, diastolic: e.target.value })}
                placeholder="80"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Heart Rate (bpm)"
                fullWidth
                type="number"
                value={vitalsForm.hr}
                onChange={(e) => setVitalsForm({ ...vitalsForm, hr: e.target.value })}
                placeholder="72"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="SpO2 (%)"
                fullWidth
                type="number"
                value={vitalsForm.spo2}
                onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: e.target.value })}
                placeholder="98"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Temperature (°C)"
                fullWidth
                type="number"
                value={vitalsForm.tempC}
                onChange={(e) => setVitalsForm({ ...vitalsForm, tempC: e.target.value })}
                placeholder="37.0"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Respiratory Rate (/min)"
                fullWidth
                type="number"
                value={vitalsForm.rr}
                onChange={(e) => setVitalsForm({ ...vitalsForm, rr: e.target.value })}
                placeholder="16"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Weight (kg)"
                fullWidth
                type="number"
                value={vitalsForm.weightKg}
                onChange={(e) => setVitalsForm({ ...vitalsForm, weightKg: e.target.value })}
                placeholder="70"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Height (cm)"
                fullWidth
                type="number"
                value={vitalsForm.heightCm}
                onChange={(e) => setVitalsForm({ ...vitalsForm, heightCm: e.target.value })}
                placeholder="175"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setVitalsModalOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              addVitalsMutation.mutate({
                bp: vitalsForm.systolic ? { systolic: Number(vitalsForm.systolic), diastolic: Number(vitalsForm.diastolic) } : undefined,
                hr: vitalsForm.hr ? Number(vitalsForm.hr) : undefined,
                spo2: vitalsForm.spo2 ? Number(vitalsForm.spo2) : undefined,
                tempC: vitalsForm.tempC ? Number(vitalsForm.tempC) : undefined,
                rr: vitalsForm.rr ? Number(vitalsForm.rr) : undefined,
                weightKg: vitalsForm.weightKg ? Number(vitalsForm.weightKg) : undefined,
                heightCm: vitalsForm.heightCm ? Number(vitalsForm.heightCm) : undefined,
              })
            }
          >
            Save Vitals
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create SOAP Note Dialog */}
      <Dialog open={noteModalOpen} onClose={() => setNoteModalOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Document SOAP Clinical Note</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Note Title"
              fullWidth
              value={noteForm.title}
              onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
            />
            <TextField
              select
              label="Associated Encounter"
              fullWidth
              required
              value={noteForm.encounterId || encounters?.[0]?._id || ''}
              onChange={(e) => setNoteForm({ ...noteForm, encounterId: e.target.value })}
            >
              {encounters?.map((enc: any) => (
                <MenuItem key={enc._id} value={enc._id}>
                  {enc.type} Encounter - {new Date(enc.start).toLocaleDateString()} ({enc.reasonForVisit})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Subjective (History of Present Illness, Symptoms)"
              multiline
              rows={3}
              fullWidth
              value={noteForm.subjective}
              onChange={(e) => setNoteForm({ ...noteForm, subjective: e.target.value })}
            />
            <TextField
              label="Objective (Physical Exam, Diagnostic Findings)"
              multiline
              rows={3}
              fullWidth
              value={noteForm.objective}
              onChange={(e) => setNoteForm({ ...noteForm, objective: e.target.value })}
            />
            <TextField
              label="Assessment (Clinical Diagnosis & Reasoning)"
              multiline
              rows={2}
              fullWidth
              value={noteForm.assessment}
              onChange={(e) => setNoteForm({ ...noteForm, assessment: e.target.value })}
            />
            <TextField
              label="Plan (Treatment, Prescriptions, Orders, Follow-up)"
              multiline
              rows={3}
              fullWidth
              value={noteForm.plan}
              onChange={(e) => setNoteForm({ ...noteForm, plan: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNoteModalOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              createNoteMutation.mutate({
                encounterId: noteForm.encounterId || encounters?.[0]?._id,
                template: 'SOAP',
                title: noteForm.title,
                sections: {
                  subjective: noteForm.subjective,
                  objective: noteForm.objective,
                  assessment: noteForm.assessment,
                  plan: noteForm.plan,
                },
              })
            }
          >
            Save Note Draft
          </Button>
        </DialogActions>
      </Dialog>

      {/* Break Glass Modal */}
      <Dialog open={breakGlassModalOpen} onClose={() => setBreakGlassModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShieldAlert size={24} />
          Emergency Break-Glass Authorization
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This patient record is designated as confidential/restricted. To access clinical details, you must enter a valid clinical justification. This override is logged and audited in real-time.
          </Typography>
          <TextField
            label="Clinical Justification for Emergency Override"
            multiline
            rows={3}
            fullWidth
            required
            value={breakGlassReason}
            onChange={(e) => setBreakGlassReason(e.target.value)}
            placeholder="e.g. Trauma bay emergency resuscitation requiring active medications check"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBreakGlassModalOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={!breakGlassReason.trim() || breakGlassMutation.isPending}
            onClick={() => breakGlassMutation.mutate(breakGlassReason)}
          >
            Authorize & Open Chart
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Stack,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
} from '@mui/material';
import { UserPlus, AlertTriangle, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient.js';
import { useAuthStore } from '../../stores/authStore.js';

const steps = ['Demographics & Identity', 'Contacts & Guardian', 'Insurance & Flags'];

export const PatientRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeStep, setActiveStep] = useState(0);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    facilityId: user?.activeFacilityId || '65f0a1b2c3d4e5f6a7b8c901',
    givenName: '',
    familyName: '',
    prefix: '',
    dob: '',
    sex: 'MALE',
    genderIdentity: '',
    nationalId: '',
    phone: '',
    email: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelationship: '',
    guardianName: '',
    guardianPhone: '',
    guardianRelationship: 'PARENT',
    insuranceProvider: '',
    policyNumber: '',
    subscriberName: '',
    isVip: false,
    isRestricted: false,
    codeStatus: 'FULL_CODE',
  });

  const isMinor = () => {
    if (!formData.dob) return false;
    const birth = new Date(formData.dob);
    const now = new Date();
    const age = now.getFullYear() - birth.getFullYear();
    return age < 18;
  };

  const checkDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/patients/check-duplicates', {
        family: formData.familyName,
        given: [formData.givenName],
        dob: formData.dob,
        phone: formData.phone,
        facilityId: formData.facilityId,
      });
      return res.data.data;
    },
    onSuccess: (candidates) => {
      if (candidates && candidates.length > 0) {
        setDuplicates(candidates);
        setDuplicateModalOpen(true);
      } else {
        submitRegistration();
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/patients', payload);
      return res.data.data;
    },
    onSuccess: (patient) => {
      navigate(`/patients/${patient.id || patient._id}`);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || err.response?.data?.errors?.[0]?.message || 'Registration failed');
    },
  });

  const submitRegistration = () => {
    setErrorMsg(null);
    const payload = {
      facilityId: formData.facilityId,
      name: {
        given: [formData.givenName],
        family: formData.familyName,
        prefix: formData.prefix || undefined,
      },
      dob: formData.dob,
      sex: formData.sex,
      genderIdentity: formData.genderIdentity || undefined,
      identifiers: formData.nationalId
        ? [{ type: 'NATIONAL_ID', value: formData.nationalId }]
        : [],
      contact: {
        phones: [formData.phone],
        email: formData.email || undefined,
      },
      address: {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        country: 'USA',
      },
      emergencyContacts: formData.emergencyName
        ? [
            {
              name: formData.emergencyName,
              relationship: formData.emergencyRelationship,
              phone: formData.emergencyPhone,
              isNextOfKin: true,
            },
          ]
        : [],
      guardian: isMinor()
        ? {
            name: formData.guardianName,
            relationship: formData.guardianRelationship,
            phone: formData.guardianPhone,
          }
        : undefined,
      insurance: formData.insuranceProvider
        ? [
            {
              provider: formData.insuranceProvider,
              policyNumber: formData.policyNumber,
              subscriberName: formData.subscriberName || `${formData.givenName} ${formData.familyName}`,
              relationship: 'SELF',
            },
          ]
        : [],
      flags: {
        vip: formData.isVip,
        restricted: formData.isRestricted,
        deceased: false,
      },
      codeStatus: formData.codeStatus,
    };

    registerMutation.mutate(payload);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!formData.givenName || !formData.familyName || !formData.dob) {
        setErrorMsg('First name, last name, and date of birth are required');
        return;
      }
    } else if (activeStep === 1) {
      if (!formData.phone || !formData.street || !formData.city || !formData.state || !formData.postalCode) {
        setErrorMsg('Phone number and complete address are required');
        return;
      }
      if (isMinor() && (!formData.guardianName || !formData.guardianPhone)) {
        setErrorMsg('Guardian name and phone are required for minor patients under 18');
        return;
      }
    }
    setErrorMsg(null);

    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      // Step 3: Trigger duplicate candidate check before final registration
      checkDuplicatesMutation.mutate();
    }
  };

  return (
    <Box sx={{ maxWidth: 840, mx: 'auto', py: 2 }}>
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'primary.main', color: '#ffffff' }}>
            <UserPlus size={24} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Patient Intake & Registration Stepper
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enter demographic records, contact details, insurance, and clinical flags.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 4, borderRadius: 4 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {errorMsg}
          </Alert>
        )}

        {/* Step 1: Demographics */}
        {activeStep === 0 && (
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Prefix"
                sx={{ width: { xs: '100%', sm: 120 } }}
                value={formData.prefix}
                onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                placeholder="Mr./Ms./Dr."
              />
              <TextField
                label="First / Given Name"
                required
                fullWidth
                value={formData.givenName}
                onChange={(e) => setFormData({ ...formData, givenName: e.target.value })}
              />
              <TextField
                label="Last / Family Name"
                required
                fullWidth
                value={formData.familyName}
                onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Date of Birth"
                type="date"
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
              />
              <TextField
                select
                label="Administrative Sex"
                required
                fullWidth
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
              >
                <MenuItem value="MALE">Male</MenuItem>
                <MenuItem value="FEMALE">Female</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
                <MenuItem value="UNKNOWN">Unknown</MenuItem>
              </TextField>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="National ID / SSN"
                fullWidth
                value={formData.nationalId}
                onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                placeholder="987-65-4321 (Encrypted with Blind Index)"
              />
              <TextField
                label="Gender Identity"
                fullWidth
                value={formData.genderIdentity}
                onChange={(e) => setFormData({ ...formData, genderIdentity: e.target.value })}
              />
            </Stack>
          </Stack>
        )}

        {/* Step 2: Contacts & Guardian */}
        {activeStep === 1 && (
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Primary Phone Number"
                required
                fullWidth
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Stack>

            <TextField
              label="Street Address"
              required
              fullWidth
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="City"
                required
                fullWidth
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
              <TextField
                label="State / Province"
                required
                sx={{ width: { xs: '100%', sm: 140 } }}
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
              <TextField
                label="Postal Code"
                required
                sx={{ width: { xs: '100%', sm: 160 } }}
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              />
            </Stack>

            {/* Minor Guardian section */}
            {isMinor() && (
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#fff8e1', border: '1px solid #ffe082' }}>
                <Typography variant="subtitle2" fontWeight={700} color="warning.dark" gutterBottom>
                  Guardian / Next of Kin Information (Mandatory for Minor)
                </Typography>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                      label="Guardian Full Name"
                      required
                      fullWidth
                      value={formData.guardianName}
                      onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                    />
                    <TextField
                      label="Guardian Phone"
                      required
                      fullWidth
                      value={formData.guardianPhone}
                      onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                    />
                  </Stack>
                </Stack>
              </Box>
            )}
          </Stack>
        )}

        {/* Step 3: Insurance & Flags */}
        {activeStep === 2 && (
          <Stack spacing={2.5}>
            <Typography variant="subtitle2" fontWeight={700}>
              Primary Insurance / Payer
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Insurance Provider Name"
                fullWidth
                value={formData.insuranceProvider}
                onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                placeholder="e.g. BlueCross BlueShield"
              />
              <TextField
                label="Policy / Member ID"
                fullWidth
                value={formData.policyNumber}
                onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
              />
            </Stack>

            <Divider sx={{ my: 1 }} />

            <Typography variant="subtitle2" fontWeight={700}>
              Clinical Code Status & Confidentiality Flags
            </Typography>
            <TextField
              select
              label="Code Status"
              fullWidth
              value={formData.codeStatus}
              onChange={(e) => setFormData({ ...formData, codeStatus: e.target.value })}
            >
              <MenuItem value="FULL_CODE">Full Code (Resuscitation)</MenuItem>
              <MenuItem value="DNR">DNR (Do Not Resuscitate)</MenuItem>
              <MenuItem value="DNI">DNI (Do Not Intubate)</MenuItem>
              <MenuItem value="COMFORT_MEASURES">Comfort Measures Only</MenuItem>
            </TextField>

            <Stack direction="row" spacing={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isVip}
                    onChange={(e) => setFormData({ ...formData, isVip: e.target.checked })}
                    color="secondary"
                  />
                }
                label="Flag as VIP Patient"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isRestricted}
                    onChange={(e) => setFormData({ ...formData, isRestricted: e.target.checked })}
                    color="warning"
                  />
                }
                label="Restricted / Confidential Record (Requires Break-Glass)"
              />
            </Stack>
          </Stack>
        )}

        {/* Navigation Buttons */}
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 4 }}>
          <Button
            disabled={activeStep === 0}
            onClick={() => setActiveStep((prev) => prev - 1)}
            startIcon={<ArrowLeft size={18} />}
          >
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={registerMutation.isPending || checkDuplicatesMutation.isPending}
            endIcon={
              registerMutation.isPending || checkDuplicatesMutation.isPending ? (
                <CircularProgress size={18} />
              ) : activeStep === steps.length - 1 ? (
                <Check size={18} />
              ) : (
                <ArrowRight size={18} />
              )
            }
          >
            {activeStep === steps.length - 1 ? 'Complete Intake & Create MRN' : 'Next Step'}
          </Button>
        </Stack>
      </Paper>

      {/* Duplicate Patient Alert Dialog */}
      <Dialog open={duplicateModalOpen} onClose={() => setDuplicateModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle size={24} />
          Potential Duplicate Patient Detected
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            The intake engine identified existing patient records with similar demographics. Please confirm whether you want to proceed creating a new record or open the existing chart.
          </Typography>
          <List>
            {duplicates.map((dup) => (
              <ListItem
                key={dup._id}
                sx={{ bgcolor: 'action.hover', borderRadius: 2, mb: 1, border: '1px solid', borderColor: 'divider' }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2" fontWeight={700}>
                        {dup.name?.given?.join(' ')} {dup.name?.family}
                      </Typography>
                      <Chip label={`MRN: ${dup.mrn}`} size="small" color="primary" />
                      <Chip label={`${dup.matchScore}% Match`} size="small" color="warning" />
                    </Stack>
                  }
                  secondary={`DOB: ${dup.dob} | Sex: ${dup.sex}`}
                />
                <Button size="small" variant="outlined" onClick={() => navigate(`/patients/${dup._id}`)}>
                  View Chart
                </Button>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDuplicateModalOpen(false)} color="inherit">
            Cancel Intake
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              setDuplicateModalOpen(false);
              submitRegistration();
            }}
          >
            Confirm & Proceed Creating New MRN
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

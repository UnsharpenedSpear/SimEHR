import React from 'react';
import { Box, Paper, Typography, Chip, Stack, Tooltip, Divider, Button } from '@mui/material';
import { ShieldAlert, AlertTriangle, User, Calendar, Activity, Lock } from 'lucide-react';

export interface PatientBannerProps {
  patient: {
    id: string;
    mrn: string;
    name: {
      given: string[];
      family: string;
      prefix?: string;
      suffix?: string;
    };
    dob: string;
    sex: string;
    allergies?: Array<{ substance: string; severity: string }>;
    codeStatus?: string;
    isolationFlags?: string[];
    flags?: {
      vip?: boolean;
      restricted?: boolean;
      deceased?: boolean;
    };
    lastVitals?: {
      bp?: { systolic: number; diastolic: number };
      hr?: number;
      spo2?: number;
      tempC?: number;
    };
  };
  onBreakGlass?: () => void;
  isRestrictedView?: boolean;
}

export const PatientBanner: React.FC<PatientBannerProps> = ({ patient, onBreakGlass, isRestrictedView }) => {
  const calculateAge = (dob: string) => {
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const fullName = `${patient.name.prefix ? patient.name.prefix + ' ' : ''}${patient.name.given.join(' ')} ${patient.name.family}${patient.name.suffix ? ', ' + patient.name.suffix : ''}`;
  const age = calculateAge(patient.dob);

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2.5,
        borderRadius: 3,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: patient.flags?.vip || patient.flags?.restricted ? 'warning.main' : 'divider',
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
        {/* Patient Identity */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.25rem',
            }}
          >
            {patient.name.family[0]}
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6" fontWeight={700}>
                {fullName}
              </Typography>
              {patient.flags?.vip && (
                <Chip label="VIP" size="small" color="secondary" sx={{ fontWeight: 700, height: 20 }} />
              )}
              {patient.flags?.restricted && (
                <Chip
                  icon={<Lock size={12} />}
                  label="RESTRICTED"
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 700, height: 20 }}
                />
              )}
              {patient.flags?.deceased && (
                <Chip label="DECEASED" size="small" color="error" sx={{ fontWeight: 700, height: 20 }} />
              )}
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>MRN:</strong> {patient.mrn}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>DOB:</strong> {patient.dob} ({age} yo)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Sex:</strong> {patient.sex}
              </Typography>
              <Chip
                label={patient.codeStatus || 'FULL CODE'}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
              />
            </Stack>
          </Box>
        </Stack>

        {/* Clinical Alerts & Allergies */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          {/* Allergies Highlight */}
          <Box sx={{ minWidth: 140 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
              ALLERGIES:
            </Typography>
            {patient.allergies && patient.allergies.length > 0 ? (
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {patient.allergies.map((allergy, idx) => (
                  <Chip
                    key={idx}
                    label={`${allergy.substance} (${allergy.severity})`}
                    size="small"
                    sx={{
                      bgcolor: '#fce4ec',
                      color: '#c2185b',
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      height: 22,
                    }}
                  />
                ))}
              </Stack>
            ) : (
              <Chip
                label="No Known Allergies (NKDA)"
                size="small"
                sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', height: 22, fontSize: '0.7rem', fontWeight: 600 }}
              />
            )}
          </Box>

          {/* Isolation Flags */}
          {patient.isolationFlags && patient.isolationFlags.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                ISOLATION:
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {patient.isolationFlags.map((iso, idx) => (
                  <Chip
                    key={idx}
                    label={iso}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Break Glass Action if restricted */}
          {isRestrictedView && onBreakGlass && (
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<ShieldAlert size={16} />}
              onClick={onBreakGlass}
              sx={{ borderRadius: 2 }}
            >
              Break-Glass Access
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};

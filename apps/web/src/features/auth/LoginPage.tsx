import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import { ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { apiClient } from '../../services/apiClient.js';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('dr.chen@ehrtest.local');
  const [password, setPassword] = useState('Password@123!');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { isMfaRequired, tempToken, setAuth, setMfaChallenge } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isMfaRequired && tempToken) {
        const res = await apiClient.post('/auth/mfa/validate', {
          tempToken,
          code: mfaCode,
        });
        setAuth(res.data.data.user, res.data.data.accessToken);
        navigate('/');
      } else {
        const res = await apiClient.post('/auth/login', { email, password });
        if (res.data.data.mfaRequired) {
          setMfaChallenge(res.data.data.tempToken);
        } else {
          setAuth(res.data.data.user, res.data.data.accessToken);
          navigate('/');
        }
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(detail || 'Authentication failed. Please verify your staff credentials.');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: 'Physician', email: 'dr.chen@ehrtest.local', name: 'Dr. Marcus Chen' },
    { role: 'Nurse', email: 'nurse.williams@ehrtest.local', name: 'Sandra Williams, RN' },
    { role: 'Receptionist', email: 'receptionist@ehrtest.local', name: 'Carlos Reyes' },
    { role: 'Lab Tech', email: 'labtech@ehrtest.local', name: 'Kevin Okonkwo' },
    { role: 'Radiologist', email: 'radiologist@ehrtest.local', name: 'Dr. Helena Kowalski' },
    { role: 'Pharmacist', email: 'pharmacist@ehrtest.local', name: 'Omar Farouq, PharmD' },
    { role: 'Billing', email: 'billing@ehrtest.local', name: 'Rachel Nguyen' },
    { role: 'Auditor', email: 'auditor@ehrtest.local', name: 'George Thornton' },
    { role: 'Super Admin', email: 'admin@ehrtest.local', name: 'Alice Administrator' },
  ];

  const selectDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password@123!');
    setError(null);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%', p: 2, borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <CardContent>
          <Stack spacing={3} alignItems="center">
            {/* Header Brand */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2.5,
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'primary.contrastText',
                  fontWeight: 900,
                  fontSize: '1.5rem',
                }}
              >
                +
              </Box>
              <Typography variant="h5" fontWeight={800}>
                Simulated<span style={{ color: '#0284c7' }}>EHR</span>
              </Typography>
            </Stack>

            <Box textAlign="center">
              <Typography variant="h6" fontWeight={700}>
                {isMfaRequired ? 'Two-Factor Authentication' : 'Clinical Portal Sign In'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isMfaRequired
                  ? 'Enter the 6-digit TOTP code from your authenticator application'
                  : 'Authorized healthcare personnel only • All actions are audit-logged'}
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" icon={<ShieldAlert size={20} />} sx={{ width: '100%', borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleLogin} sx={{ width: '100%' }}>
              <Stack spacing={2.5}>
                {!isMfaRequired ? (
                  <>
                    <TextField
                      label="Staff Email Address"
                      type="email"
                      fullWidth
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                      label="Password"
                      type="password"
                      fullWidth
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      helperText="Default password: Password@123!"
                    />
                  </>
                ) : (
                  <TextField
                    label="6-Digit Authenticator Code"
                    fullWidth
                    required
                    autoFocus
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="123456"
                    inputProps={{ maxLength: 6, style: { fontSize: '1.5rem', textAlign: 'center', letterSpacing: 6 } }}
                  />
                )}

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={loading}
                  endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <ArrowRight size={18} />}
                  sx={{ py: 1.25, borderRadius: 3 }}
                >
                  {isMfaRequired ? 'Verify & Sign In' : 'Sign In to Workspace'}
                </Button>
              </Stack>
            </Box>

            {/* Quick-switch Demo Credentials */}
            {!isMfaRequired && (
              <Box sx={{ width: '100%', pt: 1 }}>
                <Divider sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    CLICK TO AUTO-FILL DEMO ACCOUNT
                  </Typography>
                </Divider>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="center">
                  {demoAccounts.map((acc) => {
                    const isSelected = email === acc.email;
                    return (
                      <Chip
                        key={acc.role}
                        label={acc.role}
                        size="small"
                        clickable
                        variant={isSelected ? 'filled' : 'outlined'}
                        color={isSelected ? 'primary' : 'default'}
                        icon={isSelected ? <CheckCircle2 size={14} /> : undefined}
                        onClick={() => selectDemoAccount(acc.email)}
                        sx={{ mb: 0.75, fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

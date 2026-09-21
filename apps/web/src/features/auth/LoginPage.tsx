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
import { Shield, KeyRound, ArrowRight, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { apiClient } from '../../services/apiClient.js';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('physician@ehr.hospital.org');
  const [password, setPassword] = useState('Password123!@#');
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
        setAuth(res.data.data.user);
        navigate('/');
      } else {
        const res = await apiClient.post('/auth/login', { email, password });
        if (res.data.data.mfaRequired) {
          setMfaChallenge(res.data.data.tempToken);
        } else {
          setAuth(res.data.data.user);
          navigate('/');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Check credentials or lockout state.');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: 'Physician', email: 'physician@ehr.hospital.org' },
    { role: 'Nurse', email: 'nurse@ehr.hospital.org' },
    { role: 'Receptionist', email: 'receptionist@ehr.hospital.org' },
    { role: 'Lab Tech', email: 'labtech@ehr.hospital.org' },
    { role: 'Pharmacist', email: 'pharmacist@ehr.hospital.org' },
    { role: 'Super Admin', email: 'admin@ehr.hospital.org' },
  ];

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
      <Card sx={{ maxWidth: 460, width: '100%', p: 2, borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
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
                Simulated<span style={{ color: '#006874' }}>EHR</span>
              </Typography>
            </Stack>

            <Box textAlign="center">
              <Typography variant="h6" fontWeight={700}>
                {isMfaRequired ? 'Two-Factor Authentication' : 'Clinical Portal Sign In'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isMfaRequired
                  ? 'Enter the 6-digit TOTP code from your authenticator application'
                  : 'Authorized personnel only • All access is audited and logged'}
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ width: '100%', borderRadius: 2 }}>
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
                <Divider sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    DEMO ROLE PRESETS
                  </Typography>
                </Divider>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="center">
                  {demoAccounts.map((acc) => (
                    <Chip
                      key={acc.role}
                      label={acc.role}
                      size="small"
                      clickable
                      onClick={() => setEmail(acc.email)}
                      sx={{ mb: 0.75, fontWeight: 600, fontSize: '0.75rem' }}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

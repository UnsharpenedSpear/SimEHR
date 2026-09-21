import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Stack, LinearProgress } from '@mui/material';
import { Clock, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore.js';
import { apiClient } from '../../services/apiClient.js';

export const SessionTimeoutModal: React.FC = () => {
  const { sessionTimeoutWarning, setSessionTimeoutWarning, logout } = useAuthStore();
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  useEffect(() => {
    let interval: any;
    if (sessionTimeoutWarning) {
      setSecondsRemaining(60);
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            logout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionTimeoutWarning, logout]);

  const handleExtendSession = async () => {
    try {
      await apiClient.post('/auth/refresh');
      setSessionTimeoutWarning(false);
    } catch {
      logout();
    }
  };

  return (
    <Dialog open={sessionTimeoutWarning} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
        <AlertTriangle size={24} />
        Session Timeout Warning
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 2 }}>
          You have been idle for a while. For HIPAA compliance and patient data security, your session will expire in:
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ my: 2 }}>
          <Clock size={28} />
          <Typography variant="h4" fontWeight={700} color="error.main">
            {secondsRemaining}s
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={(secondsRemaining / 60) * 100} color="warning" />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={logout} color="inherit">
          Sign Out Now
        </Button>
        <Button onClick={handleExtendSession} variant="contained" color="primary">
          Keep Me Logged In
        </Button>
      </DialogActions>
    </Dialog>
  );
};

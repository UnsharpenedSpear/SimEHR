import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Divider,
  CircularProgress,
  Stack,
  Chip,
} from '@mui/material';
import { Search, User, FileText, Calendar, Activity, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient.js';
import { useUIStore } from '../../stores/uiStore.js';

export const GlobalSearchDialog: React.FC = () => {
  const { globalSearchOpen, setGlobalSearchOpen } = useUIStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Keyboard shortcut listener (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(!globalSearchOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [globalSearchOpen, setGlobalSearchOpen]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/patients/search?query=${encodeURIComponent(searchTerm)}&limit=8`);
        setResults(res.data.data || []);
      } catch (err) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelectPatient = (patientId: string) => {
    setGlobalSearchOpen(false);
    navigate(`/patients/${patientId}`);
  };

  return (
    <Dialog
      open={globalSearchOpen}
      onClose={() => setGlobalSearchOpen(false)}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 1,
          bgcolor: 'background.paper',
        },
      }}
    >
      <DialogContent sx={{ p: 1.5 }}>
        <TextField
          autoFocus
          fullWidth
          placeholder="Search patient by Name, MRN, DOB, Phone, or National ID... (⌘K)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={20} />
              </InputAdornment>
            ),
            endAdornment: loading ? (
              <InputAdornment position="end">
                <CircularProgress size={18} />
              </InputAdornment>
            ) : null,
          }}
          sx={{ mb: 1.5 }}
        />

        {results.length > 0 ? (
          <List sx={{ maxHeight: 360, overflowY: 'auto' }}>
            {results.map((patient) => (
              <ListItemButton
                key={patient._id || patient.id}
                onClick={() => handleSelectPatient(patient._id || patient.id)}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <User size={20} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1" fontWeight={600}>
                        {patient.name.given?.join(' ')} {patient.name.family}
                      </Typography>
                      <Chip label={`MRN: ${patient.mrn}`} size="small" variant="outlined" sx={{ height: 20 }} />
                    </Stack>
                  }
                  secondary={`DOB: ${patient.dob} | Sex: ${patient.sex} | Phone: ${patient.contact?.phones?.[0] || 'N/A'}`}
                />
              </ListItemButton>
            ))}
          </List>
        ) : searchTerm.trim() && !loading ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <AlertCircle size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <Typography variant="body2">No matching patients found for "{searchTerm}"</Typography>
          </Box>
        ) : (
          <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="caption">Type to search patients across all facilities with indexed lookup</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

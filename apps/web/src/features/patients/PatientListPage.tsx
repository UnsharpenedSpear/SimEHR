import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Stack,
  Chip,
  IconButton,
  Drawer,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Search, Filter, UserPlus, Eye, Bookmark, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient.js';
import { useAuthStore } from '../../stores/authStore.js';
import { PERMISSIONS } from '@ehr/shared';

export const PatientListPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    dob: '',
    gender: '',
    mrn: '',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['patients-search', searchQuery, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (filters.dob) params.append('dob', filters.dob);
      if (filters.gender) params.append('gender', filters.gender);
      if (filters.mrn) params.append('mrn', filters.mrn);
      params.append('limit', '50');

      const res = await apiClient.get(`/patients/search?${params.toString()}`);
      return res.data;
    },
  });

  const { data: savedSearches } = useQuery({
    queryKey: ['saved-searches'],
    queryFn: async () => {
      const res = await apiClient.get('/saved-searches');
      return res.data.data;
    },
  });

  const columns: GridColDef[] = [
    { field: 'mrn', headerName: 'MRN', width: 140, renderCell: (params) => <strong>{params.value}</strong> },
    {
      field: 'name',
      headerName: 'Patient Name',
      flex: 1.5,
      valueGetter: (params, row) => `${row.name?.given?.join(' ')} ${row.name?.family}`,
    },
    { field: 'dob', headerName: 'DOB', width: 120 },
    { field: 'sex', headerName: 'Sex', width: 100 },
    {
      field: 'phone',
      headerName: 'Primary Contact',
      flex: 1.2,
      valueGetter: (params, row) => row.contact?.phones?.[0]?.value || 'N/A',
    },
    {
      field: 'flags',
      headerName: 'Alerts & Flags',
      width: 160,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: '100%' }}>
          {params.row.flags?.vip && <Chip label="VIP" size="small" color="secondary" sx={{ height: 20 }} />}
          {params.row.flags?.restricted && <Chip label="RESTRICTED" size="small" color="warning" sx={{ height: 20 }} />}
          {params.row.codeStatus && params.row.codeStatus !== 'FULL_CODE' && (
            <Chip label={params.row.codeStatus} size="small" color="error" variant="outlined" sx={{ height: 20 }} />
          )}
        </Stack>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Button
          variant="contained"
          size="small"
          startIcon={<Eye size={14} />}
          onClick={() => navigate(`/patients/${params.row.id || params.row._id}`)}
          sx={{ borderRadius: 2 }}
        >
          Chart
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Patient Directory & Lookup
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Search by name, MRN, phone, or diacritic-insensitive lookup across facility records.
            </Typography>
          </Box>
          {hasPermission(PERMISSIONS.PATIENT_CREATE) && (
            <Button
              variant="contained"
              startIcon={<UserPlus size={18} />}
              onClick={() => navigate('/patients/new')}
              sx={{ borderRadius: 2 }}
            >
              Register New Patient
            </Button>
          )}
        </Stack>

        {/* Search Bar & Filter Controls */}
        <Stack direction="row" spacing={1.5} sx={{ mt: 3 }} alignItems="center">
          <TextField
            fullWidth
            placeholder="Type patient name, MRN (FAC-...), or phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <X size={16} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="outlined"
            startIcon={<Filter size={18} />}
            onClick={() => setFilterDrawerOpen(true)}
            sx={{ borderRadius: 3, px: 2.5, whiteSpace: 'nowrap' }}
          >
            Filters
          </Button>
        </Stack>

        {/* Saved Searches Chips */}
        {savedSearches && savedSearches.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center" flexWrap="wrap">
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              <Bookmark size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              SAVED FILTERS:
            </Typography>
            {savedSearches.map((s: any) => (
              <Chip
                key={s._id}
                label={s.name}
                size="small"
                clickable
                onClick={() => {
                  if (s.filters?.query) setSearchQuery(s.filters.query);
                  if (s.filters?.dob) setFilters((f) => ({ ...f, dob: s.filters.dob }));
                }}
              />
            ))}
          </Stack>
        )}
      </Paper>

      {/* Patient Data Grid */}
      <Paper sx={{ height: 560, width: '100%', borderRadius: 3, overflow: 'hidden' }}>
        <DataGrid
          rows={data?.data || []}
          columns={columns}
          getRowId={(row) => row.id || row._id}
          loading={isLoading}
          pageSizeOptions={[15, 30, 50]}
          disableRowSelectionOnClick
          onRowClick={(params) => navigate(`/patients/${params.row.id || params.row._id}`)}
          sx={{ border: 'none', cursor: 'pointer' }}
        />
      </Paper>

      {/* Filter Drawer */}
      <Drawer anchor="right" open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)}>
        <Box sx={{ width: 320, p: 3 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Advanced Patient Filters
          </Typography>
          <Stack spacing={2.5} sx={{ mt: 2 }}>
            <TextField
              label="MRN Filter"
              fullWidth
              value={filters.mrn}
              onChange={(e) => setFilters({ ...filters, mrn: e.target.value })}
              placeholder="e.g. FAC-100001"
            />
            <TextField
              label="Date of Birth"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={filters.dob}
              onChange={(e) => setFilters({ ...filters, dob: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Sex / Gender</InputLabel>
              <Select
                value={filters.gender}
                label="Sex / Gender"
                onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
              >
                <MenuItem value="">All Genders</MenuItem>
                <MenuItem value="MALE">Male</MenuItem>
                <MenuItem value="FEMALE">Female</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              fullWidth
              onClick={() => {
                setFilterDrawerOpen(false);
                refetch();
              }}
            >
              Apply Filters
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                setFilters({ dob: '', gender: '', mrn: '' });
                setFilterDrawerOpen(false);
              }}
            >
              Reset Filters
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
};

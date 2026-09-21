import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { UserPlus, Shield, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient.js';
import { SYSTEM_ROLES } from '@ehr/shared';

export const UsersManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    givenName: '',
    familyName: '',
    roleId: '',
    facilityId: '65f0a1b2c3d4e5f6a7b8c901',
    specialty: '',
    licenseNo: '',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/users');
      return res.data.data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/roles');
      return res.data.data;
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/admin/users', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setCreateDialogOpen(false);
      setFormData({
        email: '',
        password: '',
        givenName: '',
        familyName: '',
        roleId: '',
        facilityId: '65f0a1b2c3d4e5f6a7b8c901',
        specialty: '',
        licenseNo: '',
      });
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to create user');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    createUserMutation.mutate({
      email: formData.email,
      password: formData.password,
      name: {
        given: [formData.givenName],
        family: formData.familyName,
      },
      roleIds: [formData.roleId],
      facilityIds: [formData.facilityId],
      professional: formData.specialty
        ? { specialty: formData.specialty, licenseNo: formData.licenseNo }
        : undefined,
    });
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Full Name',
      flex: 1.2,
      valueGetter: (params, row) => `${row.name?.given?.join(' ')} ${row.name?.family}`,
    },
    { field: 'email', headerName: 'Email Address', flex: 1.5 },
    {
      field: 'roles',
      headerName: 'Assigned Roles',
      flex: 1.2,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: '100%' }}>
          {params.row.roleIds?.map((r: any) => (
            <Chip key={r._id || r.name} label={r.name || 'Role'} size="small" color="primary" variant="outlined" />
          ))}
        </Stack>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'ACTIVE' ? 'success' : 'error'}
          sx={{ fontWeight: 600 }}
        />
      ),
    },
    {
      field: 'mfa',
      headerName: 'MFA Enabled',
      width: 130,
      valueGetter: (params, row) => (row.mfa?.enabled ? 'Enrolled' : 'Not Set'),
    },
    {
      field: 'createdAt',
      headerName: 'Registered',
      width: 140,
      valueFormatter: (params) => new Date(params).toLocaleDateString(),
    },
  ];

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" fontWeight={700}>
              User & Identity Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Provision clinician and administrative accounts with role-based permissions and multi-factor authentication.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<UserPlus size={18} />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Provision User
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ height: 500, width: '100%', borderRadius: 3, overflow: 'hidden' }}>
        <DataGrid
          rows={users || []}
          columns={columns}
          getRowId={(row) => row._id}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          sx={{ border: 'none' }}
        />
      </Paper>

      {/* Provision User Modal */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Provision New Clinical / Staff User</DialogTitle>
        <Box component="form" onSubmit={handleCreateSubmit}>
          <DialogContent>
            {errorMsg && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorMsg}
              </Alert>
            )}
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Given / First Name"
                  required
                  fullWidth
                  value={formData.givenName}
                  onChange={(e) => setFormData({ ...formData, givenName: e.target.value })}
                />
                <TextField
                  label="Family / Last Name"
                  required
                  fullWidth
                  value={formData.familyName}
                  onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
                />
              </Stack>

              <TextField
                label="Staff Email Address"
                type="email"
                required
                fullWidth
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <TextField
                label="Temporary Password"
                type="password"
                required
                fullWidth
                helperText="Must be min 12 characters with uppercase, lowercase, numbers, and symbols"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />

              <TextField
                select
                label="Assigned System Role"
                required
                fullWidth
                value={formData.roleId}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              >
                {roles?.map((r: any) => (
                  <MenuItem key={r._id} value={r._id}>
                    {r.name} {r.isSystem ? '(System)' : ''}
                  </MenuItem>
                ))}
              </TextField>

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Specialty (e.g. Cardiology)"
                  fullWidth
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                />
                <TextField
                  label="Medical License No."
                  fullWidth
                  value={formData.licenseNo}
                  onChange={(e) => setFormData({ ...formData, licenseNo: e.target.value })}
                />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setCreateDialogOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? <CircularProgress size={20} /> : 'Create Account'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

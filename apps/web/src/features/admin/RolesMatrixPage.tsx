import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import { Check, X, Shield, ShieldAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient.js';
import { PERMISSIONS } from '@ehr/shared';

export const RolesMatrixPage: React.FC = () => {
  const { data: roles, isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/roles');
      return res.data.data;
    },
  });

  const allPermissions = Object.values(PERMISSIONS);

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Shield size={28} color="#006874" />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Role-Based Access Control (RBAC) Permission Matrix
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Immutable system roles and fine-grained resource:action entitlements evaluated across all endpoints.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ borderRadius: 3, maxHeight: 600 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper', minWidth: 220 }}>
                Resource : Action Permission
              </TableCell>
              {roles?.map((role: any) => (
                <TableCell key={role._id} align="center" sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {role.name}
                  </Typography>
                  {role.isSystem && (
                    <Chip label="System" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {allPermissions.map((perm) => (
              <TableRow key={perm} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{perm}</TableCell>
                {roles?.map((role: any) => {
                  const hasPerm = role.permissions.includes(perm) || role.name === 'SUPER_ADMIN';
                  return (
                    <TableCell key={role._id} align="center">
                      {hasPerm ? (
                        <Check size={18} color="#2e7d32" style={{ strokeWidth: 3 }} />
                      ) : (
                        <X size={16} color="#d32f2f" style={{ opacity: 0.4 }} />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  FormControlLabel,
  Switch,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { ShieldCheck, ShieldAlert, CheckCircle, RefreshCw, Key } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient.js';

export const AuditLogViewerPage: React.FC = () => {
  const [breakGlassOnly, setBreakGlassOnly] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', breakGlassOnly],
    queryFn: async () => {
      const res = await apiClient.get(`/audit?breakGlassOnly=${breakGlassOnly}&limit=100`);
      return res.data.data;
    },
  });

  const verifyChainMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.get('/audit/verify');
      return res.data.data;
    },
  });

  const columns: GridColDef[] = [
    { field: 'seq', headerName: 'Seq #', width: 90 },
    {
      field: 'at',
      headerName: 'Timestamp (UTC)',
      width: 190,
      valueFormatter: (params) => new Date(params).toLocaleString(),
    },
    { field: 'action', headerName: 'Action Executed', flex: 1.2 },
    { field: 'resourceType', headerName: 'Resource', width: 130 },
    {
      field: 'outcome',
      headerName: 'Outcome',
      width: 110,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'SUCCESS' ? 'success' : params.value === 'DENIED' ? 'error' : 'warning'}
          sx={{ fontWeight: 700 }}
        />
      ),
    },
    {
      field: 'breakGlass',
      headerName: 'Break-Glass Reason',
      flex: 1.5,
      renderCell: (params) =>
        params.row.breakGlass?.reason ? (
          <Chip
            icon={<ShieldAlert size={14} />}
            label={params.row.breakGlass.reason}
            color="error"
            size="small"
            sx={{ fontWeight: 600 }}
          />
        ) : (
          <Typography variant="caption" color="text.secondary">
            Standard Access
          </Typography>
        ),
    },
    {
      field: 'hash',
      headerName: 'SHA-256 Hash Signature',
      width: 150,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
          {params.value?.slice(0, 12)}...
        </Typography>
      ),
    },
  ];

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Tamper-Evident Audit & Compliance Trail
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Immutable append-only ledger protected with cryptographically verifiable SHA-256 hash chaining.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={breakGlassOnly}
                  onChange={(e) => setBreakGlassOnly(e.target.checked)}
                  color="error"
                />
              }
              label="Break-Glass Only"
            />
            <Button
              variant="outlined"
              color="primary"
              startIcon={<ShieldCheck size={18} />}
              onClick={() => verifyChainMutation.mutate()}
              disabled={verifyChainMutation.isPending}
              sx={{ borderRadius: 2 }}
            >
              Verify Hash Chain
            </Button>
          </Stack>
        </Stack>

        {verifyChainMutation.data && (
          <Alert
            severity={verifyChainMutation.data.isValid ? 'success' : 'error'}
            icon={verifyChainMutation.data.isValid ? <CheckCircle size={20} /> : <ShieldAlert size={20} />}
            sx={{ mt: 2, borderRadius: 2 }}
          >
            {verifyChainMutation.data.isValid
              ? `Mathematical chain verification succeeded! All ${verifyChainMutation.data.totalRecords} records verified without sequence gaps or signature tampering.`
              : `Integrity Alert: Chain compromised at Sequence #${verifyChainMutation.data.corruptedSeq}. Details: ${verifyChainMutation.data.details}`}
          </Alert>
        )}
      </Paper>

      <Paper sx={{ height: 540, width: '100%', borderRadius: 3, overflow: 'hidden' }}>
        <DataGrid
          rows={logs || []}
          columns={columns}
          getRowId={(row) => row._id || row.seq}
          loading={isLoading}
          pageSizeOptions={[15, 30, 50, 100]}
          onRowClick={(params) => setSelectedLog(params.row)}
          sx={{ border: 'none', cursor: 'pointer' }}
        />
      </Paper>

      {/* Detail Dialog */}
      <Dialog open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Audit Record Details (Seq #{selectedLog?.seq})</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography variant="body2">
              <strong>Timestamp:</strong> {selectedLog && new Date(selectedLog.at).toISOString()}
            </Typography>
            <Typography variant="body2">
              <strong>Action:</strong> {selectedLog?.action}
            </Typography>
            <Typography variant="body2">
              <strong>Actor ID:</strong> {selectedLog?.actorId}
            </Typography>
            <Typography variant="body2">
              <strong>Resource:</strong> {selectedLog?.resourceType} ({selectedLog?.resourceId || 'N/A'})
            </Typography>
            <Typography variant="body2">
              <strong>IP / Agent:</strong> {selectedLog?.ip || '127.0.0.1'} ({selectedLog?.userAgent || 'Browser'})
            </Typography>
            <Typography variant="body2">
              <strong>Prev Hash:</strong> <code style={{ wordBreak: 'break-all' }}>{selectedLog?.prevHash}</code>
            </Typography>
            <Typography variant="body2">
              <strong>Hash:</strong> <code style={{ wordBreak: 'break-all' }}>{selectedLog?.hash}</code>
            </Typography>
            {selectedLog?.diff && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" fontWeight={700}>
                  STATE DIFF SNAPSHOT:
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: 'action.hover' }}>
                  <pre style={{ margin: 0, fontSize: '0.75rem' }}>{JSON.stringify(selectedLog.diff, null, 2)}</pre>
                </Paper>
              </Box>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

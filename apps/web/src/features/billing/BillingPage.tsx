import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tooltip,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  CreditCard,
  DollarSign,
  Receipt,
  Plus,
  RefreshCw,
  CheckCircle,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../services/apiClient.js';

interface InvoiceItem {
  _id: string;
  invoiceNumber: string;
  patientId?: { _id: string; mrn: string; name: { given: string[]; family: string } };
  encounterId?: { type: string; status: string };
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  lineItems: Array<{ code: string; description: string; quantity: number; unitPrice: number; totalPrice: number }>;
  payments: Array<{ amount: number; method: string; referenceNumber?: string; recordedAt: string }>;
  payer: { type: string; insuranceId?: string; policyNumber?: string };
  createdAt: string;
}

export const BillingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CREDIT_CARD');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Queries
  const { data: invoices = [], isLoading, refetch } = useQuery<InvoiceItem[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await apiClient.get('/billing/invoices');
      return res.data.data;
    },
  });

  const { data: financialReport } = useQuery({
    queryKey: ['financial-report'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/financial');
      return res.data.data;
    },
  });

  // Mutations
  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, amount, method, referenceNumber, notes }: any) => {
      const res = await apiClient.post(`/billing/invoices/${id}/payments`, {
        amount: parseFloat(amount),
        method,
        referenceNumber,
        notes,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['financial-report'] });
      setPaymentDialogOpen(false);
      setPaymentAmount('');
      setSelectedInvoice(null);
    },
  });

  const handleOpenPayment = (inv: InvoiceItem) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.balanceDue.toString());
    setPaymentRef(`TX-${Date.now().toString().slice(-6)}`);
    setPaymentDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'success';
      case 'PARTIALLY_PAID':
        return 'warning';
      case 'VOID':
        return 'error';
      default:
        return 'info';
    }
  };

  const totalBilled = financialReport?.summary?.totalBilled || 0;
  const totalCollected = financialReport?.summary?.totalCollected || 0;
  const totalOutstanding = financialReport?.summary?.totalOutstanding || 0;

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Receipt size={32} color="#005B94" />
            Billing, Invoicing & Revenue Cycle
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Charge capture, automatic invoice calculation, payment processing, and patient accounts ledger
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<RefreshCw size={18} />} onClick={() => refetch()}>
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Financial KPIs */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.main' }}>
                <Receipt size={28} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  ${totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Billed Revenue
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'success.light', color: 'success.main' }}>
                <CheckCircle2 size={28} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                  ${totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Collected
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: 'background.paper', borderRadius: 3, boxShadow: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'warning.light', color: 'warning.main' }}>
                <DollarSign size={28} />
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                  ${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Outstanding Balance Due
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Invoices Data Table */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: 2 }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'background.default' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Invoice #</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Payer</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Total Amount</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Paid</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Balance Due</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No invoices recorded.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv._id} hover>
                    <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: '500' }}>
                        {inv.patientId?.name?.family}, {inv.patientId?.name?.given?.join(' ')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        MRN: {inv.patientId?.mrn}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={inv.payer?.type} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      ${inv.totalAmount?.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ color: 'success.main', fontWeight: 'bold' }}>
                      ${inv.amountPaid?.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ color: inv.balanceDue > 0 ? 'error.main' : 'inherit', fontWeight: 'bold' }}>
                      ${inv.balanceDue?.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={inv.status.replace('_', ' ')}
                        color={getStatusColor(inv.status) as any}
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {inv.balanceDue > 0 ? (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<CreditCard size={14} />}
                          onClick={() => handleOpenPayment(inv)}
                        >
                          Collect Payment
                        </Button>
                      ) : (
                        <Chip size="small" icon={<CheckCircle size={14} />} label="Settled" color="success" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Payment Modal */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Process Payment for Invoice {selectedInvoice?.invoiceNumber}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
              <Typography variant="body2">
                <strong>Patient:</strong> {selectedInvoice?.patientId?.name?.family},{' '}
                {selectedInvoice?.patientId?.name?.given?.join(' ')}
              </Typography>
              <Typography variant="body2">
                <strong>Total Amount:</strong> ${selectedInvoice?.totalAmount.toFixed(2)} |{' '}
                <strong>Current Balance Due:</strong> ${selectedInvoice?.balanceDue.toFixed(2)}
              </Typography>
            </Paper>

            <TextField
              label="Payment Amount ($)"
              type="number"
              size="small"
              fullWidth
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
            />

            <FormControl fullWidth size="small">
              <InputLabel>Payment Method</InputLabel>
              <Select value={paymentMethod} label="Payment Method" onChange={(e) => setPaymentMethod(e.target.value)}>
                <MenuItem value="CREDIT_CARD">Credit Card</MenuItem>
                <MenuItem value="DEBIT_CARD">Debit Card</MenuItem>
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="INSURANCE_CLAIM">Insurance Claim Reimbursement</MenuItem>
                <MenuItem value="ELECTRONIC_TRANSFER">Wire / Electronic Transfer</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Transaction / Authorization Reference"
              size="small"
              fullWidth
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />

            <TextField
              label="Receipt Notes"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={() =>
              recordPaymentMutation.mutate({
                id: selectedInvoice?._id,
                amount: paymentAmount,
                method: paymentMethod,
                referenceNumber: paymentRef,
                notes: paymentNotes,
              })
            }
            disabled={recordPaymentMutation.isPending || !paymentAmount || parseFloat(paymentAmount) <= 0}
          >
            {recordPaymentMutation.isPending ? <CircularProgress size={20} /> : 'Process & Generate Receipt'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

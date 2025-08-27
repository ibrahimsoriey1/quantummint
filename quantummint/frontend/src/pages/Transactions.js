import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Tooltip,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Divider,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Info as InfoIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { fetchTransactionHistory } from '../store/slices/transactionSlice';
import { fetchWallets } from '../store/slices/walletSlice';
import PageTitle from '../components/common/PageTitle';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Format currency with symbol
const formatCurrency = (amount, currency = 'USD') => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  });
  return formatter.format(amount);
};

// Format date
const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

// Format time
const formatTime = (dateString) => {
  const options = { hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleTimeString('en-US', options);
};

const Transactions = () => {
  const [filters, setFilters] = useState({
    walletId: '',
    transactionType: '',
    status: '',
    startDate: null,
    endDate: null,
    page: 0,
    limit: 10
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const dispatch = useDispatch();
  const { transactions, pagination, loading, error } = useSelector((state) => state.transaction);
  const { wallets, loading: walletsLoading } = useSelector((state) => state.wallet);

  // Fetch transactions and wallets on component mount
  useEffect(() => {
    dispatch(fetchWallets());
    dispatch(fetchTransactionHistory(filters));
  }, [dispatch]);

  // Handle filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value,
      page: 0 // Reset to first page when filters change
    });
  };

  // Handle date change
  const handleDateChange = (name, date) => {
    setFilters({
      ...filters,
      [name]: date,
      page: 0 // Reset to first page when filters change
    });
  };

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setFilters({
      ...filters,
      page: newPage
    });
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (event) => {
    setFilters({
      ...filters,
      limit: parseInt(event.target.value, 10),
      page: 0
    });
  };

  // Apply filters
  const applyFilters = () => {
    dispatch(fetchTransactionHistory(filters));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      walletId: '',
      transactionType: '',
      status: '',
      startDate: null,
      endDate: null,
      page: 0,
      limit: 10
    });
    dispatch(fetchTransactionHistory({
      page: 0,
      limit: 10
    }));
  };

  // Handle transaction click
  const handleTransactionClick = (transaction) => {
    setSelectedTransaction(transaction);
    setDetailsDialogOpen(true);
  };

  // Get transaction type icon
  const getTransactionTypeIcon = (type) => {
    switch (type) {
      case 'generation':
        return <ArrowDownwardIcon color="success" />;
      case 'transfer':
        return <ArrowUpwardIcon color="primary" />;
      case 'cash_out':
        return <ArrowUpwardIcon color="error" />;
      case 'refund':
        return <ArrowDownwardIcon color="info" />;
      default:
        return null;
    }
  };

  // Get transaction status chip
  const getTransactionStatusChip = (status) => {
    switch (status) {
      case 'completed':
        return <Chip size="small" label="Completed" color="success" />;
      case 'pending':
        return <Chip size="small" label="Pending" color="warning" />;
      case 'processing':
        return <Chip size="small" label="Processing" color="info" />;
      case 'failed':
        return <Chip size="small" label="Failed" color="error" />;
      case 'cancelled':
        return <Chip size="small" label="Cancelled" color="default" />;
      default:
        return null;
    }
  };

  // Get wallet name by ID
  const getWalletName = (walletId) => {
    const wallet = wallets.find(w => w.walletId === walletId);
    return wallet ? wallet.name : 'Unknown Wallet';
  };

  // Get wallet currency by ID
  const getWalletCurrency = (walletId) => {
    const wallet = wallets.find(w => w.walletId === walletId);
    return wallet ? wallet.currency : 'USD';
  };

  // Format transaction type for display
  const formatTransactionType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <PageTitle title="Transaction History" />
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={applyFilters} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle Filters">
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              <FilterListIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Wallet"
                name="walletId"
                fullWidth
                value={filters.walletId}
                onChange={handleFilterChange}
                disabled={walletsLoading}
              >
                <MenuItem value="">All Wallets</MenuItem>
                {wallets.map((wallet) => (
                  <MenuItem key={wallet.walletId} value={wallet.walletId}>
                    {wallet.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Transaction Type"
                name="transactionType"
                fullWidth
                value={filters.transactionType}
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="generation">Generation</MenuItem>
                <MenuItem value="transfer">Transfer</MenuItem>
                <MenuItem value="cash_out">Cash Out</MenuItem>
                <MenuItem value="refund">Refund</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Status"
                name="status"
                fullWidth
                value={filters.status}
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="From Date"
                  value={filters.startDate}
                  onChange={(date) => handleDateChange('startDate', date)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="To Date"
                  value={filters.endDate}
                  onChange={(date) => handleDateChange('endDate', date)}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="contained"
                color="primary"
                onClick={applyFilters}
                disabled={loading}
                startIcon={loading ? <LoadingSpinner size={20} /> : <SearchIcon />}
                fullWidth
              >
                Apply Filters
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                onClick={resetFilters}
                disabled={loading}
                fullWidth
              >
                Reset Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Transactions Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Date & Time</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Wallet</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <LoadingSpinner />
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <ReceiptIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary">
                        No transactions found
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
                  <TableRow 
                    key={transaction.transactionId}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleTransactionClick(transaction)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getTransactionTypeIcon(transaction.transactionType)}
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {formatTransactionType(transaction.transactionType)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(transaction.createdAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(transaction.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {transaction.description || transaction.reference}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {transaction.sourceType === 'wallet' && transaction.sourceId ? 
                          getWalletName(transaction.sourceId) : 
                          transaction.destinationType === 'wallet' && transaction.destinationId ? 
                            getWalletName(transaction.destinationId) : 'System'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography 
                        variant="body2" 
                        color={
                          transaction.transactionType === 'generation' || transaction.transactionType === 'refund' 
                            ? 'success.main' 
                            : 'error.main'
                        }
                        fontWeight="medium"
                      >
                        {transaction.transactionType === 'generation' || transaction.transactionType === 'refund' 
                          ? '+' 
                          : '-'}{formatCurrency(transaction.amount, transaction.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {getTransactionStatusChip(transaction.status)}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        {!loading && transactions.length > 0 && pagination && (
          <TablePagination
            component="div"
            count={pagination.totalItems || 0}
            page={filters.page}
            onPageChange={handlePageChange}
            rowsPerPage={filters.limit}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        )}
      </Paper>

      {/* Transaction Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Transaction Details
          {selectedTransaction && getTransactionStatusChip(selectedTransaction.status)}
        </DialogTitle>
        <DialogContent dividers>
          {selectedTransaction && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Transaction ID
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {selectedTransaction.transactionId}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Reference
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {selectedTransaction.reference}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Divider />
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Type
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getTransactionTypeIcon(selectedTransaction.transactionType)}
                          <Typography variant="body1" sx={{ ml: 1 }}>
                            {formatTransactionType(selectedTransaction.transactionType)}
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Amount
                        </Typography>
                        <Typography 
                          variant="h6" 
                          color={
                            selectedTransaction.transactionType === 'generation' || selectedTransaction.transactionType === 'refund' 
                              ? 'success.main' 
                              : 'error.main'
                          }
                        >
                          {selectedTransaction.transactionType === 'generation' || selectedTransaction.transactionType === 'refund' 
                            ? '+' 
                            : '-'}{formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}
                        </Typography>
                      </Grid>
                      
                      {selectedTransaction.fee > 0 && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            Fee
                          </Typography>
                          <Typography variant="body1" color="error.main">
                            {formatCurrency(selectedTransaction.fee, selectedTransaction.currency)}
                          </Typography>
                        </Grid>
                      )}
                      
                      <Grid item xs={12}>
                        <Divider />
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Date
                        </Typography>
                        <Typography variant="body1">
                          {formatDate(selectedTransaction.createdAt)}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Time
                        </Typography>
                        <Typography variant="body1">
                          {formatTime(selectedTransaction.createdAt)}
                        </Typography>
                      </Grid>
                      
                      {selectedTransaction.completedAt && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            Completed At
                          </Typography>
                          <Typography variant="body1">
                            {new Date(selectedTransaction.completedAt).toLocaleString()}
                          </Typography>
                        </Grid>
                      )}
                      
                      <Grid item xs={12}>
                        <Divider />
                      </Grid>
                      
                      {selectedTransaction.sourceType === 'wallet' && selectedTransaction.sourceId && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            Source Wallet
                          </Typography>
                          <Typography variant="body1">
                            {getWalletName(selectedTransaction.sourceId)}
                          </Typography>
                        </Grid>
                      )}
                      
                      {selectedTransaction.destinationType === 'wallet' && selectedTransaction.destinationId && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            Destination Wallet
                          </Typography>
                          <Typography variant="body1">
                            {getWalletName(selectedTransaction.destinationId)}
                          </Typography>
                        </Grid>
                      )}
                      
                      {selectedTransaction.description && (
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">
                            Description
                          </Typography>
                          <Typography variant="body1">
                            {selectedTransaction.description}
                          </Typography>
                        </Grid>
                      )}
                      
                      {selectedTransaction.status === 'failed' && selectedTransaction.failureReason && (
                        <Grid item xs={12}>
                          <Alert severity="error">
                            <Typography variant="body2">
                              <strong>Failure Reason:</strong> {selectedTransaction.failureReason}
                            </Typography>
                          </Alert>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Transactions;
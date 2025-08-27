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
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Info as InfoIcon,
  Receipt as ReceiptIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { 
  getTransactions, 
  getTransactionDetails, 
  updateTransactionStatus, 
  clearError, 
  clearMessage 
} from '../../store/slices/adminSlice';
import PageTitle from '../../components/common/PageTitle';
import LoadingSpinner from '../../components/common/LoadingSpinner';

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
  if (!dateString) return '-';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

// Format time
const formatTime = (dateString) => {
  if (!dateString) return '-';
  const options = { hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleTimeString('en-US', options);
};

const AdminTransactions = () => {
  const [filters, setFilters] = useState({
    search: '',
    transactionType: '',
    status: '',
    startDate: null,
    endDate: null,
    minAmount: '',
    maxAmount: '',
    page: 0,
    limit: 10
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const dispatch = useDispatch();
  const { 
    transactions, 
    transactionDetails, 
    pagination, 
    loading, 
    error, 
    message 
  } = useSelector((state) => state.admin);

  // Fetch transactions on component mount
  useEffect(() => {
    dispatch(getTransactions(filters));
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
    dispatch(getTransactions({ ...filters, page: newPage }));
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (event) => {
    const newLimit = parseInt(event.target.value, 10);
    setFilters({
      ...filters,
      limit: newLimit,
      page: 0
    });
    dispatch(getTransactions({ ...filters, limit: newLimit, page: 0 }));
  };

  // Apply filters
  const applyFilters = () => {
    dispatch(getTransactions(filters));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      search: '',
      transactionType: '',
      status: '',
      startDate: null,
      endDate: null,
      minAmount: '',
      maxAmount: '',
      page: 0,
      limit: 10
    });
    dispatch(getTransactions({
      page: 0,
      limit: 10
    }));
  };

  // Handle transaction click
  const handleTransactionClick = (transactionId) => {
    dispatch(getTransactionDetails(transactionId))
      .unwrap()
      .then(() => {
        setDetailsDialogOpen(true);
      })
      .catch((err) => {
        console.error('Error fetching transaction details:', err);
      });
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Handle status change dialog open
  const handleStatusDialogOpen = (status) => {
    setNewStatus(status);
    setStatusDialogOpen(true);
  };

  // Handle update transaction status
  const handleUpdateStatus = () => {
    if (!newStatus) {
      return;
    }
    
    dispatch(updateTransactionStatus({
      transactionId: transactionDetails.transactionId,
      status: newStatus
    }))
      .unwrap()
      .then(() => {
        setStatusDialogOpen(false);
        dispatch(getTransactions(filters));
        dispatch(getTransactionDetails(transactionDetails.transactionId));
      })
      .catch((err) => {
        console.error('Error updating transaction status:', err);
      });
  };

  // Handle copy to clipboard
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
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

  // Format transaction type for display
  const formatTransactionType = (type) => {
    if (!type) return '-';
    return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <PageTitle title="Transaction Management" />
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

      {message && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {message}
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
                label="Search"
                name="search"
                fullWidth
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Transaction ID, Reference, or User"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
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
              <TextField
                label="Min Amount"
                name="minAmount"
                fullWidth
                value={filters.minAmount}
                onChange={handleFilterChange}
                type="number"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      $
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Max Amount"
                name="maxAmount"
                fullWidth
                value={filters.maxAmount}
                onChange={handleFilterChange}
                type="number"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      $
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Button
                variant="contained"
                color="primary"
                onClick={applyFilters}
                disabled={loading}
                startIcon={loading ? <LoadingSpinner size={20} /> : <SearchIcon />}
                fullWidth
              >
                Filter
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
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
                <TableCell>Transaction ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Date & Time</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
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
                  >
                    <TableCell onClick={() => handleTransactionClick(transaction.transactionId)}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                        {transaction.transactionId}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => handleTransactionClick(transaction.transactionId)}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getTransactionTypeIcon(transaction.transactionType)}
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {formatTransactionType(transaction.transactionType)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell onClick={() => handleTransactionClick(transaction.transactionId)}>
                      <Typography variant="body2">
                        {transaction.user?.firstName} {transaction.user?.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {transaction.user?.email}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => handleTransactionClick(transaction.transactionId)}>
                      <Typography variant="body2">
                        {formatDate(transaction.createdAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(transaction.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={() => handleTransactionClick(transaction.transactionId)}>
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
                    <TableCell align="center" onClick={() => handleTransactionClick(transaction.transactionId)}>
                      {getTransactionStatusChip(transaction.status)}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small" 
                          onClick={() => handleTransactionClick(transaction.transactionId)}
                        >
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
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
          {transactionDetails && getTransactionStatusChip(transactionDetails.status)}
        </DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <LoadingSpinner />
            </Box>
          ) : transactionDetails ? (
            <>
              <Box sx={{ mb: 2 }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="transaction details tabs">
                  <Tab label="Transaction Details" />
                  <Tab label="User Information" />
                  {transactionDetails.transactionType === 'cash_out' && <Tab label="Cash Out Details" />}
                </Tabs>
              </Box>
              
              {/* Transaction Details Tab */}
              {activeTab === 0 && (
                <Card variant="outlined">
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Transaction ID
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="body1" gutterBottom sx={{ mr: 1 }}>
                            {transactionDetails.transactionId}
                          </Typography>
                          <Tooltip title="Copy ID">
                            <IconButton size="small" onClick={() => handleCopy(transactionDetails.transactionId)}>
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Reference
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {transactionDetails.reference || '-'}
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
                          {getTransactionTypeIcon(transactionDetails.transactionType)}
                          <Typography variant="body1" sx={{ ml: 1 }}>
                            {formatTransactionType(transactionDetails.transactionType)}
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getTransactionStatusChip(transactionDetails.status)}
                          {transactionDetails.status !== 'completed' && transactionDetails.status !== 'cancelled' && (
                            <Button 
                              size="small" 
                              sx={{ ml: 2 }}
                              onClick={() => handleStatusDialogOpen(transactionDetails.status === 'failed' ? 'completed' : 'failed')}
                            >
                              Change Status
                            </Button>
                          )}
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Amount
                        </Typography>
                        <Typography 
                          variant="h6" 
                          color={
                            transactionDetails.transactionType === 'generation' || transactionDetails.transactionType === 'refund' 
                              ? 'success.main' 
                              : 'error.main'
                          }
                        >
                          {transactionDetails.transactionType === 'generation' || transactionDetails.transactionType === 'refund' 
                            ? '+' 
                            : '-'}{formatCurrency(transactionDetails.amount, transactionDetails.currency)}
                        </Typography>
                      </Grid>
                      
                      {transactionDetails.fee > 0 && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            Fee
                          </Typography>
                          <Typography variant="body1" color="error.main">
                            {formatCurrency(transactionDetails.fee, transactionDetails.currency)}
                          </Typography>
                        </Grid>
                      )}
                      
                      <Grid item xs={12}>
                        <Divider />
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Created At
                        </Typography>
                        <Typography variant="body1">
                          {formatDate(transactionDetails.createdAt)} {formatTime(transactionDetails.createdAt)}
                        </Typography>
                      </Grid>
                      
                      {transactionDetails.completedAt && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            Completed At
                          </Typography>
                          <Typography variant="body1">
                            {formatDate(transactionDetails.completedAt)} {formatTime(transactionDetails.completedAt)}
                          </Typography>
                        </Grid>
                      )}
                      
                      <Grid item xs={12}>
                        <Divider />
                      </Grid>
                      
                      {transactionDetails.sourceType === 'wallet' && transactionDetails.sourceId && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            Source Wallet
                          </Typography>
                          <Typography variant="body1">
                            {transactionDetails.sourceWallet?.name || transactionDetails.sourceId}
                          </Typography>
                        </Grid>
                      )}
                      
                      {transactionDetails.destinationType === 'wallet' && transactionDetails.destinationId && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            Destination Wallet
                          </Typography>
                          <Typography variant="body1">
                            {transactionDetails.destinationWallet?.name || transactionDetails.destinationId}
                          </Typography>
                        </Grid>
                      )}
                      
                      {transactionDetails.description && (
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">
                            Description
                          </Typography>
                          <Typography variant="body1">
                            {transactionDetails.description}
                          </Typography>
                        </Grid>
                      )}
                      
                      {transactionDetails.status === 'failed' && transactionDetails.failureReason && (
                        <Grid item xs={12}>
                          <Alert severity="error">
                            <Typography variant="body2">
                              <strong>Failure Reason:</strong> {transactionDetails.failureReason}
                            </Typography>
                          </Alert>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              )}
              
              {/* User Information Tab */}
              {activeTab === 1 && transactionDetails.user && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      User Information
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          User ID
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {transactionDetails.user.userId}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Name
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {transactionDetails.user.firstName} {transactionDetails.user.lastName}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Email
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {transactionDetails.user.email}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Typography variant="body1" gutterBottom sx={{ textTransform: 'capitalize' }}>
                          {transactionDetails.user.status}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          KYC Status
                        </Typography>
                        <Typography variant="body1" gutterBottom sx={{ textTransform: 'capitalize' }}>
                          {transactionDetails.user.kycStatus?.replace('_', ' ') || 'Not Submitted'}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Registered On
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {formatDate(transactionDetails.user.createdAt)}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Button
                          variant="outlined"
                          color="primary"
                          component="a"
                          href={`/admin/users?userId=${transactionDetails.user.userId}`}
                        >
                          View User Details
                        </Button>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              )}
              
              {/* Cash Out Details Tab */}
              {activeTab === 2 && transactionDetails.transactionType === 'cash_out' && transactionDetails.cashOutDetails && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Cash Out Details
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Cash Out ID
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {transactionDetails.cashOutDetails.cashOutId}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Provider
                        </Typography>
                        <Typography variant="body1" gutterBottom sx={{ textTransform: 'capitalize' }}>
                          {transactionDetails.cashOutDetails.provider?.replace('_', ' ')}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Provider Account ID
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {transactionDetails.cashOutDetails.providerAccountId}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Provider Account Name
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {transactionDetails.cashOutDetails.providerAccountName}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Provider Reference
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {transactionDetails.cashOutDetails.providerReference || '-'}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Provider Fee
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {formatCurrency(transactionDetails.cashOutDetails.providerFee || 0, transactionDetails.currency)}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Divider />
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Typography variant="body1" gutterBottom sx={{ textTransform: 'capitalize' }}>
                          {transactionDetails.cashOutDetails.status}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Created At
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {formatDate(transactionDetails.cashOutDetails.createdAt)} {formatTime(transactionDetails.cashOutDetails.createdAt)}
                        </Typography>
                      </Grid>
                      
                      {transactionDetails.cashOutDetails.completedAt && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            Completed At
                          </Typography>
                          <Typography variant="body1" gutterBottom>
                            {formatDate(transactionDetails.cashOutDetails.completedAt)} {formatTime(transactionDetails.cashOutDetails.completedAt)}
                          </Typography>
                        </Grid>
                      )}
                      
                      {transactionDetails.cashOutDetails.failureReason && (
                        <Grid item xs={12}>
                          <Alert severity="error">
                            <Typography variant="body2">
                              <strong>Failure Reason:</strong> {transactionDetails.cashOutDetails.failureReason}
                            </Typography>
                          </Alert>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Typography variant="body1" color="text.secondary" align="center">
              Transaction details not found
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
        <DialogTitle>Update Transaction Status</DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            Are you sure you want to change the transaction status to <strong>{newStatus}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This action will update the transaction status and may trigger additional system processes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUpdateStatus} 
            color="primary" 
            variant="contained"
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdminTransactions;
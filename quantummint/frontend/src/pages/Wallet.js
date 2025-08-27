import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  AccountBalanceWallet as WalletIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';
import { 
  fetchWallets, 
  createWallet, 
  updateWalletName 
} from '../store/slices/walletSlice';
import { fetchTransactionHistory } from '../store/slices/transactionSlice';
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
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

const Wallet = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newWalletData, setNewWalletData] = useState({
    name: '',
    currency: 'USD',
    walletType: 'personal'
  });
  const [editWalletData, setEditWalletData] = useState({
    walletId: '',
    name: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [selectedWallet, setSelectedWallet] = useState(null);

  const dispatch = useDispatch();
  const { wallets, loading, error } = useSelector((state) => state.wallet);
  const { transactions, loading: transactionsLoading } = useSelector((state) => state.transaction);

  // Fetch wallets on component mount
  useEffect(() => {
    dispatch(fetchWallets());
  }, [dispatch]);

  // Set selected wallet when wallets are loaded
  useEffect(() => {
    if (wallets.length > 0 && !selectedWallet) {
      setSelectedWallet(wallets[0].walletId);
      dispatch(fetchTransactionHistory({ walletId: wallets[0].walletId }));
    }
  }, [wallets, selectedWallet, dispatch]);

  // Handle wallet selection
  const handleWalletSelect = (walletId) => {
    setSelectedWallet(walletId);
    dispatch(fetchTransactionHistory({ walletId }));
  };

  // Handle create wallet dialog open
  const handleCreateDialogOpen = () => {
    setNewWalletData({
      name: '',
      currency: 'USD',
      walletType: 'personal'
    });
    setFormErrors({});
    setCreateDialogOpen(true);
  };

  // Handle edit wallet dialog open
  const handleEditDialogOpen = (wallet) => {
    setEditWalletData({
      walletId: wallet.walletId,
      name: wallet.name
    });
    setFormErrors({});
    setEditDialogOpen(true);
  };

  // Handle new wallet data change
  const handleNewWalletChange = (e) => {
    const { name, value } = e.target;
    setNewWalletData({
      ...newWalletData,
      [name]: value
    });
  };

  // Handle edit wallet data change
  const handleEditWalletChange = (e) => {
    const { name, value } = e.target;
    setEditWalletData({
      ...editWalletData,
      [name]: value
    });
  };

  // Validate wallet form
  const validateWalletForm = (data) => {
    const errors = {};

    if (!data.name.trim()) {
      errors.name = 'Wallet name is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle create wallet submit
  const handleCreateWallet = () => {
    if (validateWalletForm(newWalletData)) {
      dispatch(createWallet(newWalletData))
        .unwrap()
        .then(() => {
          setCreateDialogOpen(false);
        })
        .catch((err) => {
          console.error('Error creating wallet:', err);
        });
    }
  };

  // Handle edit wallet submit
  const handleUpdateWalletName = () => {
    if (validateWalletForm(editWalletData)) {
      dispatch(updateWalletName(editWalletData))
        .unwrap()
        .then(() => {
          setEditDialogOpen(false);
        })
        .catch((err) => {
          console.error('Error updating wallet:', err);
        });
    }
  };

  // Handle refresh wallets
  const handleRefreshWallets = () => {
    dispatch(fetchWallets());
    if (selectedWallet) {
      dispatch(fetchTransactionHistory({ walletId: selectedWallet }));
    }
  };

  // Get selected wallet data
  const getSelectedWalletData = () => {
    return wallets.find(wallet => wallet.walletId === selectedWallet) || null;
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

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <PageTitle title="My Wallets" />
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefreshWallets} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateDialogOpen}
            disabled={loading}
          >
            New Wallet
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Wallet List */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Your Wallets
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <LoadingSpinner />
              </Box>
            ) : wallets.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <WalletIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  No wallets found
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleCreateDialogOpen}
                  sx={{ mt: 1 }}
                >
                  Create Wallet
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {wallets.map((wallet) => (
                  <Card 
                    key={wallet.walletId} 
                    variant={selectedWallet === wallet.walletId ? "outlined" : "elevation"}
                    sx={{
                      cursor: 'pointer',
                      borderColor: selectedWallet === wallet.walletId ? 'primary.main' : 'divider',
                      bgcolor: selectedWallet === wallet.walletId ? 'action.hover' : 'background.paper'
                    }}
                    onClick={() => handleWalletSelect(wallet.walletId)}
                  >
                    <CardContent sx={{ pb: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1" component="div">
                          {wallet.name}
                        </Typography>
                        <Chip 
                          size="small" 
                          label={wallet.walletType.charAt(0).toUpperCase() + wallet.walletType.slice(1)} 
                          color={wallet.walletType === 'personal' ? 'primary' : wallet.walletType === 'business' ? 'secondary' : 'default'}
                          variant="outlined"
                        />
                      </Box>
                      <Typography variant="h6" component="div" sx={{ mt: 1 }}>
                        {formatCurrency(wallet.balance, wallet.currency)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {wallet.currency}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDialogOpen(wallet);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </CardActions>
                  </Card>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Wallet Details */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '100%' }}>
            {selectedWallet && getSelectedWalletData() ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    {getSelectedWalletData().name} Details
                  </Typography>
                  <Chip 
                    label={getSelectedWalletData().status.charAt(0).toUpperCase() + getSelectedWalletData().status.slice(1)} 
                    color={getSelectedWalletData().status === 'active' ? 'success' : 'error'}
                  />
                </Box>
                <Divider sx={{ mb: 3 }} />

                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Current Balance
                      </Typography>
                      <Typography variant="h4" sx={{ mt: 1 }}>
                        {formatCurrency(getSelectedWalletData().balance, getSelectedWalletData().currency)}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Wallet Type
                      </Typography>
                      <Typography variant="h6" sx={{ mt: 1 }}>
                        {getSelectedWalletData().walletType.charAt(0).toUpperCase() + getSelectedWalletData().walletType.slice(1)}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Typography variant="h6" gutterBottom>
                  Recent Transactions
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {transactionsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <LoadingSpinner />
                  </Box>
                ) : transactions.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                      No transactions found for this wallet
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {transactions.map((transaction) => (
                      <Paper
                        key={transaction.transactionId}
                        variant="outlined"
                        sx={{ p: 2, mb: 2 }}
                      >
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={1}>
                            {getTransactionTypeIcon(transaction.transactionType)}
                          </Grid>
                          <Grid item xs={5} sm={3}>
                            <Typography variant="subtitle2">
                              {transaction.transactionType.charAt(0).toUpperCase() + transaction.transactionType.slice(1).replace('_', ' ')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(transaction.createdAt)}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} sm={4}>
                            <Typography variant="body2">
                              {transaction.description || transaction.reference}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} sm={2} sx={{ textAlign: 'right' }}>
                            <Typography 
                              variant="subtitle2" 
                              color={
                                transaction.transactionType === 'generation' || transaction.transactionType === 'refund' 
                                  ? 'success.main' 
                                  : 'error.main'
                              }
                            >
                              {transaction.transactionType === 'generation' || transaction.transactionType === 'refund' 
                                ? '+' 
                                : '-'}{formatCurrency(transaction.amount, getSelectedWalletData().currency)}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} sm={2} sx={{ textAlign: 'right' }}>
                            {getTransactionStatusChip(transaction.status)}
                          </Grid>
                        </Grid>
                      </Paper>
                    ))}
                  </Box>
                )}
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <WalletIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Wallet Selected
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  Select a wallet from the list or create a new one to view details
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleCreateDialogOpen}
                >
                  Create Wallet
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Create Wallet Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Wallet</DialogTitle>
        <DialogContent>
          <TextField
            label="Wallet Name"
            name="name"
            fullWidth
            margin="normal"
            value={newWalletData.name}
            onChange={handleNewWalletChange}
            error={!!formErrors.name}
            helperText={formErrors.name}
            required
          />
          <TextField
            select
            label="Currency"
            name="currency"
            fullWidth
            margin="normal"
            value={newWalletData.currency}
            onChange={handleNewWalletChange}
          >
            <MenuItem value="USD">USD - US Dollar</MenuItem>
            <MenuItem value="EUR">EUR - Euro</MenuItem>
            <MenuItem value="GBP">GBP - British Pound</MenuItem>
            <MenuItem value="JPY">JPY - Japanese Yen</MenuItem>
            <MenuItem value="CAD">CAD - Canadian Dollar</MenuItem>
            <MenuItem value="AUD">AUD - Australian Dollar</MenuItem>
          </TextField>
          <TextField
            select
            label="Wallet Type"
            name="walletType"
            fullWidth
            margin="normal"
            value={newWalletData.walletType}
            onChange={handleNewWalletChange}
          >
            <MenuItem value="personal">Personal</MenuItem>
            <MenuItem value="business">Business</MenuItem>
            <MenuItem value="savings">Savings</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateWallet} 
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? <LoadingSpinner size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Wallet Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Wallet</DialogTitle>
        <DialogContent>
          <TextField
            label="Wallet Name"
            name="name"
            fullWidth
            margin="normal"
            value={editWalletData.name}
            onChange={handleEditWalletChange}
            error={!!formErrors.name}
            helperText={formErrors.name}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUpdateWalletName} 
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? <LoadingSpinner size={24} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Wallet;
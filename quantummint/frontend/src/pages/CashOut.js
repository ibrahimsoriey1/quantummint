import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Alert,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Chip,
  InputAdornment,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  Payment as PaymentIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  Info as InfoIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { fetchWallets } from '../store/slices/walletSlice';
import { 
  getPaymentProviders, 
  initiateCashOut, 
  getCashOutStatus, 
  resetCurrentCashOut, 
  clearError, 
  clearMessage 
} from '../store/slices/cashOutSlice';
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

const CashOut = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [cashOutData, setCashOutData] = useState({
    walletId: '',
    amount: '',
    provider: '',
    providerAccountId: '',
    providerAccountName: '',
    description: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);

  const dispatch = useDispatch();
  const { wallets, loading: walletsLoading } = useSelector((state) => state.wallet);
  const { 
    providers, 
    currentCashOut, 
    loading, 
    error, 
    message 
  } = useSelector((state) => state.cashOut);

  // Fetch wallets and payment providers on component mount
  useEffect(() => {
    dispatch(fetchWallets());
    dispatch(getPaymentProviders());
    
    // Clear any previous cash out data
    dispatch(resetCurrentCashOut());
    dispatch(clearError());
    dispatch(clearMessage());
    
    // Clean up on unmount
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
      dispatch(resetCurrentCashOut());
    };
  }, [dispatch]);

  // Update selected wallet when walletId changes
  useEffect(() => {
    if (cashOutData.walletId && wallets.length > 0) {
      const wallet = wallets.find(w => w.walletId === cashOutData.walletId);
      setSelectedWallet(wallet);
    } else {
      setSelectedWallet(null);
    }
  }, [cashOutData.walletId, wallets]);

  // Update selected provider when provider changes
  useEffect(() => {
    if (cashOutData.provider && providers.length > 0) {
      const provider = providers.find(p => p.providerId === cashOutData.provider);
      setSelectedProvider(provider);
    } else {
      setSelectedProvider(null);
    }
  }, [cashOutData.provider, providers]);

  // Poll for cash out status updates
  useEffect(() => {
    if (currentCashOut && currentCashOut.status === 'pending' && activeStep === 2) {
      const interval = setInterval(() => {
        dispatch(getCashOutStatus(currentCashOut.cashOutId));
      }, 5000); // Check every 5 seconds
      
      setStatusCheckInterval(interval);
      
      return () => clearInterval(interval);
    }
    
    // If status changes to completed or failed, stop polling
    if (currentCashOut && (currentCashOut.status === 'completed' || currentCashOut.status === 'failed')) {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        setStatusCheckInterval(null);
      }
    }
  }, [currentCashOut, activeStep, dispatch, statusCheckInterval]);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // For amount field, only allow numbers and decimal point
    if (name === 'amount') {
      const regex = /^\d*\.?\d{0,2}$/;
      if (value === '' || regex.test(value)) {
        setCashOutData({
          ...cashOutData,
          [name]: value
        });
      }
    } else {
      setCashOutData({
        ...cashOutData,
        [name]: value
      });
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (!cashOutData.walletId) {
      errors.walletId = 'Please select a wallet';
    }

    if (!cashOutData.amount) {
      errors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(cashOutData.amount)) || parseFloat(cashOutData.amount) <= 0) {
      errors.amount = 'Amount must be greater than zero';
    } else if (selectedWallet && parseFloat(cashOutData.amount) > selectedWallet.balance) {
      errors.amount = 'Amount cannot exceed wallet balance';
    }

    if (!cashOutData.provider) {
      errors.provider = 'Please select a payment provider';
    }

    if (!cashOutData.providerAccountId) {
      errors.providerAccountId = 'Account ID/Number is required';
    }

    if (!cashOutData.providerAccountName) {
      errors.providerAccountName = 'Account name is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle next step
  const handleNext = () => {
    if (activeStep === 0) {
      if (validateForm()) {
        setActiveStep(1);
      }
    } else if (activeStep === 1) {
      handleInitiateCashOut();
    }
  };

  // Handle back step
  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  // Handle initiate cash out
  const handleInitiateCashOut = () => {
    if (validateForm()) {
      dispatch(initiateCashOut({
        walletId: cashOutData.walletId,
        amount: parseFloat(cashOutData.amount),
        provider: cashOutData.provider,
        providerAccountId: cashOutData.providerAccountId,
        providerAccountName: cashOutData.providerAccountName,
        description: cashOutData.description || 'Cash out'
      }))
        .unwrap()
        .then(() => {
          setActiveStep(2);
        })
        .catch((err) => {
          console.error('Error initiating cash out:', err);
        });
    }
  };

  // Handle start new cash out
  const handleStartNew = () => {
    setCashOutData({
      walletId: '',
      amount: '',
      provider: '',
      providerAccountId: '',
      providerAccountName: '',
      description: ''
    });
    setFormErrors({});
    setActiveStep(0);
    dispatch(resetCurrentCashOut());
    dispatch(clearError());
    dispatch(clearMessage());
  };

  // Handle copy to clipboard
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Get status chip
  const getStatusChip = (status) => {
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

  // Steps content
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Wallet and Amount
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Select Wallet"
                  name="walletId"
                  fullWidth
                  value={cashOutData.walletId}
                  onChange={handleChange}
                  error={!!formErrors.walletId}
                  helperText={formErrors.walletId}
                  disabled={walletsLoading || loading}
                  required
                >
                  {wallets.map((wallet) => (
                    <MenuItem key={wallet.walletId} value={wallet.walletId}>
                      {wallet.name} ({formatCurrency(wallet.balance, wallet.currency)})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Amount"
                  name="amount"
                  fullWidth
                  value={cashOutData.amount}
                  onChange={handleChange}
                  error={!!formErrors.amount}
                  helperText={formErrors.amount}
                  disabled={loading || !selectedWallet}
                  InputProps={{
                    startAdornment: selectedWallet ? selectedWallet.currency : '$'
                  }}
                  required
                />
                {selectedWallet && (
                  <FormHelperText>
                    Available balance: {formatCurrency(selectedWallet.balance, selectedWallet.currency)}
                  </FormHelperText>
                )}
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  select
                  label="Select Payment Provider"
                  name="provider"
                  fullWidth
                  value={cashOutData.provider}
                  onChange={handleChange}
                  error={!!formErrors.provider}
                  helperText={formErrors.provider}
                  disabled={loading || providers.length === 0}
                  required
                >
                  {providers.map((provider) => (
                    <MenuItem key={provider.providerId} value={provider.providerId}>
                      {provider.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              {selectedProvider && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      label={`${selectedProvider.name} Account Number`}
                      name="providerAccountId"
                      fullWidth
                      value={cashOutData.providerAccountId}
                      onChange={handleChange}
                      error={!!formErrors.providerAccountId}
                      helperText={formErrors.providerAccountId}
                      disabled={loading}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      label="Account Holder Name"
                      name="providerAccountName"
                      fullWidth
                      value={cashOutData.providerAccountName}
                      onChange={handleChange}
                      error={!!formErrors.providerAccountName}
                      helperText={formErrors.providerAccountName}
                      disabled={loading}
                      required
                    />
                  </Grid>
                </>
              )}
              
              <Grid item xs={12}>
                <TextField
                  label="Description (Optional)"
                  name="description"
                  fullWidth
                  value={cashOutData.description}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Purpose of cash out"
                />
              </Grid>
            </Grid>
          </Box>
        );
      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Confirm Cash Out
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              Please review the details below before confirming the cash out request.
            </Alert>
            
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Wallet
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedWallet?.name}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Current Balance
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedWallet ? formatCurrency(selectedWallet.balance, selectedWallet.currency) : '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Divider />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Cash Out Amount
                    </Typography>
                    <Typography variant="h6" color="error.main" gutterBottom>
                      {selectedWallet ? formatCurrency(parseFloat(cashOutData.amount) || 0, selectedWallet.currency) : '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      New Balance After Cash Out
                    </Typography>
                    <Typography variant="h6" color="primary" gutterBottom>
                      {selectedWallet ? formatCurrency(selectedWallet.balance - parseFloat(cashOutData.amount || 0), selectedWallet.currency) : '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Divider />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Payment Provider
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedProvider?.name || '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Account Number
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {cashOutData.providerAccountId}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Account Holder
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {cashOutData.providerAccountName}
                    </Typography>
                  </Grid>
                  
                  {selectedProvider?.fee > 0 && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Provider Fee
                      </Typography>
                      <Typography variant="body1" color="error.main" gutterBottom>
                        {selectedWallet ? formatCurrency(selectedProvider.fee, selectedWallet.currency) : '-'}
                      </Typography>
                    </Grid>
                  )}
                  
                  {cashOutData.description && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Description
                      </Typography>
                      <Typography variant="body1">
                        {cashOutData.description}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
            
            <Typography variant="body2" color="text.secondary">
              By clicking "Confirm Cash Out", you agree to the terms and conditions for cash out transactions.
            </Typography>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ textAlign: 'center' }}>
            {currentCashOut?.status === 'completed' ? (
              <>
                <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
                
                <Typography variant="h5" gutterBottom>
                  Cash Out Successful!
                </Typography>
                
                <Typography variant="body1" paragraph>
                  {formatCurrency(parseFloat(cashOutData.amount), selectedWallet?.currency)} has been sent to your {selectedProvider?.name} account.
                </Typography>
              </>
            ) : currentCashOut?.status === 'failed' ? (
              <>
                <Alert severity="error" sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Cash Out Failed
                  </Typography>
                  <Typography variant="body1">
                    {currentCashOut.failureReason || 'There was an error processing your cash out request.'}
                  </Typography>
                </Alert>
                
                <Typography variant="body1" paragraph>
                  Your funds have not been deducted from your wallet. Please try again or contact support if the issue persists.
                </Typography>
              </>
            ) : (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                  <CircularProgress />
                </Box>
                
                <Typography variant="h5" gutterBottom>
                  Processing Your Cash Out
                </Typography>
                
                <Typography variant="body1" paragraph>
                  Your cash out request is being processed. This may take a few minutes.
                </Typography>
                
                <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                  <Typography variant="body2">
                    • Do not close this page until the process is complete.
                  </Typography>
                  <Typography variant="body2">
                    • You will receive a notification once the cash out is completed.
                  </Typography>
                  <Typography variant="body2">
                    • The funds will be sent to your {selectedProvider?.name} account.
                  </Typography>
                </Alert>
              </>
            )}
            
            <Card variant="outlined" sx={{ mb: 3, mt: 3, textAlign: 'left' }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Cash Out ID
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body1" gutterBottom sx={{ mr: 1 }}>
                        {currentCashOut?.cashOutId || '-'}
                      </Typography>
                      <Tooltip title="Copy ID">
                        <IconButton size="small" onClick={() => handleCopy(currentCashOut?.cashOutId)}>
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    {currentCashOut && getStatusChip(currentCashOut.status)}
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Divider />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Wallet
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedWallet?.name || '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Amount
                    </Typography>
                    <Typography variant="h6" color="error.main" gutterBottom>
                      {selectedWallet ? formatCurrency(parseFloat(cashOutData.amount), selectedWallet.currency) : '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Payment Provider
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedProvider?.name || '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Account Number
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {cashOutData.providerAccountId || '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Date & Time
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {currentCashOut?.createdAt ? new Date(currentCashOut.createdAt).toLocaleString() : new Date().toLocaleString()}
                    </Typography>
                  </Grid>
                  
                  {currentCashOut?.completedAt && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Completed At
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {new Date(currentCashOut.completedAt).toLocaleString()}
                      </Typography>
                    </Grid>
                  )}
                  
                  {currentCashOut?.reference && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Reference
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        {currentCashOut.reference}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
            
            <Box sx={{ mt: 3 }}>
              {(currentCashOut?.status === 'completed' || currentCashOut?.status === 'failed') && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleStartNew}
                  sx={{ mr: 2 }}
                >
                  New Cash Out
                </Button>
              )}
              
              <Button
                variant="outlined"
                component="a"
                href="/transactions"
              >
                View Transactions
              </Button>
            </Box>
          </Box>
        );
      default:
        return 'Unknown step';
    }
  };

  return (
    <>
      <PageTitle title="Cash Out" />
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          <Step>
            <StepLabel>Select Wallet & Amount</StepLabel>
          </Step>
          <Step>
            <StepLabel>Confirm Details</StepLabel>
          </Step>
          <Step>
            <StepLabel>Processing & Completion</StepLabel>
          </Step>
        </Stepper>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error.message}
          </Alert>
        )}
        
        {message && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {message}
          </Alert>
        )}
        
        {walletsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <LoadingSpinner />
          </Box>
        ) : wallets.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <WalletIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              No Wallets Available
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              You need to create a wallet before you can cash out.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              component="a"
              href="/wallet"
            >
              Create Wallet
            </Button>
          </Box>
        ) : (
          <>
            <Box sx={{ mt: 2, mb: 4 }}>
              {getStepContent(activeStep)}
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                disabled={activeStep === 0 || activeStep === 2 || loading}
                onClick={handleBack}
              >
                Back
              </Button>
              
              <Box>
                {activeStep !== 2 && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleNext}
                    disabled={loading}
                    endIcon={activeStep === 1 ? <PaymentIcon /> : <ArrowForwardIcon />}
                  >
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : activeStep === 1 ? (
                      'Confirm Cash Out'
                    ) : (
                      'Next'
                    )}
                  </Button>
                )}
              </Box>
            </Box>
          </>
        )}
      </Paper>
      
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            About Cash Out
          </Typography>
          <Tooltip title="Cash Out Information">
            <IconButton onClick={() => setInfoDialogOpen(true)}>
              <InfoIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        <Typography variant="body1" paragraph>
          Cash out allows you to transfer your digital money to external payment providers like Orange Money, AfriMoney, or Stripe.
        </Typography>
        
        <Typography variant="body1" paragraph>
          The process is secure and typically takes a few minutes to complete, depending on the payment provider.
        </Typography>
        
        <Typography variant="body2" color="text.secondary">
          Note: Cash out transactions may be subject to fees depending on the provider and amount.
        </Typography>
      </Paper>
      
      {/* Cash Out Information Dialog */}
      <Dialog open={infoDialogOpen} onClose={() => setInfoDialogOpen(false)} maxWidth="md">
        <DialogTitle>Cash Out Information</DialogTitle>
        <DialogContent dividers>
          <Typography variant="h6" gutterBottom>
            Supported Payment Providers
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {providers.map((provider) => (
              <Grid item xs={12} sm={6} md={4} key={provider.providerId}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6">{provider.name}</Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {provider.description}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2">
                      <strong>Processing Time:</strong> {provider.processingTime}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Fee:</strong> {formatCurrency(provider.fee, 'USD')}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Min Amount:</strong> {formatCurrency(provider.minAmount, 'USD')}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Max Amount:</strong> {formatCurrency(provider.maxAmount, 'USD')}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          <Typography variant="h6" gutterBottom>
            Cash Out Process
          </Typography>
          <Typography variant="body1" paragraph>
            1. Select the wallet you want to cash out from and enter the amount.
          </Typography>
          <Typography variant="body1" paragraph>
            2. Choose your preferred payment provider and enter your account details.
          </Typography>
          <Typography variant="body1" paragraph>
            3. Review and confirm the cash out details.
          </Typography>
          <Typography variant="body1" paragraph>
            4. Wait for the transaction to be processed. This typically takes a few minutes.
          </Typography>
          <Typography variant="body1" paragraph>
            5. Once completed, the funds will be available in your selected payment provider account.
          </Typography>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              For any issues with your cash out, please contact our support team with your Cash Out ID.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CashOut;
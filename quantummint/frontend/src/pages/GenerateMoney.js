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
  Chip
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  Paid as PaidIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { fetchWallets } from '../store/slices/walletSlice';
import { generateMoney, resetGenerationState } from '../store/slices/generationSlice';
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

const GenerateMoney = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [generationData, setGenerationData] = useState({
    walletId: '',
    amount: '',
    description: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [selectedWallet, setSelectedWallet] = useState(null);

  const dispatch = useDispatch();
  const { wallets, loading: walletsLoading } = useSelector((state) => state.wallet);
  const { loading, error, success, generationResult } = useSelector((state) => state.generation);

  // Fetch wallets on component mount
  useEffect(() => {
    dispatch(fetchWallets());
    
    // Reset generation state when component unmounts
    return () => {
      dispatch(resetGenerationState());
    };
  }, [dispatch]);

  // Update selected wallet when walletId changes
  useEffect(() => {
    if (generationData.walletId && wallets.length > 0) {
      const wallet = wallets.find(w => w.walletId === generationData.walletId);
      setSelectedWallet(wallet);
    } else {
      setSelectedWallet(null);
    }
  }, [generationData.walletId, wallets]);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // For amount field, only allow numbers and decimal point
    if (name === 'amount') {
      const regex = /^\d*\.?\d{0,2}$/;
      if (value === '' || regex.test(value)) {
        setGenerationData({
          ...generationData,
          [name]: value
        });
      }
    } else {
      setGenerationData({
        ...generationData,
        [name]: value
      });
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (!generationData.walletId) {
      errors.walletId = 'Please select a wallet';
    }

    if (!generationData.amount) {
      errors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(generationData.amount)) || parseFloat(generationData.amount) <= 0) {
      errors.amount = 'Amount must be greater than zero';
    } else if (parseFloat(generationData.amount) > 10000) {
      errors.amount = 'Amount cannot exceed 10,000';
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
      handleGenerateMoney();
    }
  };

  // Handle back step
  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  // Handle generate money
  const handleGenerateMoney = () => {
    if (validateForm()) {
      dispatch(generateMoney({
        walletId: generationData.walletId,
        amount: parseFloat(generationData.amount),
        description: generationData.description || 'Money generation'
      }))
        .unwrap()
        .then(() => {
          setActiveStep(2);
        })
        .catch((err) => {
          console.error('Error generating money:', err);
        });
    }
  };

  // Handle start new generation
  const handleStartNew = () => {
    setGenerationData({
      walletId: '',
      amount: '',
      description: ''
    });
    setFormErrors({});
    setActiveStep(0);
    dispatch(resetGenerationState());
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
                  value={generationData.walletId}
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
                  value={generationData.amount}
                  onChange={handleChange}
                  error={!!formErrors.amount}
                  helperText={formErrors.amount}
                  disabled={loading}
                  InputProps={{
                    startAdornment: selectedWallet ? selectedWallet.currency : '$'
                  }}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Description (Optional)"
                  name="description"
                  fullWidth
                  value={generationData.description}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Purpose of generation"
                />
              </Grid>
            </Grid>
          </Box>
        );
      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Confirm Generation
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              Please review the details below before confirming the money generation.
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
                      Generation Amount
                    </Typography>
                    <Typography variant="h6" color="primary" gutterBottom>
                      {selectedWallet ? formatCurrency(parseFloat(generationData.amount) || 0, selectedWallet.currency) : '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      New Balance After Generation
                    </Typography>
                    <Typography variant="h6" color="success.main" gutterBottom>
                      {selectedWallet ? formatCurrency(selectedWallet.balance + parseFloat(generationData.amount || 0), selectedWallet.currency) : '-'}
                    </Typography>
                  </Grid>
                  
                  {generationData.description && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Description
                      </Typography>
                      <Typography variant="body1">
                        {generationData.description}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
            
            <Typography variant="body2" color="text.secondary">
              By clicking "Generate Money", you confirm that this generation complies with all applicable terms and conditions.
            </Typography>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
            
            <Typography variant="h5" gutterBottom>
              Money Generated Successfully!
            </Typography>
            
            <Typography variant="body1" paragraph>
              {formatCurrency(parseFloat(generationData.amount), selectedWallet?.currency)} has been added to your wallet.
            </Typography>
            
            <Card variant="outlined" sx={{ mb: 3, mt: 3 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Transaction ID
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {generationResult?.transactionId || '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip 
                      label={generationResult?.status || 'Completed'} 
                      color="success" 
                      size="small"
                    />
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
                    <Typography variant="h6" color="success.main" gutterBottom>
                      {selectedWallet ? formatCurrency(parseFloat(generationData.amount), selectedWallet.currency) : '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Date & Time
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {generationResult?.createdAt ? new Date(generationResult.createdAt).toLocaleString() : new Date().toLocaleString()}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Reference
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {generationResult?.reference || '-'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleStartNew}
                sx={{ mr: 2 }}
              >
                Generate More Money
              </Button>
              
              <Button
                variant="outlined"
                component="a"
                href="/wallet"
              >
                View Wallet
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
      <PageTitle title="Generate Money" />
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          <Step>
            <StepLabel>Select Wallet & Amount</StepLabel>
          </Step>
          <Step>
            <StepLabel>Confirm Details</StepLabel>
          </Step>
          <Step>
            <StepLabel>Generation Complete</StepLabel>
          </Step>
        </Stepper>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
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
              You need to create a wallet before you can generate money.
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
                    endIcon={activeStep === 1 ? <PaidIcon /> : <ArrowForwardIcon />}
                  >
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : activeStep === 1 ? (
                      'Generate Money'
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
        <Typography variant="h6" gutterBottom>
          About Money Generation
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Typography variant="body1" paragraph>
          The QuantumMint platform allows you to generate digital money directly into your wallet. This process is secure and instantaneous.
        </Typography>
        
        <Typography variant="body1" paragraph>
          Generated funds can be used for transactions within the platform or cashed out to external payment providers like Orange Money, AfriMoney, or Stripe.
        </Typography>
        
        <Typography variant="body2" color="text.secondary">
          Note: There are daily and monthly generation limits based on your account level and verification status.
        </Typography>
      </Paper>
    </>
  );
};

export default GenerateMoney;
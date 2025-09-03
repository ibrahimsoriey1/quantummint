import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../hooks/useAuth';
import moneyGenerationService from '../services/moneyGenerationService';
import kycService from '../services/kycService';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';

const generationMethods = [
  {
    id: 'standard',
    name: 'Standard Generation',
    description: 'Generate money at the standard rate with no additional fees.',
    fee: 0,
    minAmount: 10,
    maxAmount: 1000,
    processingTime: '24 hours',
    kycRequired: false,
  },
  {
    id: 'express',
    name: 'Express Generation',
    description: 'Generate money faster with a small fee.',
    fee: 0.05, // 5%
    minAmount: 10,
    maxAmount: 5000,
    processingTime: '1 hour',
    kycRequired: true,
  },
  {
    id: 'premium',
    name: 'Premium Generation',
    description: 'Generate larger amounts with priority processing.',
    fee: 0.1, // 10%
    minAmount: 100,
    maxAmount: 10000,
    processingTime: 'Instant',
    kycRequired: true,
  },
];

const MoneyGeneration = () => {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [generationId, setGenerationId] = useState(null);
  const [kycStatus, setKycStatus] = useState('pending');
  const [walletBalance, setWalletBalance] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(generationMethods[0]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Fetch KYC status
        const kycResponse = await kycService.getKycStatus();
        setKycStatus(kycResponse.status);
        
        // Fetch wallet balance
        const walletResponse = await moneyGenerationService.getWalletBalance();
        setWalletBalance(walletResponse.balance);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setError('Failed to load required data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setSuccess(false);
    setGenerationId(null);
    formik.resetForm();
  };

  const handleMethodChange = (event) => {
    const method = generationMethods.find(m => m.id === event.target.value);
    setSelectedMethod(method);
    formik.setFieldValue('generationMethod', method.id);
    
    // Reset amount if it's outside the new method's limits
    if (formik.values.amount < method.minAmount) {
      formik.setFieldValue('amount', method.minAmount);
    } else if (formik.values.amount > method.maxAmount) {
      formik.setFieldValue('amount', method.maxAmount);
    }
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const validationSchema = Yup.object({
    amount: Yup.number()
      .required('Amount is required')
      .min(selectedMethod.minAmount, `Minimum amount is $${selectedMethod.minAmount}`)
      .max(selectedMethod.maxAmount, `Maximum amount is $${selectedMethod.maxAmount}`),
    generationMethod: Yup.string()
      .required('Generation method is required'),
    purpose: Yup.string()
      .required('Purpose is required')
      .min(10, 'Purpose must be at least 10 characters'),
  });

  const formik = useFormik({
    initialValues: {
      amount: selectedMethod.minAmount,
      generationMethod: selectedMethod.id,
      purpose: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');
        
        // Check if KYC is required but not approved
        if (selectedMethod.kycRequired && kycStatus !== 'approved') {
          setError('KYC verification is required for this generation method. Please complete your KYC verification first.');
          setLoading(false);
          return;
        }
        
        // Submit generation request
        const response = await moneyGenerationService.generateMoney({
          amount: values.amount,
          method: values.generationMethod,
          purpose: values.purpose,
        });
        
        setGenerationId(response.generationId);
        setSuccess(true);
        handleNext();
        
        // Update wallet balance
        const walletResponse = await moneyGenerationService.getWalletBalance();
        setWalletBalance(walletResponse.balance);
      } catch (error) {
        console.error('Generation error:', error);
        setError(error.message || 'Failed to generate money. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  const calculateFee = () => {
    return formik.values.amount * selectedMethod.fee;
  };

  const calculateTotal = () => {
    return formik.values.amount - calculateFee();
  };

  if (loading && activeStep === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Generate Money
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Stepper activeStep={activeStep} orientation="vertical">
              {/* Step 1: Select Generation Method */}
              <Step>
                <StepLabel>Select Generation Method</StepLabel>
                <StepContent>
                  <FormControl component="fieldset">
                    <FormLabel component="legend">Choose a generation method:</FormLabel>
                    <RadioGroup
                      aria-label="generation-method"
                      name="generationMethod"
                      value={formik.values.generationMethod}
                      onChange={handleMethodChange}
                    >
                      {generationMethods.map((method) => (
                        <Card 
                          key={method.id} 
                          sx={{ 
                            mb: 2, 
                            border: method.id === formik.values.generationMethod ? '2px solid #3f51b5' : 'none',
                          }}
                        >
                          <CardContent>
                            <FormControlLabel
                              value={method.id}
                              control={<Radio />}
                              label={
                                <Box>
                                  <Typography variant="h6" component="div">
                                    {method.name}
                                    {method.kycRequired && kycStatus !== 'approved' && (
                                      <Chip 
                                        label="KYC Required" 
                                        color="warning" 
                                        size="small" 
                                        sx={{ ml: 1 }}
                                      />
                                    )}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {method.description}
                                  </Typography>
                                  <Box sx={{ mt: 1 }}>
                                    <Typography variant="body2">
                                      <strong>Fee:</strong> {method.fee * 100}%
                                    </Typography>
                                    <Typography variant="body2">
                                      <strong>Min/Max:</strong> ${method.minAmount} - ${method.maxAmount}
                                    </Typography>
                                    <Typography variant="body2">
                                      <strong>Processing Time:</strong> {method.processingTime}
                                    </Typography>
                                  </Box>
                                </Box>
                              }
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  
                  <Box sx={{ mb: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      Continue
                    </Button>
                  </Box>
                </StepContent>
              </Step>
              
              {/* Step 2: Enter Amount and Purpose */}
              <Step>
                <StepLabel>Enter Details</StepLabel>
                <StepContent>
                  <form onSubmit={formik.handleSubmit}>
                    <TextField
                      fullWidth
                      id="amount"
                      name="amount"
                      label="Amount ($)"
                      type="number"
                      value={formik.values.amount}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.amount && Boolean(formik.errors.amount)}
                      helperText={formik.touched.amount && formik.errors.amount}
                      margin="normal"
                      InputProps={{
                        inputProps: {
                          min: selectedMethod.minAmount,
                          max: selectedMethod.maxAmount,
                        },
                      }}
                    />
                    
                    <TextField
                      fullWidth
                      id="purpose"
                      name="purpose"
                      label="Purpose of Generation"
                      multiline
                      rows={4}
                      value={formik.values.purpose}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.purpose && Boolean(formik.errors.purpose)}
                      helperText={formik.touched.purpose && formik.errors.purpose}
                      margin="normal"
                      placeholder="Explain why you are generating this money..."
                    />
                    
                    <Box sx={{ mb: 2, mt: 2 }}>
                      <Button
                        variant="outlined"
                        onClick={handleBack}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        Back
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleOpenDialog}
                        sx={{ mt: 1, mr: 1 }}
                        disabled={!formik.isValid || formik.isSubmitting}
                      >
                        Review
                      </Button>
                    </Box>
                  </form>
                </StepContent>
              </Step>
              
              {/* Step 3: Confirmation */}
              <Step>
                <StepLabel>Confirmation</StepLabel>
                <StepContent>
                  <Box sx={{ mb: 2 }}>
                    {success ? (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <CheckCircleIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
                        <Typography variant="h5" gutterBottom>
                          Money Generation Successful!
                        </Typography>
                        <Typography variant="body1" paragraph>
                          Your generation request has been processed successfully.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          Generation ID: {generationId}
                        </Typography>
                        <Typography variant="body1" paragraph>
                          ${formik.values.amount} has been added to your wallet.
                        </Typography>
                        <Button
                          variant="contained"
                          onClick={handleReset}
                          sx={{ mt: 1, mr: 1 }}
                        >
                          Generate More
                        </Button>
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <CircularProgress sx={{ mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          Processing your generation request...
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Please wait while we process your request.
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </StepContent>
              </Step>
            </Stepper>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          {/* Wallet Balance Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Wallet Balance
              </Typography>
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                ${walletBalance.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
          
          {/* Generation Summary */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Generation Summary
              </Typography>
              <List>
                <ListItem>
                  <ListItemText primary="Method" secondary={selectedMethod.name} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Amount" secondary={`$${formik.values.amount}`} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Fee" secondary={`$${calculateFee().toFixed(2)} (${selectedMethod.fee * 100}%)`} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText 
                    primary="Total to Receive" 
                    secondary={
                      <Typography variant="body1" fontWeight="bold">
                        ${calculateTotal().toFixed(2)}
                      </Typography>
                    } 
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText primary="Processing Time" secondary={selectedMethod.processingTime} />
                </ListItem>
              </List>
              
              {selectedMethod.kycRequired && kycStatus !== 'approved' && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  KYC verification is required for this generation method.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Confirmation Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Confirm Money Generation
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            You are about to generate ${formik.values.amount} using the {selectedMethod.name} method.
            A fee of ${calculateFee().toFixed(2)} will be applied, and you will receive ${calculateTotal().toFixed(2)}.
            
            {selectedMethod.kycRequired && kycStatus !== 'approved' && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="warning">
                  KYC verification is required for this generation method. Please complete your KYC verification first.
                </Alert>
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={() => {
              handleCloseDialog();
              formik.handleSubmit();
              handleNext();
            }} 
            autoFocus
            variant="contained"
            disabled={selectedMethod.kycRequired && kycStatus !== 'approved'}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MoneyGeneration;
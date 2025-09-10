import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  VerifiedUser,
  CheckCircle,
  Warning
} from '@mui/icons-material';

const KYCVerification = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [kycStatus, setKycStatus] = useState('not_started');
  const [personalInfo, setPersonalInfo] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    phoneNumber: '',
    email: ''
  });
  const [addressInfo, setAddressInfo] = useState({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: ''
  });

  const steps = [
    'Personal Information',
    'Address Information',
    'Document Upload',
    'Review & Submit'
  ];

  useEffect(() => {
    fetchKYCStatus();
  }, []);

  const fetchKYCStatus = async() => {
    try {
      // Mock KYC status
      setKycStatus('in_progress');
      setActiveStep(1);
    } catch (err) {
      setError('Failed to load KYC status');
    }
  };

  const handlePersonalInfoChange = (e) => {
    const { name, value } = e.target;
    setPersonalInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddressInfoChange = (e) => {
    const { name, value } = e.target;
    setAddressInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNext = async() => {
    setLoading(true);
    setError('');

    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (activeStep === steps.length - 1) {
        setSuccess('KYC verification submitted successfully!');
        setKycStatus('pending_review');
      } else {
        setActiveStep(prev => prev + 1);
      }
    } catch (err) {
      setError('Failed to save information');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const getStatusColor = (status) => {
    switch (status) {
    case 'verified':
      return 'success';
    case 'pending_review':
      return 'warning';
    case 'rejected':
      return 'error';
    case 'in_progress':
      return 'info';
    default:
      return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
    case 'verified':
      return <CheckCircle />;
    case 'pending_review':
      return <Warning />;
    case 'rejected':
      return <Warning />;
    default:
      return <VerifiedUser />;
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
    case 0:
      return (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="First Name"
              name="firstName"
              value={personalInfo.firstName}
              onChange={handlePersonalInfoChange}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Last Name"
              name="lastName"
              value={personalInfo.lastName}
              onChange={handlePersonalInfoChange}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Date of Birth"
              name="dateOfBirth"
              type="date"
              value={personalInfo.dateOfBirth}
              onChange={handlePersonalInfoChange}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel>Nationality</InputLabel>
              <Select
                name="nationality"
                value={personalInfo.nationality}
                onChange={handlePersonalInfoChange}
                label="Nationality"
              >
                <MenuItem value="US">United States</MenuItem>
                <MenuItem value="FR">France</MenuItem>
                <MenuItem value="SN">Senegal</MenuItem>
                <MenuItem value="CI">Côte d&apos;Ivoire</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Phone Number"
              name="phoneNumber"
              value={personalInfo.phoneNumber}
              onChange={handlePersonalInfoChange}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              value={personalInfo.email}
              onChange={handlePersonalInfoChange}
              required
            />
          </Grid>
        </Grid>
      );

    case 1:
      return (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Street Address"
              name="street"
              value={addressInfo.street}
              onChange={handleAddressInfoChange}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="City"
              name="city"
              value={addressInfo.city}
              onChange={handleAddressInfoChange}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="State/Province"
              name="state"
              value={addressInfo.state}
              onChange={handleAddressInfoChange}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Postal Code"
              name="postalCode"
              value={addressInfo.postalCode}
              onChange={handleAddressInfoChange}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel>Country</InputLabel>
              <Select
                name="country"
                value={addressInfo.country}
                onChange={handleAddressInfoChange}
                label="Country"
              >
                <MenuItem value="US">United States</MenuItem>
                <MenuItem value="FR">France</MenuItem>
                <MenuItem value="SN">Senegal</MenuItem>
                <MenuItem value="CI">Côte d&apos;Ivoire</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      );

    case 2:
      return (
        <Box>
          <Typography variant="body1" gutterBottom>
              Please upload your identity documents. You will be redirected to the document upload page.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
              Required documents: Government-issued ID, Proof of address
          </Alert>
        </Box>
      );

    case 3:
      return (
        <Box>
          <Typography variant="h6" gutterBottom>
              Review Your Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2">Personal Information</Typography>
              <Typography variant="body2">
                {personalInfo.firstName} {personalInfo.lastName}
              </Typography>
              <Typography variant="body2">
                  DOB: {personalInfo.dateOfBirth}
              </Typography>
              <Typography variant="body2">
                  Nationality: {personalInfo.nationality}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2">Address</Typography>
              <Typography variant="body2">
                {addressInfo.street}
              </Typography>
              <Typography variant="body2">
                {addressInfo.city}, {addressInfo.state} {addressInfo.postalCode}
              </Typography>
              <Typography variant="body2">
                {addressInfo.country}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      );

    default:
      return 'Unknown step';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <VerifiedUser />
        KYC Verification
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Verification Status</Typography>
            <Chip
              icon={getStatusIcon(kycStatus)}
              label={kycStatus.replace('_', ' ').toUpperCase()}
              color={getStatusColor(kycStatus)}
            />
          </Box>

          {kycStatus === 'in_progress' && (
            <LinearProgress variant="determinate" value={(activeStep / steps.length) * 100} />
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box sx={{ mb: 4 }}>
            {renderStepContent(activeStep)}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              Back
            </Button>

            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Saving...' : activeStep === steps.length - 1 ? 'Submit' : 'Next'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default KYCVerification;

import React, { useState, useEffect, useRef } from 'react';
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
  FormHelperText,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Stack,
  Avatar
} from '@mui/material';
import {
  VerifiedUser as VerifiedUserIcon,
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  Delete as DeleteIcon,
  PhotoCamera as PhotoCameraIcon
} from '@mui/icons-material';
import { submitKYC, getKYCStatus, clearError, clearMessage } from '../store/slices/kycSlice';
import PageTitle from '../components/common/PageTitle';
import LoadingSpinner from '../components/common/LoadingSpinner';

const KYC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [kycData, setKycData] = useState({
    verificationType: 'identity',
    documentType: '',
    documentNumber: '',
    documentExpiryDate: '',
    documentFrontImage: null,
    documentBackImage: null,
    selfieImage: null
  });
  const [formErrors, setFormErrors] = useState({});
  const [previewUrls, setPreviewUrls] = useState({
    documentFrontImage: null,
    documentBackImage: null,
    selfieImage: null
  });
  
  // Refs for file inputs
  const documentFrontRef = useRef(null);
  const documentBackRef = useRef(null);
  const selfieRef = useRef(null);

  const dispatch = useDispatch();
  const { kycStatus, verificationId, submittedAt, verifiedAt, rejectionReason, loading, error, message } = useSelector((state) => state.kyc);

  // Fetch KYC status on component mount
  useEffect(() => {
    dispatch(getKYCStatus());
    
    // Clean up preview URLs on unmount
    return () => {
      Object.values(previewUrls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [dispatch]);

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setKycData({
      ...kycData,
      [name]: value
    });
  };

  // Handle date change
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setKycData({
      ...kycData,
      [name]: value
    });
  };

  // Handle file change
  const handleFileChange = (e) => {
    const { name, files } = e.target;
    
    if (files && files[0]) {
      // Revoke previous URL if exists
      if (previewUrls[name]) {
        URL.revokeObjectURL(previewUrls[name]);
      }
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(files[0]);
      
      setKycData({
        ...kycData,
        [name]: files[0]
      });
      
      setPreviewUrls({
        ...previewUrls,
        [name]: previewUrl
      });
      
      // Clear error for this field if exists
      if (formErrors[name]) {
        setFormErrors({
          ...formErrors,
          [name]: null
        });
      }
    }
  };

  // Handle file delete
  const handleFileDelete = (name) => {
    // Revoke URL
    if (previewUrls[name]) {
      URL.revokeObjectURL(previewUrls[name]);
    }
    
    setKycData({
      ...kycData,
      [name]: null
    });
    
    setPreviewUrls({
      ...previewUrls,
      [name]: null
    });
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!kycData.documentType) {
      errors.documentType = 'Please select a document type';
    }
    
    if (!kycData.documentNumber) {
      errors.documentNumber = 'Document number is required';
    }
    
    if (!kycData.documentExpiryDate) {
      errors.documentExpiryDate = 'Expiry date is required';
    } else {
      const expiryDate = new Date(kycData.documentExpiryDate);
      const today = new Date();
      
      if (expiryDate < today) {
        errors.documentExpiryDate = 'Document has expired';
      }
    }
    
    if (!kycData.documentFrontImage) {
      errors.documentFrontImage = 'Front image of document is required';
    }
    
    if (kycData.documentType !== 'passport' && !kycData.documentBackImage) {
      errors.documentBackImage = 'Back image of document is required';
    }
    
    if (!kycData.selfieImage) {
      errors.selfieImage = 'Selfie image is required';
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
      handleSubmitKYC();
    }
  };

  // Handle back step
  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  // Handle submit KYC
  const handleSubmitKYC = () => {
    if (validateForm()) {
      // Create FormData
      const formData = new FormData();
      formData.append('verificationType', kycData.verificationType);
      formData.append('documentType', kycData.documentType);
      formData.append('documentNumber', kycData.documentNumber);
      formData.append('documentExpiryDate', kycData.documentExpiryDate);
      formData.append('documentFrontImage', kycData.documentFrontImage);
      
      if (kycData.documentBackImage) {
        formData.append('documentBackImage', kycData.documentBackImage);
      }
      
      formData.append('selfieImage', kycData.selfieImage);
      
      dispatch(submitKYC(formData))
        .unwrap()
        .then(() => {
          setActiveStep(2);
        })
        .catch((err) => {
          console.error('Error submitting KYC:', err);
        });
    }
  };

  // Get status chip
  const getStatusChip = (status) => {
    switch (status) {
      case 'verified':
        return <Chip size="small" label="Verified" color="success" icon={<CheckCircleIcon />} />;
      case 'pending':
        return <Chip size="small" label="Pending" color="warning" />;
      case 'rejected':
        return <Chip size="small" label="Rejected" color="error" />;
      case 'not_submitted':
        return <Chip size="small" label="Not Submitted" color="default" />;
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
              Document Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="verification-type-label">Verification Type</InputLabel>
                  <Select
                    labelId="verification-type-label"
                    name="verificationType"
                    value={kycData.verificationType}
                    onChange={handleChange}
                    label="Verification Type"
                    disabled={loading}
                  >
                    <MenuItem value="identity">Identity Verification</MenuItem>
                    <MenuItem value="address">Address Verification</MenuItem>
                    <MenuItem value="both">Both Identity & Address</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth error={!!formErrors.documentType}>
                  <InputLabel id="document-type-label">Document Type</InputLabel>
                  <Select
                    labelId="document-type-label"
                    name="documentType"
                    value={kycData.documentType}
                    onChange={handleChange}
                    label="Document Type"
                    disabled={loading}
                    required
                  >
                    <MenuItem value="passport">Passport</MenuItem>
                    <MenuItem value="national_id">National ID Card</MenuItem>
                    <MenuItem value="drivers_license">Driver's License</MenuItem>
                  </Select>
                  {formErrors.documentType && (
                    <FormHelperText>{formErrors.documentType}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Document Number"
                  name="documentNumber"
                  fullWidth
                  value={kycData.documentNumber}
                  onChange={handleChange}
                  error={!!formErrors.documentNumber}
                  helperText={formErrors.documentNumber}
                  disabled={loading}
                  required
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Document Expiry Date"
                  name="documentExpiryDate"
                  type="date"
                  fullWidth
                  value={kycData.documentExpiryDate}
                  onChange={handleDateChange}
                  error={!!formErrors.documentExpiryDate}
                  helperText={formErrors.documentExpiryDate || 'MM/DD/YYYY'}
                  disabled={loading}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Document Front Image
                </Typography>
                
                {previewUrls.documentFrontImage ? (
                  <Box sx={{ position: 'relative', mb: 2 }}>
                    <img
                      src={previewUrls.documentFrontImage}
                      alt="Document Front"
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }}
                    />
                    <IconButton
                      sx={{ position: 'absolute', top: 0, right: 0, bgcolor: 'background.paper' }}
                      onClick={() => handleFileDelete('documentFrontImage')}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ) : (
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    startIcon={<CloudUploadIcon />}
                    sx={{ py: 5, border: formErrors.documentFrontImage ? '1px solid red' : undefined }}
                  >
                    Upload Front Image
                    <input
                      ref={documentFrontRef}
                      type="file"
                      name="documentFrontImage"
                      accept="image/*"
                      hidden
                      onChange={handleFileChange}
                    />
                  </Button>
                )}
                
                {formErrors.documentFrontImage && (
                  <FormHelperText error>{formErrors.documentFrontImage}</FormHelperText>
                )}
                
                <FormHelperText>
                  Upload a clear image of the front of your {kycData.documentType === 'passport' ? 'passport' : kycData.documentType === 'national_id' ? 'national ID card' : 'driver\'s license'}.
                </FormHelperText>
              </Grid>
              
              {kycData.documentType !== 'passport' && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Document Back Image
                  </Typography>
                  
                  {previewUrls.documentBackImage ? (
                    <Box sx={{ position: 'relative', mb: 2 }}>
                      <img
                        src={previewUrls.documentBackImage}
                        alt="Document Back"
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }}
                      />
                      <IconButton
                        sx={{ position: 'absolute', top: 0, right: 0, bgcolor: 'background.paper' }}
                        onClick={() => handleFileDelete('documentBackImage')}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ) : (
                    <Button
                      variant="outlined"
                      component="label"
                      fullWidth
                      startIcon={<CloudUploadIcon />}
                      sx={{ py: 5, border: formErrors.documentBackImage ? '1px solid red' : undefined }}
                    >
                      Upload Back Image
                      <input
                        ref={documentBackRef}
                        type="file"
                        name="documentBackImage"
                        accept="image/*"
                        hidden
                        onChange={handleFileChange}
                      />
                    </Button>
                  )}
                  
                  {formErrors.documentBackImage && (
                    <FormHelperText error>{formErrors.documentBackImage}</FormHelperText>
                  )}
                  
                  <FormHelperText>
                    Upload a clear image of the back of your {kycData.documentType === 'national_id' ? 'national ID card' : 'driver\'s license'}.
                  </FormHelperText>
                </Grid>
              )}
              
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Selfie with Document
                </Typography>
                
                {previewUrls.selfieImage ? (
                  <Box sx={{ position: 'relative', mb: 2 }}>
                    <img
                      src={previewUrls.selfieImage}
                      alt="Selfie"
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }}
                    />
                    <IconButton
                      sx={{ position: 'absolute', top: 0, right: 0, bgcolor: 'background.paper' }}
                      onClick={() => handleFileDelete('selfieImage')}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ) : (
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    startIcon={<PhotoCameraIcon />}
                    sx={{ py: 5, border: formErrors.selfieImage ? '1px solid red' : undefined }}
                  >
                    Upload Selfie
                    <input
                      ref={selfieRef}
                      type="file"
                      name="selfieImage"
                      accept="image/*"
                      hidden
                      onChange={handleFileChange}
                    />
                  </Button>
                )}
                
                {formErrors.selfieImage && (
                  <FormHelperText error>{formErrors.selfieImage}</FormHelperText>
                )}
                
                <FormHelperText>
                  Upload a clear selfie of yourself holding your ID document. Your face and the document should be clearly visible.
                </FormHelperText>
              </Grid>
            </Grid>
          </Box>
        );
      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review and Submit
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              Please review your information before submitting. Once submitted, you cannot make changes until the verification process is complete.
            </Alert>
            
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Verification Type
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {kycData.verificationType === 'identity' ? 'Identity Verification' : 
                       kycData.verificationType === 'address' ? 'Address Verification' : 
                       'Both Identity & Address'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Document Type
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {kycData.documentType === 'passport' ? 'Passport' : 
                       kycData.documentType === 'national_id' ? 'National ID Card' : 
                       'Driver\'s License'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Document Number
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {kycData.documentNumber}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Document Expiry Date
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {new Date(kycData.documentExpiryDate).toLocaleDateString()}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      Uploaded Documents
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Document Front
                            </Typography>
                            {previewUrls.documentFrontImage && (
                              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                <img
                                  src={previewUrls.documentFrontImage}
                                  alt="Document Front"
                                  style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'contain' }}
                                />
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      {kycData.documentType !== 'passport' && previewUrls.documentBackImage && (
                        <Grid item xs={12} sm={4}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Document Back
                              </Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                <img
                                  src={previewUrls.documentBackImage}
                                  alt="Document Back"
                                  style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'contain' }}
                                />
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      )}
                      
                      <Grid item xs={12} sm={4}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Selfie with Document
                            </Typography>
                            {previewUrls.selfieImage && (
                              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                <img
                                  src={previewUrls.selfieImage}
                                  alt="Selfie"
                                  style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'contain' }}
                                />
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            
            <Typography variant="body2" color="text.secondary">
              By clicking "Submit Verification", you confirm that all information provided is accurate and authentic. Submitting false information may result in account restrictions.
            </Typography>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
            
            <Typography variant="h5" gutterBottom>
              Verification Submitted Successfully!
            </Typography>
            
            <Typography variant="body1" paragraph>
              Your KYC verification has been submitted and is now pending review.
            </Typography>
            
            <Card variant="outlined" sx={{ mb: 3, mt: 3, textAlign: 'left' }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Verification ID
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {verificationId || '-'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    {getStatusChip(kycStatus)}
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Divider />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Submitted At
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {submittedAt ? new Date(submittedAt).toLocaleString() : new Date().toLocaleString()}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Estimated Review Time
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      24-48 hours
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            
            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                • Your verification is being reviewed by our team.
              </Typography>
              <Typography variant="body2">
                • You will receive a notification once the verification is complete.
              </Typography>
              <Typography variant="body2">
                • You can check the status of your verification on this page.
              </Typography>
            </Alert>
            
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                component="a"
                href="/dashboard"
              >
                Back to Dashboard
              </Button>
            </Box>
          </Box>
        );
      default:
        return 'Unknown step';
    }
  };

  // Render KYC status page if already submitted
  const renderKYCStatus = () => {
    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          {kycStatus === 'verified' ? (
            <VerifiedUserIcon color="success" sx={{ fontSize: 64 }} />
          ) : kycStatus === 'rejected' ? (
            <Alert severity="error" icon={false} sx={{ justifyContent: 'center', mb: 2 }}>
              <Typography variant="h6">Verification Rejected</Typography>
            </Alert>
          ) : (
            <CircularProgress />
          )}
          
          <Typography variant="h5" sx={{ mt: 2 }}>
            {kycStatus === 'verified' ? 'Verification Approved' : 
             kycStatus === 'rejected' ? 'Verification Rejected' : 
             'Verification In Progress'}
          </Typography>
        </Box>
        
        <Card variant="outlined">
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Verification ID
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {verificationId || '-'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Box>
                  {getStatusChip(kycStatus)}
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Divider />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Submitted At
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {submittedAt ? new Date(submittedAt).toLocaleString() : '-'}
                </Typography>
              </Grid>
              
              {verifiedAt && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Verified At
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {new Date(verifiedAt).toLocaleString()}
                  </Typography>
                </Grid>
              )}
              
              {kycStatus === 'rejected' && rejectionReason && (
                <Grid item xs={12}>
                  <Alert severity="error" sx={{ mt: 1 }}>
                    <Typography variant="subtitle2">Rejection Reason:</Typography>
                    <Typography variant="body2">{rejectionReason}</Typography>
                  </Alert>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
        
        {kycStatus === 'rejected' && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                dispatch(clearError());
                dispatch(clearMessage());
                setActiveStep(0);
              }}
            >
              Submit New Verification
            </Button>
          </Box>
        )}
        
        {kycStatus === 'pending' && (
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              Your verification is being reviewed by our team. This process typically takes 24-48 hours.
              You will receive a notification once the verification is complete.
            </Typography>
          </Alert>
        )}
        
        {kycStatus === 'verified' && (
          <Alert severity="success" sx={{ mt: 3 }}>
            <Typography variant="body2">
              Your identity has been verified. You now have access to all features of the platform,
              including higher transaction limits and cash out options.
            </Typography>
          </Alert>
        )}
      </Paper>
    );
  };

  return (
    <>
      <PageTitle title="KYC Verification" />
      
      {loading && !kycStatus && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <LoadingSpinner />
        </Box>
      )}
      
      {!loading && kycStatus && kycStatus !== 'not_submitted' ? (
        renderKYCStatus()
      ) : (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              <Step>
                <StepLabel>Document Information</StepLabel>
              </Step>
              <Step>
                <StepLabel>Review & Submit</StepLabel>
              </Step>
              <Step>
                <StepLabel>Verification Submitted</StepLabel>
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
                    endIcon={activeStep === 1 ? <VerifiedUserIcon /> : <ArrowForwardIcon />}
                  >
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : activeStep === 1 ? (
                      'Submit Verification'
                    ) : (
                      'Next'
                    )}
                  </Button>
                )}
              </Box>
            </Box>
          </Paper>
          
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              About KYC Verification
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body1" paragraph>
              KYC (Know Your Customer) verification is a mandatory process to verify your identity and comply with regulatory requirements.
            </Typography>
            
            <Typography variant="body1" paragraph>
              Completing KYC verification provides you with the following benefits:
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Higher Limits
                    </Typography>
                    <Typography variant="body2">
                      Increase your daily and monthly transaction limits for money generation and cash outs.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Full Access
                    </Typography>
                    <Typography variant="body2">
                      Gain access to all payment providers and platform features.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Enhanced Security
                    </Typography>
                    <Typography variant="body2">
                      Protect your account and transactions with verified identity.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            <Typography variant="body2" color="text.secondary">
              Your personal information is securely stored and protected in compliance with data protection regulations.
            </Typography>
          </Paper>
        </>
      )}
    </>
  );
};

export default KYC;
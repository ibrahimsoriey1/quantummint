import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  TextField,
  Grid,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  MenuItem,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Person as PersonIcon,
  Home as HomeIcon,
  VerifiedUser as VerifiedUserIcon,
  Description as DescriptionIcon,
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import kycService from '../services/kycService';

const steps = [
  'Personal Information',
  'Address Information',
  'Identity Verification',
  'Document Upload',
  'Review & Submit',
];

const documentTypes = [
  { id: 'passport', name: 'Passport' },
  { id: 'drivers_license', name: 'Driver\'s License' },
  { id: 'national_id', name: 'National ID Card' },
  { id: 'utility_bill', name: 'Utility Bill' },
  { id: 'bank_statement', name: 'Bank Statement' },
];

const KYCVerification = () => {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kycProfile, setKycProfile] = useState(null);
  const [kycStatus, setKycStatus] = useState('not_submitted');
  const [documents, setDocuments] = useState([]);
  const [requiredDocuments, setRequiredDocuments] = useState([]);
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  useEffect(() => {
    fetchKycData();
  }, []);

  const fetchKycData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch KYC profile
      const profileResponse = await kycService.getKycProfile();
      setKycProfile(profileResponse.profile);
      
      // Fetch KYC status
      const statusResponse = await kycService.getKycStatus();
      setKycStatus(statusResponse.status);
      
      // Fetch documents
      const documentsResponse = await kycService.getAllDocuments();
      setDocuments(documentsResponse.documents);
      
      // Fetch required documents
      const requiredDocsResponse = await kycService.getRequiredDocuments();
      setRequiredDocuments(requiredDocsResponse.requiredDocuments);
      
      // Fetch verification history
      const historyResponse = await kycService.getVerificationHistory();
      setVerificationHistory(historyResponse.history);
      
      // Set active step based on profile completion
      if (statusResponse.status === 'approved' || statusResponse.status === 'pending') {
        setActiveStep(steps.length);
      } else if (profileResponse.profile) {
        // If profile exists but not submitted, set step to document upload
        setActiveStep(3);
      }
    } catch (error) {
      console.error('Error fetching KYC data:', error);
      setError('Failed to load KYC data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUploadDocument = async (documentType) => {
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    try {
      setUploadingDocument(true);
      setError('');
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prevProgress) => {
          const newProgress = prevProgress + 10;
          if (newProgress >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return newProgress;
        });
      }, 300);
      
      // Upload document
      await kycService.uploadDocument(documentType, selectedFile);
      
      // Fetch updated documents
      const documentsResponse = await kycService.getAllDocuments();
      setDocuments(documentsResponse.documents);
      
      // Reset file and progress
      setSelectedFile(null);
      setUploadProgress(0);
      
      // Clear file input
      document.getElementById('document-upload').value = '';
    } catch (error) {
      console.error('Error uploading document:', error);
      setError('Failed to upload document. Please try again.');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    try {
      setLoading(true);
      setError('');
      
      await kycService.deleteDocument(documentId);
      
      // Fetch updated documents
      const documentsResponse = await kycService.getAllDocuments();
      setDocuments(documentsResponse.documents);
    } catch (error) {
      console.error('Error deleting document:', error);
      setError('Failed to delete document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitVerification = async () => {
    try {
      setLoading(true);
      setError('');
      
      await kycService.submitKycVerification();
      
      // Fetch updated status
      const statusResponse = await kycService.getKycStatus();
      setKycStatus(statusResponse.status);
      
      // Move to final step
      setActiveStep(steps.length);
    } catch (error) {
      console.error('Error submitting verification:', error);
      setError('Failed to submit verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Personal Information Form
  const personalInfoSchema = Yup.object({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    dateOfBirth: Yup.date()
      .required('Date of birth is required')
      .max(new Date(new Date().setFullYear(new Date().getFullYear() - 18)), 'You must be at least 18 years old'),
    nationality: Yup.string().required('Nationality is required'),
    gender: Yup.string().required('Gender is required'),
    phoneNumber: Yup.string().required('Phone number is required'),
  });

  const personalInfoFormik = useFormik({
    initialValues: {
      firstName: kycProfile?.firstName || user?.firstName || '',
      lastName: kycProfile?.lastName || user?.lastName || '',
      dateOfBirth: kycProfile?.dateOfBirth ? new Date(kycProfile.dateOfBirth) : null,
      nationality: kycProfile?.nationality || '',
      gender: kycProfile?.gender || '',
      phoneNumber: kycProfile?.phoneNumber || user?.phoneNumber || '',
    },
    validationSchema: personalInfoSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');
        
        await kycService.updateKycProfile({
          ...values,
          dateOfBirth: values.dateOfBirth.toISOString(),
        });
        
        // Fetch updated profile
        const profileResponse = await kycService.getKycProfile();
        setKycProfile(profileResponse.profile);
        
        handleNext();
      } catch (error) {
        console.error('Error updating personal information:', error);
        setError('Failed to update personal information. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  // Address Information Form
  const addressInfoSchema = Yup.object({
    addressLine1: Yup.string().required('Address line 1 is required'),
    addressLine2: Yup.string(),
    city: Yup.string().required('City is required'),
    state: Yup.string().required('State/Province is required'),
    postalCode: Yup.string().required('Postal code is required'),
    country: Yup.string().required('Country is required'),
  });

  const addressInfoFormik = useFormik({
    initialValues: {
      addressLine1: kycProfile?.addressLine1 || '',
      addressLine2: kycProfile?.addressLine2 || '',
      city: kycProfile?.city || '',
      state: kycProfile?.state || '',
      postalCode: kycProfile?.postalCode || '',
      country: kycProfile?.country || '',
    },
    validationSchema: addressInfoSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');
        
        await kycService.updateKycProfile({
          ...values,
        });
        
        // Fetch updated profile
        const profileResponse = await kycService.getKycProfile();
        setKycProfile(profileResponse.profile);
        
        handleNext();
      } catch (error) {
        console.error('Error updating address information:', error);
        setError('Failed to update address information. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  // Identity Verification Form
  const identityVerificationSchema = Yup.object({
    idType: Yup.string().required('ID type is required'),
    idNumber: Yup.string().required('ID number is required'),
    idIssueDate: Yup.date().required('Issue date is required'),
    idExpiryDate: Yup.date()
      .required('Expiry date is required')
      .min(new Date(), 'ID must not be expired'),
    idIssuingCountry: Yup.string().required('Issuing country is required'),
  });

  const identityVerificationFormik = useFormik({
    initialValues: {
      idType: kycProfile?.idType || '',
      idNumber: kycProfile?.idNumber || '',
      idIssueDate: kycProfile?.idIssueDate ? new Date(kycProfile.idIssueDate) : null,
      idExpiryDate: kycProfile?.idExpiryDate ? new Date(kycProfile.idExpiryDate) : null,
      idIssuingCountry: kycProfile?.idIssuingCountry || '',
    },
    validationSchema: identityVerificationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');
        
        await kycService.updateKycProfile({
          ...values,
          idIssueDate: values.idIssueDate.toISOString(),
          idExpiryDate: values.idExpiryDate.toISOString(),
        });
        
        // Fetch updated profile
        const profileResponse = await kycService.getKycProfile();
        setKycProfile(profileResponse.profile);
        
        handleNext();
      } catch (error) {
        console.error('Error updating identity information:', error);
        setError('Failed to update identity information. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon color="success" />;
      case 'rejected':
        return <ErrorIcon color="error" />;
      case 'pending':
        return <PendingIcon color="warning" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const renderPersonalInfoForm = () => (
    <form onSubmit={personalInfoFormik.handleSubmit}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="firstName"
            name="firstName"
            label="First Name"
            value={personalInfoFormik.values.firstName}
            onChange={personalInfoFormik.handleChange}
            onBlur={personalInfoFormik.handleBlur}
            error={personalInfoFormik.touched.firstName && Boolean(personalInfoFormik.errors.firstName)}
            helperText={personalInfoFormik.touched.firstName && personalInfoFormik.errors.firstName}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="lastName"
            name="lastName"
            label="Last Name"
            value={personalInfoFormik.values.lastName}
            onChange={personalInfoFormik.handleChange}
            onBlur={personalInfoFormik.handleBlur}
            error={personalInfoFormik.touched.lastName && Boolean(personalInfoFormik.errors.lastName)}
            helperText={personalInfoFormik.touched.lastName && personalInfoFormik.errors.lastName}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Date of Birth"
              value={personalInfoFormik.values.dateOfBirth}
              onChange={(date) => personalInfoFormik.setFieldValue('dateOfBirth', date)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  margin="normal"
                  error={personalInfoFormik.touched.dateOfBirth && Boolean(personalInfoFormik.errors.dateOfBirth)}
                  helperText={personalInfoFormik.touched.dateOfBirth && personalInfoFormik.errors.dateOfBirth}
                />
              )}
            />
          </LocalizationProvider>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="nationality"
            name="nationality"
            label="Nationality"
            value={personalInfoFormik.values.nationality}
            onChange={personalInfoFormik.handleChange}
            onBlur={personalInfoFormik.handleBlur}
            error={personalInfoFormik.touched.nationality && Boolean(personalInfoFormik.errors.nationality)}
            helperText={personalInfoFormik.touched.nationality && personalInfoFormik.errors.nationality}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl component="fieldset" margin="normal">
            <FormLabel component="legend">Gender</FormLabel>
            <RadioGroup
              row
              name="gender"
              value={personalInfoFormik.values.gender}
              onChange={personalInfoFormik.handleChange}
            >
              <FormControlLabel value="male" control={<Radio />} label="Male" />
              <FormControlLabel value="female" control={<Radio />} label="Female" />
              <FormControlLabel value="other" control={<Radio />} label="Other" />
            </RadioGroup>
            {personalInfoFormik.touched.gender && personalInfoFormik.errors.gender && (
              <Typography color="error" variant="caption">
                {personalInfoFormik.errors.gender}
              </Typography>
            )}
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="phoneNumber"
            name="phoneNumber"
            label="Phone Number"
            value={personalInfoFormik.values.phoneNumber}
            onChange={personalInfoFormik.handleChange}
            onBlur={personalInfoFormik.handleBlur}
            error={personalInfoFormik.touched.phoneNumber && Boolean(personalInfoFormik.errors.phoneNumber)}
            helperText={personalInfoFormik.touched.phoneNumber && personalInfoFormik.errors.phoneNumber}
            margin="normal"
          />
        </Grid>
      </Grid>

      <Box sx={{ mb: 2, mt: 2 }}>
        <Button
          variant="contained"
          type="submit"
          disabled={loading || !personalInfoFormik.isValid}
          sx={{ mt: 1, mr: 1 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Continue'}
        </Button>
      </Box>
    </form>
  );

  const renderAddressInfoForm = () => (
    <form onSubmit={addressInfoFormik.handleSubmit}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            id="addressLine1"
            name="addressLine1"
            label="Address Line 1"
            value={addressInfoFormik.values.addressLine1}
            onChange={addressInfoFormik.handleChange}
            onBlur={addressInfoFormik.handleBlur}
            error={addressInfoFormik.touched.addressLine1 && Boolean(addressInfoFormik.errors.addressLine1)}
            helperText={addressInfoFormik.touched.addressLine1 && addressInfoFormik.errors.addressLine1}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            id="addressLine2"
            name="addressLine2"
            label="Address Line 2 (Optional)"
            value={addressInfoFormik.values.addressLine2}
            onChange={addressInfoFormik.handleChange}
            onBlur={addressInfoFormik.handleBlur}
            error={addressInfoFormik.touched.addressLine2 && Boolean(addressInfoFormik.errors.addressLine2)}
            helperText={addressInfoFormik.touched.addressLine2 && addressInfoFormik.errors.addressLine2}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="city"
            name="city"
            label="City"
            value={addressInfoFormik.values.city}
            onChange={addressInfoFormik.handleChange}
            onBlur={addressInfoFormik.handleBlur}
            error={addressInfoFormik.touched.city && Boolean(addressInfoFormik.errors.city)}
            helperText={addressInfoFormik.touched.city && addressInfoFormik.errors.city}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="state"
            name="state"
            label="State/Province"
            value={addressInfoFormik.values.state}
            onChange={addressInfoFormik.handleChange}
            onBlur={addressInfoFormik.handleBlur}
            error={addressInfoFormik.touched.state && Boolean(addressInfoFormik.errors.state)}
            helperText={addressInfoFormik.touched.state && addressInfoFormik.errors.state}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="postalCode"
            name="postalCode"
            label="Postal Code"
            value={addressInfoFormik.values.postalCode}
            onChange={addressInfoFormik.handleChange}
            onBlur={addressInfoFormik.handleBlur}
            error={addressInfoFormik.touched.postalCode && Boolean(addressInfoFormik.errors.postalCode)}
            helperText={addressInfoFormik.touched.postalCode && addressInfoFormik.errors.postalCode}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="country"
            name="country"
            label="Country"
            value={addressInfoFormik.values.country}
            onChange={addressInfoFormik.handleChange}
            onBlur={addressInfoFormik.handleBlur}
            error={addressInfoFormik.touched.country && Boolean(addressInfoFormik.errors.country)}
            helperText={addressInfoFormik.touched.country && addressInfoFormik.errors.country}
            margin="normal"
          />
        </Grid>
      </Grid>

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
          type="submit"
          disabled={loading || !addressInfoFormik.isValid}
          sx={{ mt: 1, mr: 1 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Continue'}
        </Button>
      </Box>
    </form>
  );

  const renderIdentityVerificationForm = () => (
    <form onSubmit={identityVerificationFormik.handleSubmit}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            select
            id="idType"
            name="idType"
            label="ID Type"
            value={identityVerificationFormik.values.idType}
            onChange={identityVerificationFormik.handleChange}
            onBlur={identityVerificationFormik.handleBlur}
            error={identityVerificationFormik.touched.idType && Boolean(identityVerificationFormik.errors.idType)}
            helperText={identityVerificationFormik.touched.idType && identityVerificationFormik.errors.idType}
            margin="normal"
          >
            <MenuItem value="passport">Passport</MenuItem>
            <MenuItem value="drivers_license">Driver's License</MenuItem>
            <MenuItem value="national_id">National ID Card</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="idNumber"
            name="idNumber"
            label="ID Number"
            value={identityVerificationFormik.values.idNumber}
            onChange={identityVerificationFormik.handleChange}
            onBlur={identityVerificationFormik.handleBlur}
            error={identityVerificationFormik.touched.idNumber && Boolean(identityVerificationFormik.errors.idNumber)}
            helperText={identityVerificationFormik.touched.idNumber && identityVerificationFormik.errors.idNumber}
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Issue Date"
              value={identityVerificationFormik.values.idIssueDate}
              onChange={(date) => identityVerificationFormik.setFieldValue('idIssueDate', date)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  margin="normal"
                  error={identityVerificationFormik.touched.idIssueDate && Boolean(identityVerificationFormik.errors.idIssueDate)}
                  helperText={identityVerificationFormik.touched.idIssueDate && identityVerificationFormik.errors.idIssueDate}
                />
              )}
            />
          </LocalizationProvider>
        </Grid>
        <Grid item xs={12} sm={6}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Expiry Date"
              value={identityVerificationFormik.values.idExpiryDate}
              onChange={(date) => identityVerificationFormik.setFieldValue('idExpiryDate', date)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  margin="normal"
                  error={identityVerificationFormik.touched.idExpiryDate && Boolean(identityVerificationFormik.errors.idExpiryDate)}
                  helperText={identityVerificationFormik.touched.idExpiryDate && identityVerificationFormik.errors.idExpiryDate}
                />
              )}
            />
          </LocalizationProvider>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            id="idIssuingCountry"
            name="idIssuingCountry"
            label="Issuing Country"
            value={identityVerificationFormik.values.idIssuingCountry}
            onChange={identityVerificationFormik.handleChange}
            onBlur={identityVerificationFormik.handleBlur}
            error={identityVerificationFormik.touched.idIssuingCountry && Boolean(identityVerificationFormik.errors.idIssuingCountry)}
            helperText={identityVerificationFormik.touched.idIssuingCountry && identityVerificationFormik.errors.idIssuingCountry}
            margin="normal"
          />
        </Grid>
      </Grid>

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
          type="submit"
          disabled={loading || !identityVerificationFormik.isValid}
          sx={{ mt: 1, mr: 1 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Continue'}
        </Button>
      </Box>
    </form>
  );

  const renderDocumentUpload = () => (
    <Box>
      <Typography variant="body1" paragraph>
        Please upload the following required documents:
      </Typography>

      <List>
        {requiredDocuments.map((docType) => {
          const isUploaded = documents.some(doc => doc.documentType === docType.id);
          
          return (
            <ListItem key={docType.id}>
              <ListItemIcon>
                <DescriptionIcon />
              </ListItemIcon>
              <ListItemText
                primary={docType.name}
                secondary={docType.description}
              />
              {isUploaded ? (
                <Chip label="Uploaded" color="success" />
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  component="label"
                >
                  Select File
                  <input
                    type="file"
                    hidden
                    onChange={(e) => {
                      setSelectedFile(e.target.files[0]);
                      handleUploadDocument(docType.id);
                    }}
                  />
                </Button>
              )}
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" gutterBottom>
        Uploaded Documents
      </Typography>

      {documents.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No documents uploaded yet.
        </Typography>
      ) : (
        <List>
          {documents.map((doc) => (
            <ListItem key={doc.id}>
              <ListItemIcon>
                <DescriptionIcon />
              </ListItemIcon>
              <ListItemText
                primary={documentTypes.find(type => type.id === doc.documentType)?.name || doc.documentType}
                secondary={`Uploaded on ${new Date(doc.uploadedAt).toLocaleString()}`}
              />
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => handleDeleteDocument(doc.id)}
                disabled={uploadingDocument}
              >
                Delete
              </Button>
            </ListItem>
          ))}
        </List>
      )}

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
          onClick={handleNext}
          sx={{ mt: 1, mr: 1 }}
          disabled={documents.length === 0 || uploadingDocument}
        >
          {uploadingDocument ? <CircularProgress size={24} /> : 'Continue'}
        </Button>
      </Box>
    </Box>
  );

  const renderReviewAndSubmit = () => (
    <Box>
      <Typography variant="body1" paragraph>
        Please review your information before submitting for verification:
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Personal Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>Name:</strong> {kycProfile?.firstName} {kycProfile?.lastName}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>Date of Birth:</strong> {kycProfile?.dateOfBirth ? new Date(kycProfile.dateOfBirth).toLocaleDateString() : 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>Nationality:</strong> {kycProfile?.nationality || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>Gender:</strong> {kycProfile?.gender ? kycProfile.gender.charAt(0).toUpperCase() + kycProfile.gender.slice(1) : 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2">
                <strong>Phone Number:</strong> {kycProfile?.phoneNumber || 'N/A'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <HomeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Address Information
          </Typography>
          <Typography variant="body2">
            <strong>Address:</strong> {kycProfile?.addressLine1}
            {kycProfile?.addressLine2 && `, ${kycProfile.addressLine2}`}
          </Typography>
          <Typography variant="body2">
            <strong>City:</strong> {kycProfile?.city || 'N/A'}
          </Typography>
          <Typography variant="body2">
            <strong>State/Province:</strong> {kycProfile?.state || 'N/A'}
          </Typography>
          <Typography variant="body2">
            <strong>Postal Code:</strong> {kycProfile?.postalCode || 'N/A'}
          </Typography>
          <Typography variant="body2">
            <strong>Country:</strong> {kycProfile?.country || 'N/A'}
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <VerifiedUserIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Identity Information
          </Typography>
          <Typography variant="body2">
            <strong>ID Type:</strong> {kycProfile?.idType ? kycProfile.idType.replace('_', ' ').toUpperCase() : 'N/A'}
          </Typography>
          <Typography variant="body2">
            <strong>ID Number:</strong> {kycProfile?.idNumber || 'N/A'}
          </Typography>
          <Typography variant="body2">
            <strong>Issue Date:</strong> {kycProfile?.idIssueDate ? new Date(kycProfile.idIssueDate).toLocaleDateString() : 'N/A'}
          </Typography>
          <Typography variant="body2">
            <strong>Expiry Date:</strong> {kycProfile?.idExpiryDate ? new Date(kycProfile.idExpiryDate).toLocaleDateString() : 'N/A'}
          </Typography>
          <Typography variant="body2">
            <strong>Issuing Country:</strong> {kycProfile?.idIssuingCountry || 'N/A'}
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <CloudUploadIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Uploaded Documents
          </Typography>
          {documents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No documents uploaded yet.
            </Typography>
          ) : (
            <List dense>
              {documents.map((doc) => (
                <ListItem key={doc.id}>
                  <ListItemIcon>
                    <DescriptionIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={documentTypes.find(type => type.id === doc.documentType)?.name || doc.documentType}
                    secondary={`Uploaded on ${new Date(doc.uploadedAt).toLocaleString()}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

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
          onClick={handleSubmitVerification}
          sx={{ mt: 1, mr: 1 }}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Submit for Verification'}
        </Button>
      </Box>
    </Box>
  );

  const renderVerificationStatus = () => (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      {kycStatus === 'approved' ? (
        <>
          <CheckCircleIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Verification Approved!
          </Typography>
          <Typography variant="body1" paragraph>
            Your KYC verification has been approved. You now have full access to all features.
          </Typography>
        </>
      ) : kycStatus === 'pending' ? (
        <>
          <PendingIcon color="warning" sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Verification Pending
          </Typography>
          <Typography variant="body1" paragraph>
            Your KYC verification is currently being reviewed. This process typically takes 1-2 business days.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            We'll notify you once the verification is complete.
          </Typography>
        </>
      ) : kycStatus === 'rejected' ? (
        <>
          <ErrorIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Verification Rejected
          </Typography>
          <Typography variant="body1" paragraph>
            Unfortunately, your KYC verification was rejected. Please review the feedback below and resubmit.
          </Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            {verificationHistory.length > 0 && verificationHistory[0].rejectionReason}
          </Alert>
          <Button
            variant="contained"
            onClick={() => setActiveStep(0)}
          >
            Resubmit Verification
          </Button>
        </>
      ) : (
        <>
          <Typography variant="h5" gutterBottom>
            Verification Not Submitted
          </Typography>
          <Typography variant="body1" paragraph>
            Please complete the verification process to access all features.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setActiveStep(0)}
          >
            Start Verification
          </Button>
        </>
      )}
    </Box>
  );

  if (loading && !kycProfile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        KYC Verification
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            {activeStep === steps.length ? (
              renderVerificationStatus()
            ) : (
              <Stepper activeStep={activeStep} orientation="vertical">
                <Step>
                  <StepLabel>Personal Information</StepLabel>
                  <StepContent>
                    {renderPersonalInfoForm()}
                  </StepContent>
                </Step>
                <Step>
                  <StepLabel>Address Information</StepLabel>
                  <StepContent>
                    {renderAddressInfoForm()}
                  </StepContent>
                </Step>
                <Step>
                  <StepLabel>Identity Verification</StepLabel>
                  <StepContent>
                    {renderIdentityVerificationForm()}
                  </StepContent>
                </Step>
                <Step>
                  <StepLabel>Document Upload</StepLabel>
                  <StepContent>
                    {renderDocumentUpload()}
                  </StepContent>
                </Step>
                <Step>
                  <StepLabel>Review & Submit</StepLabel>
                  <StepContent>
                    {renderReviewAndSubmit()}
                  </StepContent>
                </Step>
              </Stepper>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Verification Status
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getStatusIcon(kycStatus)}
                <Typography 
                  variant="body1" 
                  sx={{ 
                    ml: 1, 
                    fontWeight: 'bold',
                    color: `${getStatusColor(kycStatus)}.main`,
                    textTransform: 'capitalize'
                  }}
                >
                  {kycStatus.replace('_', ' ')}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Verification Requirements
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <PersonIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Personal Information" 
                    secondary="Basic details like name, date of birth, etc."
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <HomeIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Address Information" 
                    secondary="Your current residential address"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <VerifiedUserIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Identity Verification" 
                    secondary="Government-issued ID details"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <DescriptionIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Document Upload" 
                    secondary="Clear photos or scans of required documents"
                  />
                </ListItem>
              </List>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                All information is encrypted and stored securely. Your privacy is our priority.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default KYCVerification;
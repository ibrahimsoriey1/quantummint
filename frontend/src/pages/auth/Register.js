import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Button,
  TextField,
  Typography,
  Link,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';

// Validation schemas
const AccountSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  confirmPassword: Yup.string()
    .required('Please confirm your password')
    .oneOf([Yup.ref('password'), null], 'Passwords must match'),
});

const PersonalInfoSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  phoneNumber: Yup.string().required('Phone number is required'),
  dateOfBirth: Yup.date()
    .required('Date of birth is required')
    .max(new Date(new Date().setFullYear(new Date().getFullYear() - 18)), 'You must be at least 18 years old'),
});

const TermsSchema = Yup.object().shape({
  acceptTerms: Yup.boolean()
    .required('You must accept the terms and conditions')
    .oneOf([true], 'You must accept the terms and conditions'),
  acceptPrivacyPolicy: Yup.boolean()
    .required('You must accept the privacy policy')
    .oneOf([true], 'You must accept the privacy policy'),
});

const steps = ['Account Information', 'Personal Information', 'Terms & Conditions'];

const Register = () => {
  const { register, isLoading } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerError, setRegisterError] = useState('');
  
  const initialValues = {
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    dateOfBirth: '',
    acceptTerms: false,
    acceptPrivacyPolicy: false,
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    if (activeStep < steps.length - 1) {
      handleNext();
      setSubmitting(false);
      return;
    }
    
    try {
      setRegisterError('');
      // Format date of birth to ISO string
      const formattedValues = {
        ...values,
        dateOfBirth: new Date(values.dateOfBirth).toISOString(),
      };
      
      // Remove confirmPassword and terms acceptance from the data sent to API
      const { confirmPassword, acceptTerms, acceptPrivacyPolicy, ...userData } = formattedValues;
      
      await register(userData);
    } catch (error) {
      setRegisterError(error.message || 'Registration failed. Please try again.');
      setSubmitting(false);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const getStepContent = (step, errors, touched, isSubmitting) => {
    switch (step) {
      case 0:
        return (
          <>
            <Field
              as={TextField}
              name="email"
              label="Email Address"
              variant="outlined"
              fullWidth
              margin="normal"
              error={touched.email && Boolean(errors.email)}
              helperText={touched.email && errors.email}
              disabled={isLoading || isSubmitting}
            />

            <Field
              as={TextField}
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              variant="outlined"
              fullWidth
              margin="normal"
              error={touched.password && Boolean(errors.password)}
              helperText={touched.password && errors.password}
              disabled={isLoading || isSubmitting}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePassword}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Field
              as={TextField}
              name="confirmPassword"
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              variant="outlined"
              fullWidth
              margin="normal"
              error={touched.confirmPassword && Boolean(errors.confirmPassword)}
              helperText={touched.confirmPassword && errors.confirmPassword}
              disabled={isLoading || isSubmitting}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle confirm password visibility"
                      onClick={handleToggleConfirmPassword}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </>
        );
      case 1:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                name="firstName"
                label="First Name"
                variant="outlined"
                fullWidth
                margin="normal"
                error={touched.firstName && Boolean(errors.firstName)}
                helperText={touched.firstName && errors.firstName}
                disabled={isLoading || isSubmitting}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field
                as={TextField}
                name="lastName"
                label="Last Name"
                variant="outlined"
                fullWidth
                margin="normal"
                error={touched.lastName && Boolean(errors.lastName)}
                helperText={touched.lastName && errors.lastName}
                disabled={isLoading || isSubmitting}
              />
            </Grid>
            <Grid item xs={12}>
              <Field
                as={TextField}
                name="phoneNumber"
                label="Phone Number"
                variant="outlined"
                fullWidth
                margin="normal"
                error={touched.phoneNumber && Boolean(errors.phoneNumber)}
                helperText={touched.phoneNumber && errors.phoneNumber}
                disabled={isLoading || isSubmitting}
              />
            </Grid>
            <Grid item xs={12}>
              <Field
                as={TextField}
                name="dateOfBirth"
                label="Date of Birth"
                type="date"
                variant="outlined"
                fullWidth
                margin="normal"
                InputLabelProps={{ shrink: true }}
                error={touched.dateOfBirth && Boolean(errors.dateOfBirth)}
                helperText={touched.dateOfBirth && errors.dateOfBirth}
                disabled={isLoading || isSubmitting}
              />
            </Grid>
          </Grid>
        );
      case 2:
        return (
          <>
            <Typography variant="body2" paragraph>
              Please read and accept our Terms and Conditions and Privacy Policy to complete your registration.
            </Typography>
            
            <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', p: 2, mb: 2 }}>
              <Typography variant="body2" paragraph>
                <strong>Terms and Conditions</strong>
              </Typography>
              <Typography variant="body2" paragraph>
                By using QuantumMint, you agree to be bound by these Terms and Conditions. QuantumMint provides a digital money generation service that allows users to create digital currency for educational and demonstration purposes only.
              </Typography>
              <Typography variant="body2" paragraph>
                The digital currency generated through QuantumMint has no real-world value and cannot be exchanged for legal tender. Users are prohibited from representing the digital currency as having real monetary value.
              </Typography>
              <Typography variant="body2" paragraph>
                QuantumMint reserves the right to suspend or terminate your account at any time for any reason, including but not limited to violation of these Terms and Conditions.
              </Typography>
            </Box>
            
            <FormControlLabel
              control={
                <Field
                  as={Checkbox}
                  name="acceptTerms"
                  color="primary"
                  disabled={isLoading || isSubmitting}
                />
              }
              label="I accept the Terms and Conditions"
            />
            {touched.acceptTerms && errors.acceptTerms && (
              <Typography color="error" variant="caption" display="block">
                {errors.acceptTerms}
              </Typography>
            )}
            
            <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', p: 2, my: 2 }}>
              <Typography variant="body2" paragraph>
                <strong>Privacy Policy</strong>
              </Typography>
              <Typography variant="body2" paragraph>
                QuantumMint collects personal information to provide and improve our services. This includes information you provide during registration, such as your name, email address, and date of birth.
              </Typography>
              <Typography variant="body2" paragraph>
                We use this information to create and maintain your account, provide customer support, and send you important updates about our services. We may also use your information to comply with legal obligations and prevent fraudulent activity.
              </Typography>
              <Typography variant="body2" paragraph>
                QuantumMint does not sell your personal information to third parties. We may share your information with service providers who help us operate our platform, but only as necessary to provide our services to you.
              </Typography>
            </Box>
            
            <FormControlLabel
              control={
                <Field
                  as={Checkbox}
                  name="acceptPrivacyPolicy"
                  color="primary"
                  disabled={isLoading || isSubmitting}
                />
              }
              label="I accept the Privacy Policy"
            />
            {touched.acceptPrivacyPolicy && errors.acceptPrivacyPolicy && (
              <Typography color="error" variant="caption" display="block">
                {errors.acceptPrivacyPolicy}
              </Typography>
            )}
          </>
        );
      default:
        return 'Unknown step';
    }
  };

  const getValidationSchema = (step) => {
    switch (step) {
      case 0:
        return AccountSchema;
      case 1:
        return PersonalInfoSchema;
      case 2:
        return TermsSchema;
      default:
        return Yup.object().shape({});
    }
  };

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom align="center">
        Create an Account
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
        Join QuantumMint to start generating digital money
      </Typography>

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {registerError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {registerError}
        </Alert>
      )}

      <Formik
        initialValues={initialValues}
        validationSchema={getValidationSchema(activeStep)}
        onSubmit={handleSubmit}
        validateOnMount={false}
      >
        {({ errors, touched, isSubmitting, validateForm }) => (
          <Form>
            {getStepContent(activeStep, errors, touched, isSubmitting)}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button
                disabled={activeStep === 0 || isLoading || isSubmitting}
                onClick={handleBack}
                variant="outlined"
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isLoading || isSubmitting}
                onClick={() => {
                  if (activeStep < steps.length - 1) {
                    validateForm().then(errors => {
                      if (Object.keys(errors).length === 0) {
                        handleNext();
                      }
                    });
                  }
                }}
              >
                {(isLoading || isSubmitting) ? (
                  <CircularProgress size={24} color="inherit" />
                ) : activeStep === steps.length - 1 ? (
                  'Register'
                ) : (
                  'Next'
                )}
              </Button>
            </Box>

            <Typography variant="body2" align="center" sx={{ mt: 3 }}>
              Already have an account?{' '}
              <Link component={RouterLink} to="/login" color="primary">
                Sign in
              </Link>
            </Typography>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default Register;
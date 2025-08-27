import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Typography,
  Alert,
  Paper,
  TextField,
  CircularProgress
} from '@mui/material';
import { verifyEmail, resendVerificationEmail, clearAuthError } from '../../store/slices/authSlice';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const VerifyEmail = () => {
  const [verificationCode, setVerificationCode] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [formError, setFormError] = useState('');
  
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { loading, error, isAuthenticated, verificationSuccess } = useSelector((state) => state.auth);
  
  // Get email from location state or localStorage
  const email = location.state?.email || localStorage.getItem('pendingVerificationEmail') || '';
  
  // Save email to localStorage for persistence
  useEffect(() => {
    if (email) {
      localStorage.setItem('pendingVerificationEmail', email);
    }
  }, [email]);
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  
  // Redirect after successful verification
  useEffect(() => {
    if (verificationSuccess) {
      localStorage.removeItem('pendingVerificationEmail');
      navigate('/login');
    }
  }, [verificationSuccess, navigate]);
  
  // Clear auth errors when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);
  
  // Handle countdown for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);
  
  const handleVerify = (e) => {
    e.preventDefault();
    
    if (!verificationCode.trim()) {
      setFormError('Verification code is required');
      return;
    }
    
    if (verificationCode.length !== 6) {
      setFormError('Verification code must be 6 digits');
      return;
    }
    
    setFormError('');
    dispatch(verifyEmail({ email, verificationCode }));
  };
  
  const handleResendCode = async () => {
    if (countdown > 0) return;
    
    setResendLoading(true);
    setResendSuccess(false);
    
    try {
      await dispatch(resendVerificationEmail({ email })).unwrap();
      setResendSuccess(true);
      setCountdown(60); // Start 60-second countdown
    } catch (err) {
      // Error is handled by the Redux slice
    } finally {
      setResendLoading(false);
    }
  };
  
  if (!email) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '450px',
          mx: 'auto',
          p: 3
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography variant="h5" component="h1" align="center" gutterBottom>
            Email Verification
          </Typography>
          
          <Alert severity="error" sx={{ mb: 3 }}>
            No email address found. Please go back to the registration page.
          </Alert>
          
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={() => navigate('/register')}
          >
            Back to Registration
          </Button>
        </Paper>
      </Box>
    );
  }
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '450px',
        mx: 'auto',
        p: 3
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
        <Typography variant="h5" component="h1" align="center" gutterBottom>
          Verify Your Email
        </Typography>
        
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3 }}>
          We've sent a verification code to <strong>{email}</strong>. Please enter the code below to verify your email address.
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {resendSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            A new verification code has been sent to your email.
          </Alert>
        )}
        
        <form onSubmit={handleVerify}>
          <TextField
            label="Verification Code"
            type="text"
            fullWidth
            margin="normal"
            value={verificationCode}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '');
              if (value.length <= 6) {
                setVerificationCode(value);
              }
            }}
            error={!!formError}
            helperText={formError}
            disabled={loading}
            placeholder="Enter 6-digit code"
            inputProps={{ maxLength: 6 }}
            required
          />
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 3, py: 1.5 }}
          >
            {loading ? <LoadingSpinner size={24} /> : 'Verify Email'}
          </Button>
        </form>
        
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Didn't receive the code?
          </Typography>
          
          <Button
            variant="text"
            color="primary"
            onClick={handleResendCode}
            disabled={resendLoading || countdown > 0}
            sx={{ textTransform: 'none' }}
          >
            {resendLoading ? (
              <CircularProgress size={16} sx={{ mr: 1 }} />
            ) : countdown > 0 ? (
              `Resend code (${countdown}s)`
            ) : (
              'Resend verification code'
            )}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default VerifyEmail;
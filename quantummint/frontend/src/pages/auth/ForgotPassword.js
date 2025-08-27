import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Paper,
  CircularProgress
} from '@mui/material';
import { forgotPassword, clearAuthError } from '../../store/slices/authSlice';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  
  const dispatch = useDispatch();
  const { loading, error, forgotPasswordSuccess } = useSelector((state) => state.auth);
  
  // Clear auth errors when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearAuthError());
    };
  }, [dispatch]);
  
  const validateForm = () => {
    if (!email) {
      setFormError('Email is required');
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setFormError('Email is invalid');
      return false;
    }
    
    setFormError('');
    return true;
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      dispatch(forgotPassword({ email }));
      setSubmitted(true);
    }
  };
  
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
          Forgot Password
        </Typography>
        
        {!submitted || error ? (
          <>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Enter your email address and we'll send you a link to reset your password.
            </Typography>
            
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}
            
            <form onSubmit={handleSubmit}>
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!formError}
                helperText={formError}
                disabled={loading}
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
                {loading ? <LoadingSpinner size={24} /> : 'Send Reset Link'}
              </Button>
            </form>
          </>
        ) : (
          <>
            {forgotPasswordSuccess ? (
              <Alert severity="success" sx={{ mb: 3 }}>
                Password reset instructions have been sent to your email address.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                <CircularProgress />
              </Box>
            )}
            
            <Typography variant="body1" align="center" sx={{ mb: 3 }}>
              Please check your email inbox and follow the instructions to reset your password.
            </Typography>
          </>
        )}
        
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Remember your password?{' '}
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Typography variant="body2" component="span" color="primary" fontWeight="medium">
                Back to Login
              </Typography>
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default ForgotPassword;
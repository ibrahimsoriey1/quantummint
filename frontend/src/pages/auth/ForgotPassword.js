import React, { useState } from 'react';
import { Box, Typography, Paper, TextField, Button } from '@mui/material';
import api from '../../services/apiClient';
import { handleApiError } from '../../utils/errorHandler';
import { useFormValidation } from '../../hooks/useFormValidation';
import { forgotPasswordSchema } from '../../utils/validationSchemas';
import { useNotifications } from '../../contexts/NotificationContext';

const ForgotPassword = () => {
  const { showSuccess, showError } = useNotifications();
  const [loading, setLoading] = useState(false);
  
  const {
    values,
    isValid,
    resetForm,
    validateForm,
    getFieldProps
  } = useFormValidation(
    { email: '' },
    forgotPasswordSchema
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    
    const isFormValid = await validateForm();
    if (!isFormValid) return;
    
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: values.email });
      showSuccess('If that email exists, we sent a reset link.');
      resetForm();
    } catch (e) {
      const err = handleApiError(e);
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Forgot Password</Typography>
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={onSubmit}>
          <TextField 
            fullWidth 
            type="email" 
            label="Email" 
            {...getFieldProps('email')}
            sx={{ mb: 2 }} 
          />
          <Button 
            type="submit" 
            variant="contained" 
            disabled={loading || !isValid}
            fullWidth
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ForgotPassword;













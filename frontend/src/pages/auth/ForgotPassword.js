import React, { useState } from 'react';
import { Box, Typography, Paper, TextField, Button, Alert } from '@mui/material';
import api from '../../services/apiClient';
import { handleApiError } from '../../utils/errorHandler';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess('If that email exists, we sent a reset link.');
      setEmail('');
    } catch (e) {
      const err = handleApiError(e);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Forgot Password</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={onSubmit}>
          <TextField fullWidth type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} />
          <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Sending...' : 'Send Reset Link'}</Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ForgotPassword;













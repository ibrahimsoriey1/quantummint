import React, { useState } from 'react';
import { Box, Typography, Paper, TextField, Button, Alert } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/apiClient';
import { handleApiError } from '../../utils/errorHandler';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password: form.password });
      setSuccess('Password reset successfully. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (e) {
      const err = handleApiError(e);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Reset Password</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={onSubmit}>
          <TextField fullWidth type="password" name="password" label="New Password" value={form.password} onChange={onChange} sx={{ mb: 2 }} />
          <TextField fullWidth type="password" name="confirmPassword" label="Confirm Password" value={form.confirmPassword} onChange={onChange} sx={{ mb: 2 }} />
          <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ResetPassword;













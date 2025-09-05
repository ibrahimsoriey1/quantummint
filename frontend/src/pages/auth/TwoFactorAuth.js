import React, { useState } from 'react';
import { Box, Typography, Paper, Button, TextField, Alert } from '@mui/material';
import api from '../../services/apiClient';
import { handleApiError } from '../../utils/errorHandler';

const TwoFactorAuth = () => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [setup, setSetup] = useState({ secret: '', qrCodeUrl: '' });

  const generateSetup = async () => {
    setMessage(''); setError('');
    try {
      const { data } = await api.get('/2fa/setup');
      setSetup({ secret: data?.secret || data?.secretKey || '', qrCodeUrl: data?.qrCodeUrl || '' });
    } catch (e) {
      const err = handleApiError(e);
      setError(err.message);
    }
  };

  const enable = async () => {
    setMessage(''); setError('');
    try {
      const { data } = await api.post('/2fa/enable');
      setMessage(data?.message || '2FA enabled.');
    } catch (e) {
      const err = handleApiError(e);
      setError(err.message);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setMessage(''); setError('');
    try {
      const { data } = await api.post('/2fa/verify', { token });
      setMessage(data?.message || '2FA token verified.');
      setToken('');
    } catch (e) {
      const err = handleApiError(e);
      setError(err.message);
    }
  };

  const disable = async () => {
    setMessage(''); setError('');
    try {
      const { data } = await api.post('/2fa/disable');
      setMessage(data?.message || '2FA disabled.');
    } catch (e) {
      const err = handleApiError(e);
      setError(err.message);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Two-Factor Authentication</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Setup</Typography>
        <Button variant="outlined" onClick={generateSetup} sx={{ mr: 1 }}>Generate Setup</Button>
        <Button variant="outlined" onClick={enable}>Enable</Button>
        {setup.secret && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">Secret: {setup.secret}</Typography>
            {setup.qrCodeUrl && (
              <Box sx={{ mt: 1 }}>
                <img src={setup.qrCodeUrl} alt="2FA QR" />
              </Box>
            )}
          </Box>
        )}
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Verify Code</Typography>
        <Box component="form" onSubmit={verify} display="flex" gap={1}>
          <TextField label="6-digit code" value={token} onChange={(e) => setToken(e.target.value)} />
          <Button type="submit" variant="contained">Verify</Button>
          <Button color="error" variant="outlined" onClick={disable}>Disable</Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default TwoFactorAuth;













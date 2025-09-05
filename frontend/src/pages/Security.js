import React, { useState } from 'react';
import { Box, Typography, Paper, TextField, Grid, Button, Alert } from '@mui/material';
import api from '../services/apiClient';
import { handleApiError } from '../utils/errorHandler';

const Security = () => {
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdMsg, setPwdMsg] = useState({ error: '', success: '' });
  const [tfaMsg, setTfaMsg] = useState({ error: '', success: '' });
  const [tfaToken, setTfaToken] = useState('');

  const changePassword = async (e) => {
    e.preventDefault();
    setPwdMsg({ error: '', success: '' });
    if (pwd.newPassword !== pwd.confirmPassword) {
      setPwdMsg({ error: 'Passwords do not match', success: '' });
      return;
    }
    try {
      await api.put('/users/change-password', {
        currentPassword: pwd.currentPassword,
        newPassword: pwd.newPassword
      });
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwdMsg({ error: '', success: 'Password updated successfully.' });
    } catch (e) {
      const err = handleApiError(e);
      setPwdMsg({ error: err.message, success: '' });
    }
  };

  const enable2FA = async () => {
    setTfaMsg({ error: '', success: '' });
    try {
      const { data } = await api.post('/2fa/enable');
      setTfaMsg({ error: '', success: data?.message || 'Two-factor authentication enabled.' });
    } catch (e) {
      const err = handleApiError(e);
      setTfaMsg({ error: err.message, success: '' });
    }
  };

  const verify2FA = async (e) => {
    e.preventDefault();
    setTfaMsg({ error: '', success: '' });
    try {
      const { data } = await api.post('/2fa/verify', { token: tfaToken });
      setTfaMsg({ error: '', success: data?.message || 'Two-factor authentication verified.' });
      setTfaToken('');
    } catch (e) {
      const err = handleApiError(e);
      setTfaMsg({ error: err.message, success: '' });
    }
  };

  const disable2FA = async () => {
    setTfaMsg({ error: '', success: '' });
    try {
      const { data } = await api.post('/2fa/disable');
      setTfaMsg({ error: '', success: data?.message || 'Two-factor authentication disabled.' });
    } catch (e) {
      const err = handleApiError(e);
      setTfaMsg({ error: err.message, success: '' });
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Security</Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Change Password</Typography>
            {pwdMsg.error && <Alert severity="error" sx={{ mb: 2 }}>{pwdMsg.error}</Alert>}
            {pwdMsg.success && <Alert severity="success" sx={{ mb: 2 }}>{pwdMsg.success}</Alert>}
            <Box component="form" onSubmit={changePassword}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth type="password" label="Current Password" value={pwd.currentPassword} onChange={(e) => setPwd(p => ({ ...p, currentPassword: e.target.value }))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth type="password" label="New Password" value={pwd.newPassword} onChange={(e) => setPwd(p => ({ ...p, newPassword: e.target.value }))} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth type="password" label="Confirm Password" value={pwd.confirmPassword} onChange={(e) => setPwd(p => ({ ...p, confirmPassword: e.target.value }))} />
                </Grid>
                <Grid item xs={12}>
                  <Button type="submit" variant="contained">Update Password</Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Two-Factor Authentication</Typography>
            {tfaMsg.error && <Alert severity="error" sx={{ mb: 2 }}>{tfaMsg.error}</Alert>}
            {tfaMsg.success && <Alert severity="success" sx={{ mb: 2 }}>{tfaMsg.success}</Alert>}
            <Box display="flex" gap={1} sx={{ mb: 2 }}>
              <Button variant="outlined" onClick={enable2FA}>Enable</Button>
              <Button variant="outlined" color="error" onClick={disable2FA}>Disable</Button>
            </Box>
            <Box component="form" onSubmit={verify2FA} display="flex" gap={1}>
              <TextField label="Enter 2FA Code" value={tfaToken} onChange={(e) => setTfaToken(e.target.value)} />
              <Button type="submit" variant="contained">Verify</Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Security;


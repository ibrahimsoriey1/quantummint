import React from 'react';
import { Box, Typography, Grid, TextField, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import api from '../services/apiClient';
import { handleApiError } from '../utils/errorHandler';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    countryCode: ''
  });

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/users/profile');
        if (!isMounted) return;
        const user = data?.user || {};
        setForm({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phoneNumber: user.phoneNumber || '',
          countryCode: user.countryCode || ''
        });
      } catch (e) {
        const err = handleApiError(e);
        setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/users/profile', {
        firstName: form.firstName,
        lastName: form.lastName,
        phoneNumber: form.phoneNumber,
        countryCode: form.countryCode
      });
      setSuccess('Profile updated successfully.');
    } catch (e) {
      const err = handleApiError(e);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Settings</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Paper sx={{ p: 3 }}>
        {loading ? (
          <Box display="flex" alignItems="center" gap={1}><CircularProgress size={20} /> Loading profile...</Box>
        ) : (
          <Box component="form" onSubmit={onSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="First Name" name="firstName" value={form.firstName} onChange={onChange} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Last Name" name="lastName" value={form.lastName} onChange={onChange} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Email" name="email" value={form.email} onChange={onChange} disabled />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Country Code" name="countryCode" value={form.countryCode} onChange={onChange} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Phone Number" name="phoneNumber" value={form.phoneNumber} onChange={onChange} />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Settings;


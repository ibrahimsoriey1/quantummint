import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, FormGroup, FormControlLabel, Switch, Alert, CircularProgress } from '@mui/material';
import api from '../services/apiClient';
import { handleApiError } from '../utils/errorHandler';

const Notifications = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [prefs, setPrefs] = useState({ emailNotifications: true, smsNotifications: false, marketingEmails: false });

  useEffect(() => {
    let isMounted = true;
    const loadPrefs = async () => {
      setLoading(true);
      setError('');
      try {
        // If backend has a dedicated preferences endpoint, call it; else fallback to profile
        const { data } = await api.get('/users/profile');
        if (!isMounted) return;
        const user = data?.user || {};
        setPrefs({
          emailNotifications: user.emailNotifications ?? true,
          smsNotifications: user.smsNotifications ?? false,
          marketingEmails: user.marketingEmails ?? false
        });
      } catch (e) {
        const err = handleApiError(e);
        setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadPrefs();
    return () => { isMounted = false; };
  }, []);

  const toggle = (key) => async (e) => {
    const next = { ...prefs, [key]: e.target.checked };
    setPrefs(next);
    setError('');
    setSuccess('');
    try {
      await api.put('/users/profile', next);
      setSuccess('Notification preferences updated.');
    } catch (e) {
      const err = handleApiError(e);
      setError(err.message);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Notifications</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Paper sx={{ p: 3 }}>
        {loading ? (
          <Box display="flex" alignItems="center" gap={1}><CircularProgress size={20} /> Loading preferences...</Box>
        ) : (
          <FormGroup>
            <FormControlLabel control={<Switch checked={prefs.emailNotifications} onChange={toggle('emailNotifications')} />} label="Email notifications" />
            <FormControlLabel control={<Switch checked={prefs.smsNotifications} onChange={toggle('smsNotifications')} />} label="SMS notifications" />
            <FormControlLabel control={<Switch checked={prefs.marketingEmails} onChange={toggle('marketingEmails')} />} label="Marketing emails" />
          </FormGroup>
        )}
      </Paper>
    </Box>
  );
};

export default Notifications;


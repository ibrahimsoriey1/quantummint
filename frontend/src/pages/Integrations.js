import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Paper, Button, Alert, CircularProgress } from '@mui/material';
import api from '../services/apiClient';
import { handleApiError } from '../utils/errorHandler';

const Integrations = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/providers/active');
        if (!isMounted) return;
        setProviders(Array.isArray(data?.providers) ? data.providers : []);
      } catch (e) {
        const err = handleApiError(e);
        setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  const connect = async (code) => {
    // In a real app, redirect to OAuth or open provider setup modal
    alert(`Connecting provider: ${code}`);
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Integrations</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box display="flex" alignItems="center" gap={1}><CircularProgress size={20} /> Loading providers...</Box>
      ) : (
        <Grid container spacing={3}>
          {providers.map((p) => (
            <Grid item xs={12} md={6} key={p.code}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6">{p.name || p.code}</Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>Status: {p.active ? 'Active' : 'Inactive'}</Typography>
                <Button variant="contained" onClick={() => connect(p.code)} disabled={!p.active}>Connect</Button>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default Integrations;


import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Paper, CircularProgress, Alert } from '@mui/material';
import api from '../services/apiClient';
import { handleApiError } from '../utils/errorHandler';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ totalTransactions: 0, totalVolume: 0, activeUsers: 0 });

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // If a dedicated reports endpoint exists, use it; otherwise synthesize from balances/transactions counts
        const [txRes, balRes] = await Promise.allSettled([
          api.get('/transactions?limit=1'),
          api.get('/balances')
        ]);
        if (!isMounted) return;
        const totalTx = txRes.status === 'fulfilled' ? (txRes.value.data?.total || 0) : 0;
        const totalVol = balRes.status === 'fulfilled' ? (balRes.value.data?.balances || []).reduce((acc, b) => acc + (b.available || 0), 0) : 0;
        setSummary({ totalTransactions: totalTx, totalVolume: totalVol, activeUsers: undefined });
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

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Reports</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box display="flex" alignItems="center" gap={1}><CircularProgress size={20} /> Loading report...</Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">Total Transactions</Typography>
              <Typography variant="h5">{summary.totalTransactions}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">Total Volume</Typography>
              <Typography variant="h5">{summary.totalVolume}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">Active Users</Typography>
              <Typography variant="h5">{summary.activeUsers ?? '—'}</Typography>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Reports;


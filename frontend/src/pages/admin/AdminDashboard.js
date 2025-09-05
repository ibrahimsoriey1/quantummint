import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Paper, CircularProgress, Alert } from '@mui/material';
import api from '../../services/apiClient';
import { handleApiError } from '../../utils/errorHandler';
import TransactionChart from '../../components/charts/TransactionChart';
import RealTimeUpdates from '../../components/common/RealTimeUpdates';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ users: 0, transactions: 0, volume: 0, providers: 0 });

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [usersRes, txRes, balRes, provRes] = await Promise.allSettled([
          api.get('/users?limit=1'),
          api.get('/transactions?limit=1'),
          api.get('/balances'),
          api.get('/providers/active')
        ]);

        if (!isMounted) return;

        const usersTotal = usersRes.status === 'fulfilled' ? (usersRes.value.data?.total || (usersRes.value.data?.users?.length ?? 0)) : 0;
        const txTotal = txRes.status === 'fulfilled' ? (txRes.value.data?.total || (txRes.value.data?.transactions?.length ?? 0)) : 0;
        const volume = balRes.status === 'fulfilled' ? (balRes.value.data?.balances || []).reduce((acc, b) => acc + (b.available || 0), 0) : 0;
        const providersCount = provRes.status === 'fulfilled' ? (provRes.value.data?.providers?.length || 0) : 0;

        setStats({ users: usersTotal, transactions: txTotal, volume, providers: providersCount });
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
      <Typography variant="h4" sx={{ mb: 2 }}>Admin Dashboard</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box display="flex" alignItems="center" gap={1}><CircularProgress size={20} /> Loading metrics...</Box>
      ) : (
        <Grid container spacing={3}>
          {/* Stats Cards */}
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">Users</Typography>
              <Typography variant="h5">{stats.users}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">Transactions</Typography>
              <Typography variant="h5">{stats.transactions}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">Total Volume</Typography>
              <Typography variant="h5">{stats.volume}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">Providers</Typography>
              <Typography variant="h5">{stats.providers}</Typography>
            </Paper>
          </Grid>

          {/* Real-time Updates */}
          <Grid item xs={12}>
            <RealTimeUpdates />
          </Grid>

          {/* Transaction Chart */}
          <Grid item xs={12}>
            <TransactionChart 
              title="Transaction Analytics" 
              type="line"
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default AdminDashboard;



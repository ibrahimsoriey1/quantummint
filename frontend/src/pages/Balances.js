import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert } from '@mui/material';
import api from '../services/apiClient';
import { handleApiError } from '../utils/errorHandler';

const Balances = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [balances, setBalances] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/balances');
        if (!isMounted) return;
        setBalances(Array.isArray(data?.balances) ? data.balances : []);
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
      <Typography variant="h4" sx={{ mb: 2 }}>Balances</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper>
        {loading ? (
          <Box p={3} display="flex" alignItems="center" gap={1}><CircularProgress size={20} /> Loading balances...</Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Currency</TableCell>
                  <TableCell align="right">Available</TableCell>
                  <TableCell align="right">Pending</TableCell>
                  <TableCell align="right">Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {balances.map((b, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{b.currency || '-'}</TableCell>
                    <TableCell align="right">{b.available ?? 0}</TableCell>
                    <TableCell align="right">{b.pending ?? 0}</TableCell>
                    <TableCell align="right">{b.updatedAt ? new Date(b.updatedAt).toLocaleString() : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default Balances;


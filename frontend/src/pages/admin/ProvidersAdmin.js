import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert } from '@mui/material';
import api from '../../services/apiClient';
import { handleApiError } from '../../utils/errorHandler';

const ProvidersAdmin = () => {
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

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Admin - Providers</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper>
        {loading ? (
          <Box p={3} display="flex" alignItems="center" gap={1}><CircularProgress size={20} /> Loading providers...</Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Fee Structure</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {providers.map((p) => (
                  <TableRow key={p.code} hover>
                    <TableCell>{p.name || '-'}</TableCell>
                    <TableCell>{p.code}</TableCell>
                    <TableCell>{p.active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell>{p.feeStructure || 'N/A'}</TableCell>
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

export default ProvidersAdmin;


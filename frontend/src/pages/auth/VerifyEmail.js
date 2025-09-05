import React, { useEffect, useState } from 'react';
import { Box, Typography, Alert, CircularProgress, Button } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/apiClient';
import { handleApiError } from '../../utils/errorHandler';

const VerifyEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    const verify = async () => {
      setLoading(true);
      setError('');
      setMessage('');
      try {
        const { data } = await api.get(`/auth/verify-email/${token}`);
        if (!isMounted) return;
        setMessage(data?.message || 'Email verified successfully.');
      } catch (e) {
        const err = handleApiError(e);
        setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    verify();
    return () => { isMounted = false; };
  }, [token]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Verify Email</Typography>
      {loading && <Box display="flex" alignItems="center" gap={1}><CircularProgress size={20} /> Verifying...</Box>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {!loading && (
        <Button variant="contained" onClick={() => navigate('/login')}>Go to Login</Button>
      )}
    </Box>
  );
};

export default VerifyEmail;













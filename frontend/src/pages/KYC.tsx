import { useEffect, useState } from 'react';
import { Container, Paper, Box, Typography } from '@mui/material';
import api from '../api/client';

export default function KYC() {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    api.get('/api/v1/kyc/status')
      .then((res) => setStatus(res.data))
      .catch(() => setStatus(null));
  }, []);

  return (
    <Container maxWidth="md">
      <Box mt={4} component={Paper} p={3}>
        <Typography variant="h6">KYC</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
          {status ? JSON.stringify(status, null, 2) : 'No KYC status'}
        </Typography>
      </Box>
    </Container>
  );
}



import { useEffect, useState } from 'react';
import { Container, Paper, Box, Typography, Button } from '@mui/material';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function Payments() {
  const [providers, setProviders] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/v1/providers')
      .then((res) => setProviders(res.data))
      .catch(() => setProviders(null));
  }, []);

  return (
    <Container maxWidth="md">
      <Box mt={4} component={Paper} p={3}>
        <Typography variant="h6">Payment Providers</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
          {providers ? JSON.stringify(providers, null, 2) : 'No providers data'}
        </Typography>
        <Box mt={2} display="flex" gap={2}>
          <Button variant="contained" onClick={() => navigate('/pay/card')}>Pay with Card</Button>
          <Button variant="outlined" onClick={() => navigate('/pay/mobile')}>Mobile Money</Button>
        </Box>
      </Box>
    </Container>
  );
}



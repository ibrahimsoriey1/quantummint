import { useEffect, useState } from 'react';
import { Container, Paper, Box, Typography } from '@mui/material';
import api from '../api/client';

export default function Wallet() {
  const [wallet, setWallet] = useState<any>(null);

  useEffect(() => {
    api.get('/api/v1/wallet')
      .then((res) => setWallet(res.data))
      .catch(() => setWallet(null));
  }, []);

  return (
    <Container maxWidth="md">
      <Box mt={4} component={Paper} p={3}>
        <Typography variant="h6">Wallet</Typography>
        <Typography variant="body2" color="text.secondary">
          {wallet ? JSON.stringify(wallet) : 'No wallet data'}
        </Typography>
      </Box>
    </Container>
  );
}



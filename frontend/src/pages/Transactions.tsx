import { useEffect, useState } from 'react';
import { Container, Paper, Box, Typography } from '@mui/material';
import api from '../api/client';

export default function Transactions() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/v1/transactions')
      .then((res) => setItems(res.data?.transactions || []))
      .catch(() => setItems([]));
  }, []);

  return (
    <Container maxWidth="md">
      <Box mt={4} component={Paper} p={3}>
        <Typography variant="h6">Transactions</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
          {items.length ? JSON.stringify(items, null, 2) : 'No transactions'}
        </Typography>
      </Box>
    </Container>
  );
}



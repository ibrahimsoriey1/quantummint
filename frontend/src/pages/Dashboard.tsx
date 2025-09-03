import { useEffect, useState } from 'react';
import { Box, Button, Container, Paper, Typography } from '@mui/material';
import api from '../api/client';

export default function Dashboard() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    api.get('/health')
      .then((res) => setHealth(res.data))
      .catch(() => setHealth(null));
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <Container maxWidth="md">
      <Box mt={8} component={Paper} p={4}>
        <Typography variant="h5" gutterBottom>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          API Gateway health: {health ? 'OK' : 'Unavailable'}
        </Typography>
        <Button variant="outlined" onClick={logout}>Logout</Button>
      </Box>
    </Container>
  );
}



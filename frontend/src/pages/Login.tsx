import { useState } from 'react';
import { Box, Button, Container, TextField, Typography, Paper, Link } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = await login(email, password);
    if (result === 'ok') window.location.href = '/';
    else if (result === '2fa') window.location.href = '/2fa';
    else setError('Login failed');
  };

  return (
    <Container maxWidth="sm">
      <Box mt={10} component={Paper} p={4}>
        <Typography variant="h5" mb={2}>Login</Typography>
        <form onSubmit={handleSubmit}>
          <TextField fullWidth label="Email" margin="normal" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField fullWidth label="Password" type="password" margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Typography color="error" mt={1}>{error}</Typography>}
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>Sign In</Button>
          <Box mt={2} textAlign="center">
            <Link href="/register" underline="hover">Create an account</Link>
          </Box>
        </form>
      </Box>
    </Container>
  );
}



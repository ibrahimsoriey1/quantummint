import { useState } from 'react';
import { Box, Button, Container, TextField, Typography, Paper } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ok = await register({ name, email, password });
    if (ok) {
      window.location.href = '/login';
    } else {
      setError('Registration failed');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box mt={10} component={Paper} p={4}>
        <Typography variant="h5" mb={2}>Create account</Typography>
        <form onSubmit={handleSubmit}>
          <TextField fullWidth label="Name" margin="normal" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField fullWidth label="Email" margin="normal" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField fullWidth label="Password" type="password" margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Typography color="error" mt={1}>{error}</Typography>}
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>Register</Button>
        </form>
      </Box>
    </Container>
  );
}



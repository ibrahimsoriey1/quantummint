import { useState } from 'react';
import { Box, Button, Container, TextField, Typography, Paper } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function TwoFA() {
  const { verify2fa } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ok = await verify2fa(code);
    if (ok) {
      window.location.href = '/';
    } else {
      setError('Invalid code');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box mt={10} component={Paper} p={4}>
        <Typography variant="h5" mb={2}>Two-Factor Authentication</Typography>
        <form onSubmit={handleSubmit}>
          <TextField fullWidth label="Authenticator code" margin="normal" value={code} onChange={(e) => setCode(e.target.value)} />
          {error && <Typography color="error" mt={1}>{error}</Typography>}
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>Verify</Button>
        </form>
      </Box>
    </Container>
  );
}



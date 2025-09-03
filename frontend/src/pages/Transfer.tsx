import { useState } from 'react';
import { Box, Button, Container, Paper, TextField, Typography, MenuItem } from '@mui/material';
import api from '../api/client';
import { notify } from '../api/notify';
import Success from '../components/Success';

export default function Transfer() {
  const [toUser, setToUser] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toUser || !amount) return notify('Recipient and amount are required', 'warning');
    const value = parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) return notify('Amount must be a positive number', 'warning');
    await api.post('/api/v1/transactions/transfer', { to: toUser, amount: value, currency });
    notify('Transfer submitted', 'success');
    setDone(true);
  };

  return (
    <Container maxWidth="sm">
      <Box mt={4} component={Paper} p={3}>
        <Typography variant="h6" mb={2}>Transfer</Typography>
        {done ? (
          <Success title="Transfer submitted" to="/transactions" />
        ) : (
        <form onSubmit={submit}>
          <TextField fullWidth label="Recipient User ID/Email" margin="normal" value={toUser} onChange={(e) => setToUser(e.target.value)} />
          <TextField fullWidth label="Amount" margin="normal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField select fullWidth label="Currency" margin="normal" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {['USD','EUR','GBP','GHS','NGN','ZAR','XOF','XAF'].map(c => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant="contained" sx={{ mt: 2 }}>Send</Button>
        </form>
        )}
      </Box>
    </Container>
  );
}



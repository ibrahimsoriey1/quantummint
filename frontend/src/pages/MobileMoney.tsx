import { useState } from 'react';
import { Box, Button, Container, MenuItem, Paper, TextField, Typography } from '@mui/material';
import api from '../api/client';
import { notify } from '../api/notify';
import Success from '../components/Success';

export default function MobileMoney() {
  const [provider, setProvider] = useState<'orange' | 'afrimoney'>('orange');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('XOF');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!phone) return notify('Phone is required', 'warning');
    if (Number.isNaN(value) || value <= 0) return notify('Amount must be a positive number', 'warning');
    const path = provider === 'orange' ? '/api/v1/payments/orange-money' : '/api/v1/payments/afrimoney';
    await api.post(path, { phone, amount: value, currency });
    notify('Payment initiated', 'success');
    setDone(true);
  };

  return (
    <Container maxWidth="sm">
      <Box mt={4} component={Paper} p={3}>
        <Typography variant="h6" mb={2}>Mobile Money</Typography>
        {done ? (
          <Success title="Payment initiated" to="/payments" />
        ) : (
          <form onSubmit={submit}>
            <TextField select fullWidth label="Provider" margin="normal" value={provider} onChange={(e) => setProvider(e.target.value as any)}>
              <MenuItem value="orange">Orange Money</MenuItem>
              <MenuItem value="afrimoney">AfriMoney</MenuItem>
            </TextField>
            <TextField fullWidth label="Phone" margin="normal" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField fullWidth label="Amount" margin="normal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <TextField select fullWidth label="Currency" margin="normal" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['XOF','XAF','GHS','NGN','ZAR'].map(c => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
            <Button type="submit" variant="contained" sx={{ mt: 2 }}>Pay</Button>
          </form>
        )}
      </Box>
    </Container>
  );
}



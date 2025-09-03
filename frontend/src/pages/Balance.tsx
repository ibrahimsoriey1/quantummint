import { useState } from 'react';
import { Box, Button, Container, Paper, TextField, Typography, ToggleButton, ToggleButtonGroup, MenuItem } from '@mui/material';
import api from '../api/client';
import { notify } from '../api/notify';
import Success from '../components/Success';

export default function Balance() {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) return notify('Amount must be a positive number', 'warning');
    const path = mode === 'deposit' ? '/api/v1/balance/deposit' : '/api/v1/balance/withdraw';
    await api.post(path, { amount: value, currency });
    notify(`${mode === 'deposit' ? 'Deposit' : 'Withdrawal'} submitted`, 'success');
    setDone(true);
  };

  return (
    <Container maxWidth="sm">
      <Box mt={4} component={Paper} p={3}>
        <Typography variant="h6" mb={2}>Balance</Typography>
        <ToggleButtonGroup color="primary" exclusive value={mode} onChange={(_, v) => v && setMode(v)}>
          <ToggleButton value="deposit">Deposit</ToggleButton>
          <ToggleButton value="withdraw">Withdraw</ToggleButton>
        </ToggleButtonGroup>
        {done ? (
          <Success title={`${mode === 'deposit' ? 'Deposit' : 'Withdrawal'} submitted`} to="/wallet" />
        ) : (
          <form onSubmit={submit}>
            <TextField fullWidth label="Amount" margin="normal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <TextField select fullWidth label="Currency" margin="normal" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['USD','EUR','GBP','GHS','NGN','ZAR','XOF','XAF'].map(c => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
            <Button type="submit" variant="contained" sx={{ mt: 2 }}>{mode === 'deposit' ? 'Deposit' : 'Withdraw'}</Button>
          </form>
        )}
      </Box>
    </Container>
  );
}



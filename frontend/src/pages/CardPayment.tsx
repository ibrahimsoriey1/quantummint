import { useEffect, useState } from 'react';
import { Box, Button, Container, Paper, TextField, Typography } from '@mui/material';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import api from '../api/client';
import { notify } from '../api/notify';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function CardForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    // Create PaymentIntent via backend
    (async () => {
      try {
        const { data } = await api.post('/api/v1/payments/intent', { currency: 'usd' });
        setClientSecret(data.clientSecret);
      } catch {}
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) return notify('Amount must be a positive number', 'warning');
    if (!stripe || !elements || !clientSecret) return notify('Payment not ready', 'warning');
    const card = elements.getElement(CardElement);
    if (!card) return notify('Card element missing', 'error');
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card }
    });
    if (error) return notify(error.message || 'Payment failed', 'error');
    notify(`Payment ${paymentIntent?.status}`, 'success');
  };

  return (
    <form onSubmit={handleSubmit}>
      <TextField fullWidth label="Amount" margin="normal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Box p={2} border={1} borderColor="#ddd" borderRadius={1}>
        <CardElement options={{ hidePostalCode: true }} />
      </Box>
      <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={!stripe}>Pay</Button>
    </form>
  );
}

export default function CardPayment() {
  return (
    <Container maxWidth="sm">
      <Box mt={4} component={Paper} p={3}>
        <Typography variant="h6" mb={2}>Card Payment</Typography>
        <Elements stripe={stripePromise}>
          <CardForm />
        </Elements>
      </Box>
    </Container>
  );
}



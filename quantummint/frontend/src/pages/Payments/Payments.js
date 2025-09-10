import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Grid,
  Divider
} from '@mui/material';
import { PaymentOutlined, CreditCard, AccountBalance } from '@mui/icons-material';

const Payments = () => {
  const [paymentData, setPaymentData] = useState({
    amount: '',
    currency: 'USD',
    provider: 'stripe',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async() => {
    try {
      // Mock providers for now
      setProviders([
        { id: 'stripe', name: 'Stripe', type: 'card', enabled: true },
        { id: 'orange_money', name: 'Orange Money', type: 'mobile', enabled: true }
      ]);
    } catch (err) {
      setError('Failed to load payment providers');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePayment = async(e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Mock payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      setSuccess(`Payment of ${paymentData.amount} ${paymentData.currency} processed successfully!`);
      setPaymentData({
        amount: '',
        currency: 'USD',
        provider: 'stripe',
        description: ''
      });
    } catch (err) {
      setError(err.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PaymentOutlined />
        Payments
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Make a Payment
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {success}
                </Alert>
              )}

              <Box component="form" onSubmit={handlePayment}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Amount"
                      name="amount"
                      type="number"
                      value={paymentData.amount}
                      onChange={handleInputChange}
                      required
                      inputProps={{ min: 0.01, step: 0.01 }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Currency</InputLabel>
                      <Select
                        name="currency"
                        value={paymentData.currency}
                        onChange={handleInputChange}
                        label="Currency"
                      >
                        <MenuItem value="USD">USD</MenuItem>
                        <MenuItem value="EUR">EUR</MenuItem>
                        <MenuItem value="XOF">XOF</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Payment Provider</InputLabel>
                      <Select
                        name="provider"
                        value={paymentData.provider}
                        onChange={handleInputChange}
                        label="Payment Provider"
                      >
                        {providers.map((provider) => (
                          <MenuItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description (Optional)"
                      name="description"
                      value={paymentData.description}
                      onChange={handleInputChange}
                      multiline
                      rows={2}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={loading || !paymentData.amount}
                      startIcon={loading ? <CircularProgress size={20} /> : <CreditCard />}
                      sx={{ mt: 2 }}
                    >
                      {loading ? 'Processing...' : 'Process Payment'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Methods
              </Typography>

              {providers.map((provider) => (
                <Box key={provider.id} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {provider.type === 'card' ? <CreditCard /> : <AccountBalance />}
                    <Typography variant="body1">{provider.name}</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {provider.type === 'card' ? 'Credit/Debit Cards' : 'Mobile Money'}
                  </Typography>
                  {provider.id !== providers[providers.length - 1].id && <Divider sx={{ mt: 1 }} />}
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Payments;

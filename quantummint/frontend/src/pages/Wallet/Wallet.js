import React, { useState, useEffect } from 'react';
import {
  Grid,
  Typography,
  Card,
  CardContent,
  Box,
  Button,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  AccountBalanceWallet,
  Send,
  Lock,
  LockOpen,
  TrendingUp,
  Refresh,
  CallReceived,
  ContentCopy,
  QrCode
} from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { useWallet } from '../../contexts/WalletContext';
import { useAuth } from '../../contexts/AuthContext';

const transferValidationSchema = Yup.object({
  recipientEmail: Yup.string()
    .email('Invalid email address')
    .required('Recipient email is required'),
  amount: Yup.number()
    .min(0.01, 'Minimum transfer amount is $0.01')
    .required('Amount is required'),
  description: Yup.string()
    .max(200, 'Description must be less than 200 characters')
});

const lockValidationSchema = Yup.object({
  amount: Yup.number()
    .min(0.01, 'Minimum lock amount is $0.01')
    .required('Amount is required'),
  reason: Yup.string()
    .required('Reason is required')
});

const Wallet = () => {
  const { user } = useAuth();
  const { balance, fetchBalance, transferFunds, lockFunds } = useWallet();
  const [loading, setLoading] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [walletAddress] = useState(`quantum_${user?.id?.slice(0, 8)}_${Date.now()}`);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const transferFormik = useFormik({
    initialValues: {
      recipientEmail: '',
      amount: '',
      description: ''
    },
    validationSchema: transferValidationSchema,
    onSubmit: async(values, { resetForm }) => {
      setLoading(true);
      const result = await transferFunds({
        recipientEmail: values.recipientEmail,
        amount: parseFloat(values.amount),
        description: values.description
      });

      if (result.success) {
        resetForm();
        setShowTransferDialog(false);
      }
      setLoading(false);
    }
  });

  const lockFormik = useFormik({
    initialValues: {
      amount: '',
      reason: ''
    },
    validationSchema: lockValidationSchema,
    onSubmit: async(values, { resetForm }) => {
      setLoading(true);
      const result = await lockFunds(parseFloat(values.amount), values.reason);

      if (result.success) {
        resetForm();
        setShowLockDialog(false);
      }
      setLoading(false);
    }
  });


  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const quickActions = [
    {
      title: 'Send Money',
      description: 'Transfer funds to another user',
      icon: <Send />,
      color: 'primary',
      action: () => setShowTransferDialog(true)
    },
    {
      title: 'Receive Money',
      description: 'Show QR code for receiving funds',
      icon: <CallReceived />,
      color: 'success',
      action: () => setShowQRDialog(true)
    },
    {
      title: 'Lock Funds',
      description: 'Secure funds for future use',
      icon: <Lock />,
      color: 'warning',
      action: () => setShowLockDialog(true)
    },
    {
      title: 'Unlock Funds',
      description: 'Release locked funds',
      icon: <LockOpen />,
      color: 'info',
      action: () => {
        // Unlock functionality would be implemented here
        // Feature coming soon
      },
      disabled: !balance?.locked || balance.locked === 0
    }
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          My Wallet
        </Typography>
        <IconButton onClick={fetchBalance}>
          <Refresh />
        </IconButton>
      </Box>

      {/* Balance Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Total Balance
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {balance ? formatCurrency(balance.available + balance.locked) : '$0.00'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                  <AccountBalanceWallet />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Available Balance
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    {balance ? formatCurrency(balance.available) : '$0.00'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <TrendingUp />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Locked Balance
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="warning.main">
                    {balance ? formatCurrency(balance.locked) : '$0.00'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <Lock />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Wallet Address */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Wallet Address
          </Typography>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
              {walletAddress}
            </Typography>
            <Box>
              <IconButton onClick={() => copyToClipboard(walletAddress)} size="small">
                <ContentCopy />
              </IconButton>
              <IconButton onClick={() => setShowQRDialog(true)} size="small">
                <QrCode />
              </IconButton>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            {quickActions.map((action, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card
                  sx={{
                    cursor: action.disabled ? 'not-allowed' : 'pointer',
                    opacity: action.disabled ? 0.5 : 1,
                    '&:hover': action.disabled ? {} : {
                      transform: 'translateY(-2px)',
                      boxShadow: 4
                    },
                    transition: 'all 0.2s'
                  }}
                  onClick={action.disabled ? undefined : action.action}
                >
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Avatar
                      sx={{
                        bgcolor: `${action.color}.main`,
                        mx: 'auto',
                        mb: 2,
                        width: 56,
                        height: 56
                      }}
                    >
                      {action.icon}
                    </Avatar>
                    <Typography variant="h6" gutterBottom>
                      {action.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {action.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onClose={() => setShowTransferDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Money</DialogTitle>
        <form onSubmit={transferFormik.handleSubmit}>
          <DialogContent>
            <TextField
              fullWidth
              margin="normal"
              id="recipientEmail"
              name="recipientEmail"
              label="Recipient Email"
              type="email"
              value={transferFormik.values.recipientEmail}
              onChange={transferFormik.handleChange}
              onBlur={transferFormik.handleBlur}
              error={transferFormik.touched.recipientEmail && Boolean(transferFormik.errors.recipientEmail)}
              helperText={transferFormik.touched.recipientEmail && transferFormik.errors.recipientEmail}
            />
            <TextField
              fullWidth
              margin="normal"
              id="amount"
              name="amount"
              label="Amount ($)"
              type="number"
              value={transferFormik.values.amount}
              onChange={transferFormik.handleChange}
              onBlur={transferFormik.handleBlur}
              error={transferFormik.touched.amount && Boolean(transferFormik.errors.amount)}
              helperText={transferFormik.touched.amount && transferFormik.errors.amount}
            />
            <TextField
              fullWidth
              margin="normal"
              id="description"
              name="description"
              label="Description (Optional)"
              multiline
              rows={3}
              value={transferFormik.values.description}
              onChange={transferFormik.handleChange}
              onBlur={transferFormik.handleBlur}
              error={transferFormik.touched.description && Boolean(transferFormik.errors.description)}
              helperText={transferFormik.touched.description && transferFormik.errors.description}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowTransferDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              Send Money
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Lock Funds Dialog */}
      <Dialog open={showLockDialog} onClose={() => setShowLockDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Lock Funds</DialogTitle>
        <form onSubmit={lockFormik.handleSubmit}>
          <DialogContent>
            <TextField
              fullWidth
              margin="normal"
              id="amount"
              name="amount"
              label="Amount to Lock ($)"
              type="number"
              value={lockFormik.values.amount}
              onChange={lockFormik.handleChange}
              onBlur={lockFormik.handleBlur}
              error={lockFormik.touched.amount && Boolean(lockFormik.errors.amount)}
              helperText={lockFormik.touched.amount && lockFormik.errors.amount}
            />
            <TextField
              fullWidth
              margin="normal"
              id="reason"
              name="reason"
              label="Reason for Locking"
              value={lockFormik.values.reason}
              onChange={lockFormik.handleChange}
              onBlur={lockFormik.handleBlur}
              error={lockFormik.touched.reason && Boolean(lockFormik.errors.reason)}
              helperText={lockFormik.touched.reason && lockFormik.errors.reason}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowLockDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              Lock Funds
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onClose={() => setShowQRDialog(false)}>
        <DialogTitle>Receive Money</DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body1" gutterBottom>
            Share this QR code to receive payments
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'white', display: 'inline-block', borderRadius: 1 }}>
            <QRCodeSVG value={walletAddress} size={200} />
          </Box>
          <Typography variant="body2" sx={{ mt: 2, wordBreak: 'break-all' }}>
            {walletAddress}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => copyToClipboard(walletAddress)}>
            Copy Address
          </Button>
          <Button onClick={() => setShowQRDialog(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Wallet;

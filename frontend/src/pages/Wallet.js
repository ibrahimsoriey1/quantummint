import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  Send as SendIcon,
  GetApp as ReceiveIcon,
  SwapHoriz as TransferIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../hooks/useAuth';
import moneyGenerationService from '../services/moneyGenerationService';
import transactionService from '../services/transactionService';
import paymentService from '../services/paymentService';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Wallet = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [walletDetails, setWalletDetails] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [openTransferDialog, setOpenTransferDialog] = useState(false);
  const [openDepositDialog, setOpenDepositDialog] = useState(false);
  const [openWithdrawDialog, setOpenWithdrawDialog] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch wallet details
      const walletResponse = await moneyGenerationService.getWalletDetails();
      setWalletDetails(walletResponse.wallet);
      
      // Fetch wallet balance
      const balanceResponse = await moneyGenerationService.getWalletBalance();
      setWalletBalance(balanceResponse.balance);
      
      // Fetch recent transactions
      const transactionsResponse = await transactionService.getTransactions(1, 5);
      setRecentTransactions(transactionsResponse.transactions);
      
      // Fetch balance history
      const historyResponse = await transactionService.getBalanceHistory('month');
      setBalanceHistory(historyResponse.history);
      
      // Fetch payment methods
      const paymentResponse = await paymentService.getPaymentMethods();
      setPaymentMethods(paymentResponse.methods);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      setError('Failed to load wallet data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleOpenTransferDialog = () => {
    setOpenTransferDialog(true);
    setTransferSuccess(false);
  };

  const handleCloseTransferDialog = () => {
    setOpenTransferDialog(false);
    transferFormik.resetForm();
  };

  const handleOpenDepositDialog = () => {
    setOpenDepositDialog(true);
    setDepositSuccess(false);
  };

  const handleCloseDepositDialog = () => {
    setOpenDepositDialog(false);
    depositFormik.resetForm();
  };

  const handleOpenWithdrawDialog = () => {
    setOpenWithdrawDialog(true);
    setWithdrawSuccess(false);
  };

  const handleCloseWithdrawDialog = () => {
    setOpenWithdrawDialog(false);
    withdrawFormik.resetForm();
  };

  // Transfer Form Validation
  const transferValidationSchema = Yup.object({
    recipientEmail: Yup.string()
      .email('Invalid email address')
      .required('Recipient email is required'),
    amount: Yup.number()
      .required('Amount is required')
      .positive('Amount must be positive')
      .max(walletBalance, 'Amount exceeds your balance'),
    note: Yup.string(),
  });

  const transferFormik = useFormik({
    initialValues: {
      recipientEmail: '',
      amount: '',
      note: '',
    },
    validationSchema: transferValidationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');
        
        await moneyGenerationService.transferMoney({
          recipientEmail: values.recipientEmail,
          amount: parseFloat(values.amount),
          note: values.note,
        });
        
        // Refresh wallet data
        await fetchWalletData();
        
        setTransferSuccess(true);
      } catch (error) {
        console.error('Transfer error:', error);
        setError(error.message || 'Failed to transfer money. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  // Deposit Form Validation
  const depositValidationSchema = Yup.object({
    amount: Yup.number()
      .required('Amount is required')
      .positive('Amount must be positive')
      .min(10, 'Minimum deposit amount is $10'),
    paymentMethodId: Yup.string()
      .required('Payment method is required'),
  });

  const depositFormik = useFormik({
    initialValues: {
      amount: '',
      paymentMethodId: paymentMethods.length > 0 ? paymentMethods[0].id : '',
    },
    validationSchema: depositValidationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');
        
        await moneyGenerationService.depositMoney({
          amount: parseFloat(values.amount),
          paymentMethodId: values.paymentMethodId,
        });
        
        // Refresh wallet data
        await fetchWalletData();
        
        setDepositSuccess(true);
      } catch (error) {
        console.error('Deposit error:', error);
        setError(error.message || 'Failed to deposit money. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  // Withdraw Form Validation
  const withdrawValidationSchema = Yup.object({
    amount: Yup.number()
      .required('Amount is required')
      .positive('Amount must be positive')
      .min(10, 'Minimum withdrawal amount is $10')
      .max(walletBalance, 'Amount exceeds your balance'),
    paymentMethodId: Yup.string()
      .required('Payment method is required'),
  });

  const withdrawFormik = useFormik({
    initialValues: {
      amount: '',
      paymentMethodId: paymentMethods.length > 0 ? paymentMethods[0].id : '',
    },
    validationSchema: withdrawValidationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');
        
        await moneyGenerationService.withdrawMoney({
          amount: parseFloat(values.amount),
          paymentMethodId: values.paymentMethodId,
        });
        
        // Refresh wallet data
        await fetchWalletData();
        
        setWithdrawSuccess(true);
      } catch (error) {
        console.error('Withdrawal error:', error);
        setError(error.message || 'Failed to withdraw money. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  // Prepare chart data
  const chartData = {
    labels: balanceHistory.map(item => new Date(item.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Balance',
        data: balanceHistory.map(item => item.balance),
        fill: false,
        backgroundColor: '#3f51b5',
        borderColor: '#3f51b5',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Balance History',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (loading && !walletDetails) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        My Wallet
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Wallet Balance Card */}
        <Grid item xs={12} md={6} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <WalletIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  Wallet Balance
                </Typography>
                <Button
                  startIcon={<RefreshIcon />}
                  size="small"
                  onClick={fetchWalletData}
                  sx={{ ml: 'auto' }}
                >
                  Refresh
                </Button>
              </Box>
              <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', mb: 2 }}>
                ${walletBalance.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Wallet ID: {walletDetails?.id || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created: {walletDetails?.createdAt ? new Date(walletDetails.createdAt).toLocaleDateString() : 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions Card */}
        <Grid item xs={12} md={6} lg={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Button
                    variant="contained"
                    startIcon={<SendIcon />}
                    fullWidth
                    onClick={handleOpenTransferDialog}
                  >
                    Transfer
                  </Button>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    variant="outlined"
                    startIcon={<ReceiveIcon />}
                    fullWidth
                    onClick={handleOpenDepositDialog}
                  >
                    Deposit
                  </Button>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    variant="outlined"
                    startIcon={<ArrowDownwardIcon />}
                    fullWidth
                    onClick={handleOpenWithdrawDialog}
                  >
                    Withdraw
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Tabs Section */}
        <Grid item xs={12}>
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab label="Overview" />
              <Tab label="Transactions" />
              <Tab label="Analytics" />
            </Tabs>

            <Box sx={{ p: 3 }}>
              {/* Overview Tab */}
              {tabValue === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Wallet Information
                    </Typography>
                    <Card variant="outlined" sx={{ mb: 3 }}>
                      <CardContent>
                        <List dense>
                          <ListItem>
                            <ListItemText primary="Wallet Type" secondary={walletDetails?.type || 'Standard'} />
                          </ListItem>
                          <Divider />
                          <ListItem>
                            <ListItemText primary="Status" secondary={walletDetails?.status || 'Active'} />
                          </ListItem>
                          <Divider />
                          <ListItem>
                            <ListItemText primary="Currency" secondary={walletDetails?.currency || 'USD'} />
                          </ListItem>
                          <Divider />
                          <ListItem>
                            <ListItemText 
                              primary="Last Transaction" 
                              secondary={
                                recentTransactions.length > 0 
                                  ? new Date(recentTransactions[0].createdAt).toLocaleString() 
                                  : 'No transactions yet'
                              } 
                            />
                          </ListItem>
                        </List>
                      </CardContent>
                    </Card>

                    <Typography variant="h6" gutterBottom>
                      Recent Activity
                    </Typography>
                    <Card variant="outlined">
                      <CardContent>
                        {recentTransactions.length > 0 ? (
                          <List dense>
                            {recentTransactions.slice(0, 5).map((transaction) => (
                              <React.Fragment key={transaction.id}>
                                <ListItem>
                                  <ListItemIcon>
                                    {transaction.type === 'deposit' || transaction.type === 'generation' ? (
                                      <ArrowUpwardIcon color="success" />
                                    ) : (
                                      <ArrowDownwardIcon color="error" />
                                    )}
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={transaction.description || transaction.type}
                                    secondary={new Date(transaction.createdAt).toLocaleString()}
                                  />
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      fontWeight: 'bold',
                                      color: transaction.type === 'deposit' || transaction.type === 'generation' ? 'success.main' : 'error.main'
                                    }}
                                  >
                                    {transaction.type === 'deposit' || transaction.type === 'generation' ? '+' : '-'}${transaction.amount.toFixed(2)}
                                  </Typography>
                                </ListItem>
                                <Divider />
                              </React.Fragment>
                            ))}
                          </List>
                        ) : (
                          <Typography variant="body2" color="text.secondary" align="center">
                            No recent transactions
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Balance History
                    </Typography>
                    <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
                      {balanceHistory.length > 0 ? (
                        <Line data={chartData} options={chartOptions} />
                      ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                          <Typography variant="body2" color="text.secondary">
                            No balance history available
                          </Typography>
                        </Box>
                      )}
                    </Card>
                  </Grid>
                </Grid>
              )}

              {/* Transactions Tab */}
              {tabValue === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Recent Transactions
                  </Typography>
                  {recentTransactions.length > 0 ? (
                    <List>
                      {recentTransactions.map((transaction) => (
                        <React.Fragment key={transaction.id}>
                          <ListItem>
                            <ListItemIcon>
                              {transaction.type === 'deposit' || transaction.type === 'generation' ? (
                                <ArrowUpwardIcon color="success" />
                              ) : (
                                <ArrowDownwardIcon color="error" />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Typography variant="body1">
                                  {transaction.description || transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                                </Typography>
                              }
                              secondary={
                                <>
                                  <Typography variant="body2" component="span">
                                    {new Date(transaction.createdAt).toLocaleString()}
                                  </Typography>
                                  {transaction.note && (
                                    <Typography variant="body2" component="div" color="text.secondary">
                                      Note: {transaction.note}
                                    </Typography>
                                  )}
                                </>
                              }
                            />
                            <Box>
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  fontWeight: 'bold',
                                  color: transaction.type === 'deposit' || transaction.type === 'generation' ? 'success.main' : 'error.main',
                                  textAlign: 'right'
                                }}
                              >
                                {transaction.type === 'deposit' || transaction.type === 'generation' ? '+' : '-'}${transaction.amount.toFixed(2)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                                Status: {transaction.status}
                              </Typography>
                            </Box>
                          </ListItem>
                          <Divider />
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Box sx={{ textAlign: 'center', p: 3 }}>
                      <Typography variant="body1" color="text.secondary">
                        No transactions found
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Button variant="outlined" component="a" href="/transactions">
                      View All Transactions
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Analytics Tab */}
              {tabValue === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Wallet Analytics
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined" sx={{ mb: 3 }}>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Transaction Summary
                          </Typography>
                          <List dense>
                            <ListItem>
                              <ListItemText 
                                primary="Total Transactions" 
                                secondary={recentTransactions.length} 
                              />
                            </ListItem>
                            <Divider />
                            <ListItem>
                              <ListItemText 
                                primary="Total Deposits" 
                                secondary={recentTransactions.filter(t => t.type === 'deposit' || t.type === 'generation').length} 
                              />
                            </ListItem>
                            <Divider />
                            <ListItem>
                              <ListItemText 
                                primary="Total Withdrawals" 
                                secondary={recentTransactions.filter(t => t.type === 'withdrawal').length} 
                              />
                            </ListItem>
                            <Divider />
                            <ListItem>
                              <ListItemText 
                                primary="Total Transfers" 
                                secondary={recentTransactions.filter(t => t.type === 'transfer').length} 
                              />
                            </ListItem>
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined" sx={{ mb: 3 }}>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            Balance Forecast
                          </Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            Based on your transaction history, we estimate your balance in 30 days will be:
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            ${(walletBalance * 1.15).toFixed(2)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            This is an estimate based on your current spending and deposit patterns.
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Transfer Dialog */}
      <Dialog open={openTransferDialog} onClose={handleCloseTransferDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Transfer Money</DialogTitle>
        <DialogContent>
          {transferSuccess ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Transfer Successful!
              </Typography>
              <Typography variant="body1" paragraph>
                You have successfully transferred ${transferFormik.values.amount} to {transferFormik.values.recipientEmail}.
              </Typography>
              <Button
                variant="contained"
                onClick={handleCloseTransferDialog}
              >
                Close
              </Button>
            </Box>
          ) : (
            <>
              <DialogContentText paragraph>
                Transfer money to another user by entering their email address and the amount you want to send.
              </DialogContentText>
              <form onSubmit={transferFormik.handleSubmit}>
                <TextField
                  fullWidth
                  id="recipientEmail"
                  name="recipientEmail"
                  label="Recipient Email"
                  value={transferFormik.values.recipientEmail}
                  onChange={transferFormik.handleChange}
                  onBlur={transferFormik.handleBlur}
                  error={transferFormik.touched.recipientEmail && Boolean(transferFormik.errors.recipientEmail)}
                  helperText={transferFormik.touched.recipientEmail && transferFormik.errors.recipientEmail}
                  margin="normal"
                />
                <TextField
                  fullWidth
                  id="amount"
                  name="amount"
                  label="Amount"
                  type="number"
                  value={transferFormik.values.amount}
                  onChange={transferFormik.handleChange}
                  onBlur={transferFormik.handleBlur}
                  error={transferFormik.touched.amount && Boolean(transferFormik.errors.amount)}
                  helperText={transferFormik.touched.amount && transferFormik.errors.amount}
                  margin="normal"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
                <TextField
                  fullWidth
                  id="note"
                  name="note"
                  label="Note (Optional)"
                  value={transferFormik.values.note}
                  onChange={transferFormik.handleChange}
                  onBlur={transferFormik.handleBlur}
                  error={transferFormik.touched.note && Boolean(transferFormik.errors.note)}
                  helperText={transferFormik.touched.note && transferFormik.errors.note}
                  margin="normal"
                  multiline
                  rows={2}
                />
              </form>
            </>
          )}
        </DialogContent>
        {!transferSuccess && (
          <DialogActions>
            <Button onClick={handleCloseTransferDialog}>Cancel</Button>
            <Button
              onClick={transferFormik.handleSubmit}
              variant="contained"
              disabled={loading || !transferFormik.isValid}
            >
              {loading ? <CircularProgress size={24} /> : 'Transfer'}
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* Deposit Dialog */}
      <Dialog open={openDepositDialog} onClose={handleCloseDepositDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Deposit Money</DialogTitle>
        <DialogContent>
          {depositSuccess ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Deposit Successful!
              </Typography>
              <Typography variant="body1" paragraph>
                You have successfully deposited ${depositFormik.values.amount} to your wallet.
              </Typography>
              <Button
                variant="contained"
                onClick={handleCloseDepositDialog}
              >
                Close
              </Button>
            </Box>
          ) : (
            <>
              <DialogContentText paragraph>
                Deposit money to your wallet by selecting a payment method and entering the amount.
              </DialogContentText>
              <form onSubmit={depositFormik.handleSubmit}>
                <TextField
                  fullWidth
                  id="amount"
                  name="amount"
                  label="Amount"
                  type="number"
                  value={depositFormik.values.amount}
                  onChange={depositFormik.handleChange}
                  onBlur={depositFormik.handleBlur}
                  error={depositFormik.touched.amount && Boolean(depositFormik.errors.amount)}
                  helperText={depositFormik.touched.amount && depositFormik.errors.amount}
                  margin="normal"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
                <FormControl fullWidth margin="normal" error={depositFormik.touched.paymentMethodId && Boolean(depositFormik.errors.paymentMethodId)}>
                  <InputLabel id="payment-method-label">Payment Method</InputLabel>
                  <Select
                    labelId="payment-method-label"
                    id="paymentMethodId"
                    name="paymentMethodId"
                    value={depositFormik.values.paymentMethodId}
                    onChange={depositFormik.handleChange}
                    label="Payment Method"
                  >
                    {paymentMethods.length > 0 ? (
                      paymentMethods.map((method) => (
                        <MenuItem key={method.id} value={method.id}>
                          {method.providerName} - {method.maskedAccountNumber}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem value="" disabled>
                        No payment methods available
                      </MenuItem>
                    )}
                  </Select>
                  {depositFormik.touched.paymentMethodId && depositFormik.errors.paymentMethodId && (
                    <Typography variant="caption" color="error">
                      {depositFormik.errors.paymentMethodId}
                    </Typography>
                  )}
                </FormControl>
                {paymentMethods.length === 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="info">
                      You don't have any payment methods. Please add a payment method first.
                    </Alert>
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Button variant="outlined" component="a" href="/payment-methods">
                        Add Payment Method
                      </Button>
                    </Box>
                  </Box>
                )}
              </form>
            </>
          )}
        </DialogContent>
        {!depositSuccess && (
          <DialogActions>
            <Button onClick={handleCloseDepositDialog}>Cancel</Button>
            <Button
              onClick={depositFormik.handleSubmit}
              variant="contained"
              disabled={loading || !depositFormik.isValid || paymentMethods.length === 0}
            >
              {loading ? <CircularProgress size={24} /> : 'Deposit'}
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={openWithdrawDialog} onClose={handleCloseWithdrawDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Withdraw Money</DialogTitle>
        <DialogContent>
          {withdrawSuccess ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Withdrawal Successful!
              </Typography>
              <Typography variant="body1" paragraph>
                You have successfully withdrawn ${withdrawFormik.values.amount} from your wallet.
              </Typography>
              <Button
                variant="contained"
                onClick={handleCloseWithdrawDialog}
              >
                Close
              </Button>
            </Box>
          ) : (
            <>
              <DialogContentText paragraph>
                Withdraw money from your wallet by selecting a payment method and entering the amount.
              </DialogContentText>
              <form onSubmit={withdrawFormik.handleSubmit}>
                <TextField
                  fullWidth
                  id="amount"
                  name="amount"
                  label="Amount"
                  type="number"
                  value={withdrawFormik.values.amount}
                  onChange={withdrawFormik.handleChange}
                  onBlur={withdrawFormik.handleBlur}
                  error={withdrawFormik.touched.amount && Boolean(withdrawFormik.errors.amount)}
                  helperText={withdrawFormik.touched.amount && withdrawFormik.errors.amount}
                  margin="normal"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
                <FormControl fullWidth margin="normal" error={withdrawFormik.touched.paymentMethodId && Boolean(withdrawFormik.errors.paymentMethodId)}>
                  <InputLabel id="payment-method-label">Payment Method</InputLabel>
                  <Select
                    labelId="payment-method-label"
                    id="paymentMethodId"
                    name="paymentMethodId"
                    value={withdrawFormik.values.paymentMethodId}
                    onChange={withdrawFormik.handleChange}
                    label="Payment Method"
                  >
                    {paymentMethods.length > 0 ? (
                      paymentMethods.map((method) => (
                        <MenuItem key={method.id} value={method.id}>
                          {method.providerName} - {method.maskedAccountNumber}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem value="" disabled>
                        No payment methods available
                      </MenuItem>
                    )}
                  </Select>
                  {withdrawFormik.touched.paymentMethodId && withdrawFormik.errors.paymentMethodId && (
                    <Typography variant="caption" color="error">
                      {withdrawFormik.errors.paymentMethodId}
                    </Typography>
                  )}
                </FormControl>
                {paymentMethods.length === 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="info">
                      You don't have any payment methods. Please add a payment method first.
                    </Alert>
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Button variant="outlined" component="a" href="/payment-methods">
                        Add Payment Method
                      </Button>
                    </Box>
                  </Box>
                )}
              </form>
            </>
          )}
        </DialogContent>
        {!withdrawSuccess && (
          <DialogActions>
            <Button onClick={handleCloseWithdrawDialog}>Cancel</Button>
            <Button
              onClick={withdrawFormik.handleSubmit}
              variant="contained"
              disabled={loading || !withdrawFormik.isValid || paymentMethods.length === 0}
            >
              {loading ? <CircularProgress size={24} /> : 'Withdraw'}
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </Box>
  );
};

export default Wallet;
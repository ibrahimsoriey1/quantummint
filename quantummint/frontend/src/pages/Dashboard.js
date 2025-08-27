import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  Bolt as GenerateIcon,
  Receipt as TransactionsIcon,
  MonetizationOn as CashOutIcon,
  VerifiedUser as KYCIcon,
  ArrowForward as ArrowForwardIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip as ChartTooltip, Legend } from 'chart.js';

import PageTitle from '../components/common/PageTitle';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AlertMessage from '../components/common/AlertMessage';

import { getUserWallets } from '../store/slices/walletSlice';
import { getTransactionHistory } from '../store/slices/transactionSlice';
import { getGenerationHistory } from '../store/slices/generationSlice';
import { getCashOutHistory } from '../store/slices/cashOutSlice';
import { getKYCStatus } from '../store/slices/kycSlice';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend);

const Dashboard = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const [error, setError] = useState(null);
  
  const { user } = useSelector((state) => state.auth);
  const { wallets, loading: walletsLoading } = useSelector((state) => state.wallet);
  const { transactions, loading: transactionsLoading } = useSelector((state) => state.transaction);
  const { generationHistory, loading: generationLoading } = useSelector((state) => state.generation);
  const { cashOutHistory, loading: cashOutLoading } = useSelector((state) => state.cashOut);
  const { kycStatus, loading: kycLoading } = useSelector((state) => state.kyc);
  
  useEffect(() => {
    dispatch(getUserWallets())
      .unwrap()
      .catch((error) => setError(error.message));
      
    dispatch(getTransactionHistory({ limit: 5 }))
      .unwrap()
      .catch((error) => setError(error.message));
      
    dispatch(getGenerationHistory({ limit: 5 }))
      .unwrap()
      .catch((error) => setError(error.message));
      
    dispatch(getCashOutHistory({ limit: 5 }))
      .unwrap()
      .catch((error) => setError(error.message));
      
    dispatch(getKYCStatus())
      .unwrap()
      .catch((error) => setError(error.message));
  }, [dispatch]);
  
  const loading = walletsLoading || transactionsLoading || generationLoading || cashOutLoading || kycLoading;
  
  // Chart data for balance history
  const balanceChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    datasets: [
      {
        label: 'Balance',
        data: [0, 500, 1200, 800, 1500, 2000, 2500],
        borderColor: theme.palette.primary.main,
        backgroundColor: theme.palette.primary.main,
        tension: 0.4,
      },
    ],
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: theme.palette.background.paper,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        grid: {
          color: theme.palette.divider,
        },
        ticks: {
          callback: (value) => `$${value}`,
        },
      },
    },
  };
  
  // Get primary wallet
  const primaryWallet = wallets && wallets.length > 0 ? wallets[0] : null;
  
  // Format currency
  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };
  
  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  // Get KYC status color
  const getKYCStatusColor = (status) => {
    switch (status) {
      case 'verified':
        return theme.palette.success.main;
      case 'pending':
        return theme.palette.warning.main;
      case 'rejected':
        return theme.palette.error.main;
      default:
        return theme.palette.text.secondary;
    }
  };
  
  // Get KYC status text
  const getKYCStatusText = (status) => {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'pending':
        return 'Pending Verification';
      case 'rejected':
        return 'Verification Rejected';
      default:
        return 'Not Submitted';
    }
  };
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  return (
    <Box>
      <AlertMessage
        severity="error"
        message={error}
        open={!!error}
        onClose={() => setError(null)}
      />
      
      <PageTitle
        title={`Welcome, ${user?.firstName || 'User'}!`}
        subtitle="Here's an overview of your account"
      />
      
      {/* Quick Actions */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6} sm={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<GenerateIcon />}
                    onClick={() => navigate('/generate')}
                    sx={{ height: '100%' }}
                  >
                    Generate Money
                  </Button>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<CashOutIcon />}
                    onClick={() => navigate('/cash-out')}
                    sx={{ height: '100%' }}
                  >
                    Cash Out
                  </Button>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<TransactionsIcon />}
                    onClick={() => navigate('/transactions')}
                    sx={{ height: '100%' }}
                  >
                    Transactions
                  </Button>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<KYCIcon />}
                    onClick={() => navigate('/kyc')}
                    sx={{ height: '100%' }}
                  >
                    KYC Status
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <WalletIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    Wallet Balance
                  </Typography>
                </Box>
                <Button
                  variant="text"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/wallet')}
                >
                  View Details
                </Button>
              </Box>
              
              {primaryWallet ? (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h3" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    {formatCurrency(primaryWallet.balance, primaryWallet.currency)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {primaryWallet.walletType.charAt(0).toUpperCase() + primaryWallet.walletType.slice(1)} Wallet
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1" color="text.secondary">
                    No wallet found
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* KYC Status */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <KYCIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    KYC Verification Status
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  onClick={() => navigate('/kyc')}
                  disabled={kycStatus === 'verified'}
                >
                  {kycStatus === 'not_submitted' ? 'Submit KYC' : 
                   kycStatus === 'pending' ? 'Check Status' :
                   kycStatus === 'rejected' ? 'Resubmit KYC' : 'Verified'}
                </Button>
              </Box>
              
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: getKYCStatusColor(kycStatus),
                    mr: 1,
                  }}
                />
                <Typography variant="body1" sx={{ color: getKYCStatusColor(kycStatus) }}>
                  {getKYCStatusText(kycStatus)}
                </Typography>
              </Box>
              
              {kycStatus === 'rejected' && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  Reason: {rejectionReason || 'Your KYC submission was rejected. Please resubmit with valid documents.'}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Balance Chart and Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Balance History
              </Typography>
              <Box sx={{ height: 300, mt: 2 }}>
                <Line data={balanceChartData} options={chartOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              
              <List disablePadding>
                {transactions && transactions.slice(0, 5).map((transaction, index) => (
                  <React.Fragment key={transaction.transactionId}>
                    <ListItem
                      disablePadding
                      sx={{ py: 1 }}
                      secondaryAction={
                        <Tooltip title="View Details">
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => navigate(`/transactions?id=${transaction.transactionId}`)}
                          >
                            <ArrowForwardIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      }
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {transaction.transactionType === 'generation' ? (
                          <GenerateIcon color="success" />
                        ) : transaction.transactionType === 'cash_out' ? (
                          <CashOutIcon color="primary" />
                        ) : transaction.transactionType === 'transfer' ? (
                          transaction.amount > 0 ? (
                            <TrendingUpIcon color="success" />
                          ) : (
                            <TrendingDownIcon color="error" />
                          )
                        ) : (
                          <TransactionsIcon color="info" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">
                              {transaction.transactionType.charAt(0).toUpperCase() + transaction.transactionType.slice(1).replace('_', ' ')}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color:
                                  transaction.transactionType === 'generation'
                                    ? 'success.main'
                                    : transaction.transactionType === 'cash_out'
                                    ? 'error.main'
                                    : 'text.primary',
                              }}
                            >
                              {transaction.transactionType === 'generation' ? '+' : transaction.transactionType === 'cash_out' ? '-' : ''}
                              {formatCurrency(transaction.amount, transaction.currency)}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <AccessTimeIcon sx={{ fontSize: 12, mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(transaction.createdAt)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < transactions.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
                
                {(!transactions || transactions.length === 0) && (
                  <ListItem>
                    <ListItemText
                      primary="No recent transactions"
                      secondary="Your recent transactions will appear here"
                    />
                  </ListItem>
                )}
              </List>
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="text"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/transactions')}
                >
                  View All Transactions
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
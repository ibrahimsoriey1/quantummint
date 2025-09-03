import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Divider,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Link,
  Alert,
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
  Payment as PaymentIcon,
  VerifiedUser as VerifiedUserIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import moneyGenerationService from '../services/moneyGenerationService';
import transactionService from '../services/transactionService';
import kycService from '../services/kycService';
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

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [generationStats, setGenerationStats] = useState(null);
  const [transactionStats, setTransactionStats] = useState(null);
  const [kycStatus, setKycStatus] = useState('pending');
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError('');

        // Fetch wallet balance
        const walletResponse = await moneyGenerationService.getWalletBalance();
        setWalletBalance(walletResponse.balance);

        // Fetch generation stats
        const generationResponse = await moneyGenerationService.getGenerationStats();
        setGenerationStats(generationResponse);

        // Fetch transaction stats
        const transactionResponse = await transactionService.getTransactionStats('month');
        setTransactionStats(transactionResponse);

        // Fetch KYC status
        const kycResponse = await kycService.getKycStatus();
        setKycStatus(kycResponse.status);

        // Fetch recent transactions
        const transactionsResponse = await transactionService.getTransactions(1, 5);
        setRecentTransactions(transactionsResponse.transactions);

        // Fetch balance history
        const balanceResponse = await transactionService.getBalanceHistory('month');
        setBalanceHistory(balanceResponse.history);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome, {user?.firstName || 'User'}!
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {kycStatus !== 'approved' && (
        <Alert severity="warning" sx={{ mb: 3 }} action={
          <Button color="inherit" size="small" component={RouterLink} to="/kyc">
            Complete KYC
          </Button>
        }>
          {kycStatus === 'pending' 
            ? 'Your KYC verification is pending. Some features may be limited until verification is complete.' 
            : 'Please complete your KYC verification to access all features.'}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Wallet Balance Card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <WalletIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  Wallet Balance
                </Typography>
              </Box>
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                ${walletBalance.toFixed(2)}
              </Typography>
              <Button 
                variant="outlined" 
                size="small" 
                sx={{ mt: 2 }}
                component={RouterLink}
                to="/wallet"
              >
                View Wallet
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Money Generated Card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  Money Generated
                </Typography>
              </Box>
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                ${generationStats?.totalGenerated.toFixed(2) || '0.00'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This month: ${generationStats?.monthlyGenerated.toFixed(2) || '0.00'}
              </Typography>
              <Button 
                variant="outlined" 
                size="small" 
                sx={{ mt: 2 }}
                component={RouterLink}
                to="/generate"
              >
                Generate More
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Transactions Card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <HistoryIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  Transactions
                </Typography>
              </Box>
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                {transactionStats?.totalCount || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This month: {transactionStats?.monthlyCount || 0}
              </Typography>
              <Button 
                variant="outlined" 
                size="small" 
                sx={{ mt: 2 }}
                component={RouterLink}
                to="/transactions"
              >
                View All
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* KYC Status Card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <VerifiedUserIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  KYC Status
                </Typography>
              </Box>
              <Typography 
                variant="h6" 
                component="div" 
                sx={{ 
                  fontWeight: 'bold',
                  color: kycStatus === 'approved' ? 'success.main' : 
                         kycStatus === 'pending' ? 'warning.main' : 'error.main'
                }}
              >
                {kycStatus === 'approved' ? 'Approved' : 
                 kycStatus === 'pending' ? 'Pending' : 'Not Submitted'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {kycStatus === 'approved' 
                  ? 'Your identity has been verified' 
                  : kycStatus === 'pending'
                  ? 'Your verification is in progress'
                  : 'Please complete your verification'}
              </Typography>
              {kycStatus !== 'approved' && (
                <Button 
                  variant="outlined" 
                  size="small" 
                  sx={{ mt: 2 }}
                  component={RouterLink}
                  to="/kyc"
                >
                  {kycStatus === 'pending' ? 'Check Status' : 'Complete KYC'}
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Balance Chart */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Balance History
            </Typography>
            <Box sx={{ height: 300 }}>
              {balanceHistory.length > 0 ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography variant="body1" color="text.secondary">
                    No balance history available
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Recent Transactions */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Recent Transactions
            </Typography>
            {recentTransactions.length > 0 ? (
              <List>
                {recentTransactions.map((transaction) => (
                  <React.Fragment key={transaction.id}>
                    <ListItem
                      component={RouterLink}
                      to={`/transactions/${transaction.id}`}
                      sx={{ 
                        textDecoration: 'none', 
                        color: 'inherit',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        }
                      }}
                    >
                      <ListItemIcon>
                        {transaction.type === 'deposit' ? (
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
                          color: transaction.type === 'deposit' ? 'success.main' : 'error.main'
                        }}
                      >
                        {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                      </Typography>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                <Typography variant="body1" color="text.secondary">
                  No recent transactions
                </Typography>
              </Box>
            )}
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Link component={RouterLink} to="/transactions" color="primary">
                View All Transactions
              </Link>
            </Box>
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid item>
                <Button
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  component={RouterLink}
                  to="/generate"
                >
                  Generate Money
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<WalletIcon />}
                  component={RouterLink}
                  to="/wallet"
                >
                  Manage Wallet
                </Button>
              </Grid>
              <Grid item>
                <Button
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                  component={RouterLink}
                  to="/transactions"
                >
                  View Transactions
                </Button>
              </Grid>
              {kycStatus !== 'approved' && (
                <Grid item>
                  <Button
                    variant="outlined"
                    startIcon={<VerifiedUserIcon />}
                    component={RouterLink}
                    to="/kyc"
                  >
                    Complete KYC
                  </Button>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
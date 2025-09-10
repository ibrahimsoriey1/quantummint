import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Chip,
  LinearProgress,
  IconButton
} from '@mui/material';
import {
  AccountBalanceWallet,
  TrendingUp,
  Payment,
  VerifiedUser,
  MonetizationOn,
  Refresh,
  ArrowUpward,
  ArrowDownward
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useWallet } from '../../contexts/WalletContext';
import axios from 'axios';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, walletStats, fetchBalance, fetchWalletStats } = useWallet();
  const [kycStatus, setKycStatus] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const fetchDashboardData = useCallback(async() => {
    try {
      setLoading(true);

      // Fetch KYC status
      const kycResponse = await axios.get(`/api/kyc/user/${user.id}`);
      setKycStatus(kycResponse.data.data);

      // Fetch recent transactions
      const transactionsResponse = await axios.get(`/api/transactions/user/${user.id}`, {
        params: { limit: 5 }
      });
      setRecentTransactions(transactionsResponse.data.data.transactions);

      // Refresh wallet data
      await Promise.all([fetchBalance(), fetchWalletStats()]);

    } catch (error) {
      // Failed to fetch dashboard data
    } finally {
      setLoading(false);
    }
  }, [user.id, fetchBalance, fetchWalletStats]);

  const getKycStatusColor = (status) => {
    switch (status) {
    case 'approved': return 'success';
    case 'pending': return 'warning';
    case 'rejected': return 'error';
    case 'in_review': return 'info';
    default: return 'default';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const mockChartData = [
    { name: 'Jan', value: 4000 },
    { name: 'Feb', value: 3000 },
    { name: 'Mar', value: 2000 },
    { name: 'Apr', value: 2780 },
    { name: 'May', value: 1890 },
    { name: 'Jun', value: 2390 }
  ];

  const pieData = [
    { name: 'Generated', value: 60, color: '#8884d8' },
    { name: 'Received', value: 25, color: '#82ca9d' },
    { name: 'Spent', value: 15, color: '#ffc658' }
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Welcome back, {user?.firstName}!
        </Typography>
        <IconButton onClick={fetchDashboardData} disabled={loading}>
          <Refresh />
        </IconButton>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Quick Stats */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Balance
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {balance ? formatCurrency(balance.available + balance.locked) : '$0.00'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <AccountBalanceWallet />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Available Balance
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
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

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    This Month Generated
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {walletStats ? formatCurrency(walletStats.monthlyGenerated || 0) : '$0.00'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <MonetizationOn />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    KYC Status
                  </Typography>
                  <Chip
                    label={kycStatus?.status || 'Not Started'}
                    color={getKycStatusColor(kycStatus?.status)}
                    size="small"
                  />
                </Box>
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <VerifiedUser />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Balance Chart */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Balance Trend
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Money Distribution */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Money Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box mt={2}>
                {pieData.map((entry, index) => (
                  <Box key={index} display="flex" alignItems="center" mb={1}>
                    <Box
                      width={12}
                      height={12}
                      bgcolor={entry.color}
                      borderRadius="50%"
                      mr={1}
                    />
                    <Typography variant="body2">
                      {entry.name}: {entry.value}%
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Transactions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Recent Transactions
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate('/transactions')}
                >
                  View All
                </Button>
              </Box>
              {recentTransactions.length === 0 ? (
                <Typography color="textSecondary" textAlign="center" py={2}>
                  No transactions yet
                </Typography>
              ) : (
                recentTransactions.map((transaction) => (
                  <Box
                    key={transaction._id}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    py={1}
                    borderBottom="1px solid #eee"
                  >
                    <Box display="flex" alignItems="center">
                      <Avatar
                        sx={{
                          bgcolor: transaction.type === 'credit' ? 'success.main' : 'error.main',
                          width: 32,
                          height: 32,
                          mr: 2
                        }}
                      >
                        {transaction.type === 'credit' ? <ArrowDownward /> : <ArrowUpward />}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {transaction.description}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      color={transaction.type === 'credit' ? 'success.main' : 'error.main'}
                    >
                      {transaction.type === 'credit' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<MonetizationOn />}
                    onClick={() => navigate('/generate')}
                    sx={{ mb: 1 }}
                  >
                    Generate Money
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Payment />}
                    onClick={() => navigate('/payments')}
                    sx={{ mb: 1 }}
                  >
                    Make Payment
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<AccountBalanceWallet />}
                    onClick={() => navigate('/wallet')}
                  >
                    View Wallet
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<VerifiedUser />}
                    onClick={() => navigate('/kyc')}
                    disabled={kycStatus?.status === 'approved'}
                  >
                    {kycStatus?.status === 'approved' ? 'KYC Complete' : 'Complete KYC'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;

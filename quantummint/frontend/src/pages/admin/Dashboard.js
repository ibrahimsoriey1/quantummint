import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Button,
  Chip
} from '@mui/material';
import {
  People as PeopleIcon,
  AccountBalanceWallet as WalletIcon,
  Paid as PaidIcon,
  MonetizationOn as CashOutIcon,
  VerifiedUser as KYCIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { 
  getDashboardStats, 
  getRecentUsers, 
  getRecentTransactions, 
  getRecentKYCVerifications 
} from '../../store/slices/adminSlice';
import PageTitle from '../../components/common/PageTitle';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Format currency with symbol
const formatCurrency = (amount, currency = 'USD') => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  });
  return formatter.format(amount);
};

// Format date
const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

// Format time
const formatTime = (dateString) => {
  const options = { hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleTimeString('en-US', options);
};

const AdminDashboard = () => {
  const dispatch = useDispatch();
  const { 
    stats, 
    recentUsers, 
    recentTransactions, 
    recentKYCVerifications, 
    loading, 
    error 
  } = useSelector((state) => state.admin);

  useEffect(() => {
    dispatch(getDashboardStats());
    dispatch(getRecentUsers());
    dispatch(getRecentTransactions());
    dispatch(getRecentKYCVerifications());
  }, [dispatch]);

  // Handle refresh
  const handleRefresh = () => {
    dispatch(getDashboardStats());
    dispatch(getRecentUsers());
    dispatch(getRecentTransactions());
    dispatch(getRecentKYCVerifications());
  };

  // Get transaction status chip
  const getTransactionStatusChip = (status) => {
    switch (status) {
      case 'completed':
        return <Chip size="small" label="Completed" color="success" />;
      case 'pending':
        return <Chip size="small" label="Pending" color="warning" />;
      case 'processing':
        return <Chip size="small" label="Processing" color="info" />;
      case 'failed':
        return <Chip size="small" label="Failed" color="error" />;
      case 'cancelled':
        return <Chip size="small" label="Cancelled" color="default" />;
      default:
        return null;
    }
  };

  // Get KYC status chip
  const getKYCStatusChip = (status) => {
    switch (status) {
      case 'verified':
        return <Chip size="small" label="Verified" color="success" />;
      case 'pending':
        return <Chip size="small" label="Pending" color="warning" />;
      case 'rejected':
        return <Chip size="small" label="Rejected" color="error" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <PageTitle title="Admin Dashboard" />
        <Tooltip title="Refresh Data">
          <IconButton onClick={handleRefresh} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Users
                  </Typography>
                  <Typography variant="h4">
                    {loading ? <CircularProgress size={24} /> : stats?.totalUsers || 0}
                  </Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center' }}>
                  <TrendingUpIcon fontSize="small" sx={{ mr: 0.5 }} />
                  {stats?.newUsersToday || 0} today
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Wallets
                  </Typography>
                  <Typography variant="h4">
                    {loading ? <CircularProgress size={24} /> : stats?.totalWallets || 0}
                  </Typography>
                </Box>
                <WalletIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {formatCurrency(stats?.totalBalance || 0)} total balance
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Transactions
                  </Typography>
                  <Typography variant="h4">
                    {loading ? <CircularProgress size={24} /> : stats?.totalTransactions || 0}
                  </Typography>
                </Box>
                <PaidIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="success.main">
                  {formatCurrency(stats?.transactionVolumeToday || 0)} today
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Pending KYC
                  </Typography>
                  <Typography variant="h4">
                    {loading ? <CircularProgress size={24} /> : stats?.pendingKYC || 0}
                  </Typography>
                </Box>
                <KYCIcon sx={{ fontSize: 40, color: 'warning.main', opacity: 0.7 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {stats?.verifiedKYC || 0} verified, {stats?.rejectedKYC || 0} rejected
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={3}>
        {/* Recent Users */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 0, height: '100%' }}>
            <CardHeader
              title="Recent Users"
              action={
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                  component="a"
                  href="/admin/users"
                >
                  View All
                </Button>
              }
            />
            <Divider />
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <LoadingSpinner />
              </Box>
            ) : recentUsers.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No recent users found
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {recentUsers.map((user) => (
                  <React.Fragment key={user.userId}>
                    <ListItem
                      secondaryAction={
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(user.createdAt)}
                        </Typography>
                      }
                    >
                      <ListItemIcon>
                        <PeopleIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${user.firstName} ${user.lastName}`}
                        secondary={user.email}
                      />
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Recent Transactions */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 0, height: '100%' }}>
            <CardHeader
              title="Recent Transactions"
              action={
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                  component="a"
                  href="/admin/transactions"
                >
                  View All
                </Button>
              }
            />
            <Divider />
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <LoadingSpinner />
              </Box>
            ) : recentTransactions.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No recent transactions found
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {recentTransactions.map((transaction) => (
                  <React.Fragment key={transaction.transactionId}>
                    <ListItem
                      secondaryAction={
                        getTransactionStatusChip(transaction.status)
                      }
                    >
                      <ListItemIcon>
                        {transaction.transactionType === 'generation' ? (
                          <PaidIcon color="success" />
                        ) : transaction.transactionType === 'cash_out' ? (
                          <CashOutIcon color="error" />
                        ) : (
                          <PaidIcon />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={formatCurrency(transaction.amount, transaction.currency)}
                        secondary={
                          <>
                            {transaction.transactionType.charAt(0).toUpperCase() + transaction.transactionType.slice(1).replace('_', ' ')}
                            <br />
                            {formatDate(transaction.createdAt)} {formatTime(transaction.createdAt)}
                          </>
                        }
                      />
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Recent KYC Verifications */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 0, height: '100%' }}>
            <CardHeader
              title="Pending KYC Verifications"
              action={
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                  component="a"
                  href="/admin/kyc"
                >
                  View All
                </Button>
              }
            />
            <Divider />
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <LoadingSpinner />
              </Box>
            ) : recentKYCVerifications.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No pending KYC verifications
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {recentKYCVerifications.map((verification) => (
                  <React.Fragment key={verification.verificationId}>
                    <ListItem
                      secondaryAction={
                        getKYCStatusChip(verification.verificationStatus)
                      }
                    >
                      <ListItemIcon>
                        <KYCIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${verification.user.firstName} ${verification.user.lastName}`}
                        secondary={
                          <>
                            {verification.documentType.replace('_', ' ')}
                            <br />
                            {formatDate(verification.createdAt)}
                          </>
                        }
                      />
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* System Health */}
      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Health
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      API Gateway
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: 'success.main',
                          mr: 1
                        }}
                      />
                      <Typography variant="body1">Operational</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Auth Service
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: 'success.main',
                          mr: 1
                        }}
                      />
                      <Typography variant="body1">Operational</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Transaction Service
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: 'success.main',
                          mr: 1
                        }}
                      />
                      <Typography variant="body1">Operational</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Payment Integration
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: 'success.main',
                          mr: 1
                        }}
                      />
                      <Typography variant="body1">Operational</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </>
  );
};

export default AdminDashboard;
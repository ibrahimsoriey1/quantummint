import React, { useState, useEffect } from 'react';
import {
  Grid,
  Typography,
  Card,
  CardContent,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  Dashboard,
  People,
  CheckCircle,
  AttachMoney,
  Schedule
} from '@mui/icons-material';

const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async() => {
    try {
      setLoading(true);

      // Mock dashboard data
      const mockData = {
        stats: {
          totalUsers: 1247,
          activeUsers: 892,
          totalTransactions: 5634,
          totalVolume: 2847392.50,
          pendingKYC: 23,
          systemHealth: 98.5
        },
        recentUsers: [
          {
            id: 'user_1',
            name: 'John Doe',
            email: 'john@example.com',
            status: 'active',
            kycStatus: 'verified',
            joinedAt: '2024-01-15T10:30:00Z'
          },
          {
            id: 'user_2',
            name: 'Jane Smith',
            email: 'jane@example.com',
            status: 'active',
            kycStatus: 'pending',
            joinedAt: '2024-01-14T15:45:00Z'
          },
          {
            id: 'user_3',
            name: 'Bob Johnson',
            email: 'bob@example.com',
            status: 'suspended',
            kycStatus: 'rejected',
            joinedAt: '2024-01-13T09:15:00Z'
          }
        ],
        recentTransactions: [
          {
            id: 'txn_1',
            userId: 'user_1',
            type: 'generation',
            amount: 100.00,
            currency: 'USD',
            status: 'completed',
            createdAt: '2024-01-15T14:30:00Z'
          },
          {
            id: 'txn_2',
            userId: 'user_2',
            type: 'transfer',
            amount: 50.00,
            currency: 'EUR',
            status: 'pending',
            createdAt: '2024-01-15T13:45:00Z'
          },
          {
            id: 'txn_3',
            userId: 'user_3',
            type: 'payment',
            amount: 25.00,
            currency: 'USD',
            status: 'failed',
            createdAt: '2024-01-15T12:15:00Z'
          }
        ],
        systemAlerts: [
          {
            id: 'alert_1',
            type: 'warning',
            message: 'High transaction volume detected',
            timestamp: '2024-01-15T14:00:00Z'
          },
          {
            id: 'alert_2',
            type: 'info',
            message: 'System maintenance scheduled for tonight',
            timestamp: '2024-01-15T10:00:00Z'
          }
        ]
      };

      setDashboardData(mockData);
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
    case 'active':
    case 'completed':
    case 'verified':
      return 'success';
    case 'pending':
      return 'warning';
    case 'suspended':
    case 'failed':
    case 'rejected':
      return 'error';
    default:
      return 'default';
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Dashboard />
        Admin Dashboard
      </Typography>

      {/* System Alerts */}
      {dashboardData.systemAlerts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {dashboardData.systemAlerts.map((alert) => (
            <Alert
              key={alert.id}
              severity={alert.type}
              sx={{ mb: 1 }}
            >
              {alert.message} - {formatDate(alert.timestamp)}
            </Alert>
          ))}
        </Box>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Users
                  </Typography>
                  <Typography variant="h4">
                    {dashboardData.stats.totalUsers.toLocaleString()}
                  </Typography>
                </Box>
                <People sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Users
                  </Typography>
                  <Typography variant="h4">
                    {dashboardData.stats.activeUsers.toLocaleString()}
                  </Typography>
                </Box>
                <CheckCircle sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Volume
                  </Typography>
                  <Typography variant="h4">
                    {formatCurrency(dashboardData.stats.totalVolume)}
                  </Typography>
                </Box>
                <AttachMoney sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Pending KYC
                  </Typography>
                  <Typography variant="h4">
                    {dashboardData.stats.pendingKYC}
                  </Typography>
                </Box>
                <Schedule sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* System Health */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            System Health
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <LinearProgress
              variant="determinate"
              value={dashboardData.stats.systemHealth}
              sx={{ flexGrow: 1, height: 10, borderRadius: 5 }}
            />
            <Typography variant="body2" fontWeight="bold">
              {dashboardData.stats.systemHealth}%
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Recent Users */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Users
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>KYC</TableCell>
                      <TableCell>Joined</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboardData.recentUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {user.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {user.email}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={user.status}
                            color={getStatusColor(user.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={user.kycStatus}
                            color={getStatusColor(user.kycStatus)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {formatDate(user.joinedAt)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Transactions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Transactions
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboardData.recentTransactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {txn.type}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(txn.amount, txn.currency)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={txn.status}
                            color={getStatusColor(txn.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {formatDate(txn.createdAt)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;

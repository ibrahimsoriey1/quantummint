import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  InputAdornment,
  Pagination,
  CircularProgress,
  Avatar,
  Alert,
  Card,
  CardContent
} from '@mui/material';
import {
  MoreVert,
  Search,
  Edit,
  Block,
  CheckCircle,
  Delete,
  Visibility,
  PersonAdd,
  People
} from '@mui/icons-material';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [kycFilter, setKycFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [page, statusFilter, kycFilter]);

  const fetchUsers = async() => {
    try {
      setLoading(true);

      // Mock user data
      const mockUsers = [
        {
          id: 'user_1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1234567890',
          status: 'active',
          kycStatus: 'verified',
          role: 'user',
          joinedAt: '2024-01-15T10:30:00Z',
          lastLogin: '2024-01-15T14:30:00Z',
          totalTransactions: 25,
          walletBalance: 1250.50
        },
        {
          id: 'user_2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          phone: '+1234567891',
          status: 'active',
          kycStatus: 'pending',
          role: 'user',
          joinedAt: '2024-01-14T15:45:00Z',
          lastLogin: '2024-01-14T16:00:00Z',
          totalTransactions: 12,
          walletBalance: 750.25
        },
        {
          id: 'user_3',
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob.johnson@example.com',
          phone: '+1234567892',
          status: 'suspended',
          kycStatus: 'rejected',
          role: 'user',
          joinedAt: '2024-01-13T09:15:00Z',
          lastLogin: '2024-01-13T10:00:00Z',
          totalTransactions: 5,
          walletBalance: 100.00
        },
        {
          id: 'user_4',
          firstName: 'Alice',
          lastName: 'Wilson',
          email: 'alice.wilson@example.com',
          phone: '+1234567893',
          status: 'active',
          kycStatus: 'verified',
          role: 'admin',
          joinedAt: '2024-01-10T08:00:00Z',
          lastLogin: '2024-01-15T09:00:00Z',
          totalTransactions: 150,
          walletBalance: 5000.00
        }
      ];

      setUsers(mockUsers);
      setTotalPages(1);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
    case 'active':
    case 'verified':
      return 'success';
    case 'pending':
      return 'warning';
    case 'suspended':
    case 'rejected':
      return 'error';
    default:
      return 'default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesKyc = kycFilter === 'all' || user.kycStatus === kycFilter;
    return matchesSearch && matchesStatus && matchesKyc;
  });

  const handleActionClick = (event, user) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedUser(user);
  };

  const handleActionClose = () => {
    setActionMenuAnchor(null);
    setSelectedUser(null);
  };

  const handleUserAction = (action) => {
    setDialogType(action);
    setDialogOpen(true);
    handleActionClose();
  };

  const executeUserAction = async() => {
    try {
      // Mock API calls
      await new Promise(resolve => setTimeout(resolve, 1000));

      switch (dialogType) {
      case 'suspend':
        setUsers(prev => prev.map(u =>
          u.id === selectedUser.id ? { ...u, status: 'suspended' } : u
        ));
        break;
      case 'activate':
        setUsers(prev => prev.map(u =>
          u.id === selectedUser.id ? { ...u, status: 'active' } : u
        ));
        break;
      case 'delete':
        setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
        break;
      default:
        break;
      }

      setDialogOpen(false);
      setSelectedUser(null);
    } catch (err) {
      setError('Failed to perform action');
    }
  };

  const getDialogContent = () => {
    switch (dialogType) {
    case 'suspend':
      return {
        title: 'Suspend User',
        content: `Are you sure you want to suspend ${selectedUser?.firstName} ${selectedUser?.lastName}? They will not be able to access their account.`,
        action: 'Suspend'
      };
    case 'activate':
      return {
        title: 'Activate User',
        content: `Are you sure you want to activate ${selectedUser?.firstName} ${selectedUser?.lastName}? They will regain access to their account.`,
        action: 'Activate'
      };
    case 'delete':
      return {
        title: 'Delete User',
        content: `Are you sure you want to delete ${selectedUser?.firstName} ${selectedUser?.lastName}? This action cannot be undone.`,
        action: 'Delete'
      };
    default:
      return { title: '', content: '', action: '' };
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <People />
        User Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>

            <Grid item xs={12} sm={3} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3} md={2}>
              <FormControl fullWidth>
                <InputLabel>KYC Status</InputLabel>
                <Select
                  value={kycFilter}
                  onChange={(e) => setKycFilter(e.target.value)}
                  label="KYC Status"
                >
                  <MenuItem value="all">All KYC</MenuItem>
                  <MenuItem value="verified">Verified</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={12} md={4}>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<PersonAdd />}
                >
                  Add User
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>KYC</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Transactions</TableCell>
                      <TableCell>Balance</TableCell>
                      <TableCell>Last Login</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No users found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar>
                                {user.firstName[0]}{user.lastName[0]}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {user.firstName} {user.lastName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ID: {user.id}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">
                                {user.email}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {user.phone}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={user.status.toUpperCase()}
                              color={getStatusColor(user.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={user.kycStatus.toUpperCase()}
                              color={getStatusColor(user.kycStatus)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {user.role}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {user.totalTransactions}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(user.walletBalance)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDate(user.lastLogin)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <IconButton
                              onClick={(e) => handleActionClick(e, user)}
                            >
                              <MoreVert />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(e, newPage) => setPage(newPage)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionClose}
      >
        <MenuItem onClick={() => handleUserAction('view')}>
          <Visibility sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem onClick={() => handleUserAction('edit')}>
          <Edit sx={{ mr: 1 }} />
          Edit User
        </MenuItem>
        {selectedUser?.status === 'active' ? (
          <MenuItem onClick={() => handleUserAction('suspend')}>
            <Block sx={{ mr: 1 }} />
            Suspend User
          </MenuItem>
        ) : (
          <MenuItem onClick={() => handleUserAction('activate')}>
            <CheckCircle sx={{ mr: 1 }} />
            Activate User
          </MenuItem>
        )}
        <MenuItem onClick={() => handleUserAction('delete')} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} />
          Delete User
        </MenuItem>
      </Menu>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>
          {getDialogContent().title}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {getDialogContent().content}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={dialogType === 'delete' ? 'error' : 'primary'}
            onClick={executeUserAction}
          >
            {getDialogContent().action}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;

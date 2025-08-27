import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Tooltip,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Divider,
  Alert,
  Switch,
  FormControlLabel,
  Tab,
  Tabs,
  Avatar
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  VerifiedUser as VerifiedUserIcon,
  Email as EmailIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { 
  getUsers, 
  getUserDetails, 
  updateUserStatus, 
  deleteUser, 
  clearError, 
  clearMessage 
} from '../../store/slices/adminSlice';
import PageTitle from '../../components/common/PageTitle';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Format date
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

const AdminUsers = () => {
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: '',
    kycStatus: '',
    page: 0,
    limit: 10
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const dispatch = useDispatch();
  const { users, userDetails, pagination, loading, error, message } = useSelector((state) => state.admin);

  // Fetch users on component mount
  useEffect(() => {
    dispatch(getUsers(filters));
  }, [dispatch]);

  // Handle filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value,
      page: 0 // Reset to first page when filters change
    });
  };

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setFilters({
      ...filters,
      page: newPage
    });
    dispatch(getUsers({ ...filters, page: newPage }));
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (event) => {
    const newLimit = parseInt(event.target.value, 10);
    setFilters({
      ...filters,
      limit: newLimit,
      page: 0
    });
    dispatch(getUsers({ ...filters, limit: newLimit, page: 0 }));
  };

  // Apply filters
  const applyFilters = () => {
    dispatch(getUsers(filters));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      search: '',
      role: '',
      status: '',
      kycStatus: '',
      page: 0,
      limit: 10
    });
    dispatch(getUsers({
      page: 0,
      limit: 10
    }));
  };

  // Handle user click
  const handleUserClick = (userId) => {
    dispatch(getUserDetails(userId))
      .unwrap()
      .then(() => {
        setUserDialogOpen(true);
      })
      .catch((err) => {
        console.error('Error fetching user details:', err);
      });
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Handle user status change
  const handleStatusChange = (userId, newStatus) => {
    setSelectedUser(userId);
    setConfirmAction({
      type: 'status',
      status: newStatus,
      message: `Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} this user?`
    });
    setConfirmDialogOpen(true);
  };

  // Handle user delete
  const handleDeleteUser = (userId) => {
    setSelectedUser(userId);
    setConfirmAction({
      type: 'delete',
      message: 'Are you sure you want to delete this user? This action cannot be undone.'
    });
    setConfirmDialogOpen(true);
  };

  // Confirm action
  const confirmActionHandler = () => {
    if (confirmAction.type === 'status') {
      dispatch(updateUserStatus({ userId: selectedUser, status: confirmAction.status }))
        .unwrap()
        .then(() => {
          dispatch(getUsers(filters));
          if (userDialogOpen) {
            dispatch(getUserDetails(selectedUser));
          }
        })
        .catch((err) => {
          console.error('Error updating user status:', err);
        });
    } else if (confirmAction.type === 'delete') {
      dispatch(deleteUser(selectedUser))
        .unwrap()
        .then(() => {
          dispatch(getUsers(filters));
          if (userDialogOpen) {
            setUserDialogOpen(false);
          }
        })
        .catch((err) => {
          console.error('Error deleting user:', err);
        });
    }
    
    setConfirmDialogOpen(false);
    setConfirmAction(null);
    setSelectedUser(null);
  };

  // Get user status chip
  const getUserStatusChip = (status) => {
    switch (status) {
      case 'active':
        return <Chip size="small" label="Active" color="success" />;
      case 'inactive':
        return <Chip size="small" label="Inactive" color="default" />;
      case 'suspended':
        return <Chip size="small" label="Suspended" color="error" />;
      case 'pending':
        return <Chip size="small" label="Pending" color="warning" />;
      default:
        return null;
    }
  };

  // Get KYC status chip
  const getKYCStatusChip = (status) => {
    switch (status) {
      case 'verified':
        return <Chip size="small" label="Verified" color="success" icon={<VerifiedUserIcon />} />;
      case 'pending':
        return <Chip size="small" label="Pending" color="warning" />;
      case 'rejected':
        return <Chip size="small" label="Rejected" color="error" />;
      case 'not_submitted':
        return <Chip size="small" label="Not Submitted" color="default" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <PageTitle title="User Management" />
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={applyFilters} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle Filters">
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              <FilterListIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {message && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      {/* Filters */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Search"
                name="search"
                fullWidth
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Name, Email, or ID"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Role"
                name="role"
                fullWidth
                value={filters.role}
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Roles</MenuItem>
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                label="Status"
                name="status"
                fullWidth
                value={filters.status}
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                label="KYC Status"
                name="kycStatus"
                fullWidth
                value={filters.kycStatus}
                onChange={handleFilterChange}
              >
                <MenuItem value="">All KYC Statuses</MenuItem>
                <MenuItem value="verified">Verified</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
                <MenuItem value="not_submitted">Not Submitted</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Button
                variant="contained"
                color="primary"
                onClick={applyFilters}
                disabled={loading}
                startIcon={loading ? <LoadingSpinner size={20} /> : <SearchIcon />}
                fullWidth
              >
                Filter
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Button
                variant="outlined"
                onClick={resetFilters}
                disabled={loading}
                fullWidth
              >
                Reset
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Users Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Registered</TableCell>
                <TableCell align="center">KYC Status</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <LoadingSpinner />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary">
                        No users found
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow 
                    key={user.userId}
                    hover
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell onClick={() => handleUserClick(user.userId)}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2, bgcolor: user.status === 'active' ? 'primary.main' : 'text.disabled' }}>
                          {user.firstName ? user.firstName[0] : 'U'}
                        </Avatar>
                        <Typography variant="body2">
                          {user.firstName} {user.lastName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell onClick={() => handleUserClick(user.userId)}>
                      <Typography variant="body2">{user.email}</Typography>
                    </TableCell>
                    <TableCell onClick={() => handleUserClick(user.userId)}>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {user.role}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => handleUserClick(user.userId)}>
                      <Typography variant="body2">
                        {formatDate(user.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" onClick={() => handleUserClick(user.userId)}>
                      {getKYCStatusChip(user.kycStatus)}
                    </TableCell>
                    <TableCell align="center" onClick={() => handleUserClick(user.userId)}>
                      {getUserStatusChip(user.status)}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Tooltip title={user.status === 'active' ? 'Deactivate' : 'Activate'}>
                          <IconButton 
                            size="small" 
                            color={user.status === 'active' ? 'error' : 'success'}
                            onClick={() => handleStatusChange(user.userId, user.status === 'active' ? 'inactive' : 'active')}
                          >
                            {user.status === 'active' ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={() => handleDeleteUser(user.userId)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        {!loading && users.length > 0 && pagination && (
          <TablePagination
            component="div"
            count={pagination.totalItems || 0}
            page={filters.page}
            onPageChange={handlePageChange}
            rowsPerPage={filters.limit}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        )}
      </Paper>

      {/* User Details Dialog */}
      <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          User Details
          {userDetails && getUserStatusChip(userDetails.status)}
        </DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <LoadingSpinner />
            </Box>
          ) : userDetails ? (
            <>
              <Box sx={{ mb: 2 }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="user details tabs">
                  <Tab label="Profile" />
                  <Tab label="Wallets" />
                  <Tab label="KYC" />
                  <Tab label="Activity" />
                </Tabs>
              </Box>
              
              {/* Profile Tab */}
              {activeTab === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Avatar 
                          sx={{ 
                            width: 80, 
                            height: 80, 
                            mx: 'auto', 
                            mb: 2,
                            bgcolor: userDetails.status === 'active' ? 'primary.main' : 'text.disabled'
                          }}
                        >
                          {userDetails.firstName ? userDetails.firstName[0] : 'U'}
                        </Avatar>
                        <Typography variant="h6">
                          {userDetails.firstName} {userDetails.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {userDetails.email}
                        </Typography>
                        <Chip 
                          label={userDetails.role} 
                          color={userDetails.role === 'admin' ? 'primary' : 'default'}
                          size="small"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={8}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" gutterBottom>
                          Account Information
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              User ID
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {userDetails.userId}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Status
                            </Typography>
                            <Typography variant="body1" gutterBottom sx={{ textTransform: 'capitalize' }}>
                              {userDetails.status}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Email Verified
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {userDetails.emailVerified ? 'Yes' : 'No'}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Phone Number
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {userDetails.phoneNumber || '-'}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Registered On
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {formatDate(userDetails.createdAt)}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Last Login
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {userDetails.lastLogin ? new Date(userDetails.lastLogin).toLocaleString() : '-'}
                            </Typography>
                          </Grid>
                        </Grid>
                        
                        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
                          Account Actions
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={userDetails.status === 'active'}
                                  onChange={() => handleStatusChange(
                                    userDetails.userId, 
                                    userDetails.status === 'active' ? 'inactive' : 'active'
                                  )}
                                  color="primary"
                                />
                              }
                              label={userDetails.status === 'active' ? 'Active' : 'Inactive'}
                            />
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Button
                              variant="outlined"
                              color="primary"
                              startIcon={<EmailIcon />}
                              fullWidth
                            >
                              Send Email
                            </Button>
                          </Grid>
                          
                          <Grid item xs={12}>
                            <Button
                              variant="outlined"
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={() => handleDeleteUser(userDetails.userId)}
                              fullWidth
                            >
                              Delete User
                            </Button>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
              
              {/* Wallets Tab */}
              {activeTab === 1 && (
                <Box>
                  {userDetails.wallets && userDetails.wallets.length > 0 ? (
                    <Grid container spacing={2}>
                      {userDetails.wallets.map((wallet) => (
                        <Grid item xs={12} sm={6} key={wallet.walletId}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                {wallet.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Wallet ID: {wallet.walletId}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Currency: {wallet.currency}
                              </Typography>
                              <Divider sx={{ my: 1 }} />
                              <Typography variant="h5" color="primary">
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: wallet.currency,
                                  minimumFractionDigits: 2
                                }).format(wallet.balance)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Created: {formatDate(wallet.createdAt)}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                      <WalletIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary">
                        No wallets found for this user
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
              
              {/* KYC Tab */}
              {activeTab === 2 && (
                <Box>
                  {userDetails.kycVerification ? (
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="h6">
                            KYC Verification
                          </Typography>
                          {getKYCStatusChip(userDetails.kycStatus)}
                        </Box>
                        
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Verification ID
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {userDetails.kycVerification.verificationId}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Document Type
                            </Typography>
                            <Typography variant="body1" gutterBottom sx={{ textTransform: 'capitalize' }}>
                              {userDetails.kycVerification.documentType.replace('_', ' ')}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Document Number
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {userDetails.kycVerification.documentNumber}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Document Expiry
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {formatDate(userDetails.kycVerification.documentExpiryDate)}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12}>
                            <Divider sx={{ my: 1 }} />
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Submitted At
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {formatDate(userDetails.kycVerification.createdAt)}
                            </Typography>
                          </Grid>
                          
                          {userDetails.kycVerification.verifiedAt && (
                            <Grid item xs={12} sm={6}>
                              <Typography variant="body2" color="text.secondary">
                                Verified At
                              </Typography>
                              <Typography variant="body1" gutterBottom>
                                {formatDate(userDetails.kycVerification.verifiedAt)}
                              </Typography>
                            </Grid>
                          )}
                          
                          {userDetails.kycVerification.rejectionReason && (
                            <Grid item xs={12}>
                              <Alert severity="error">
                                <Typography variant="subtitle2">Rejection Reason:</Typography>
                                <Typography variant="body2">{userDetails.kycVerification.rejectionReason}</Typography>
                              </Alert>
                            </Grid>
                          )}
                          
                          <Grid item xs={12}>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant="subtitle2" gutterBottom>
                              Document Images
                            </Typography>
                            <Grid container spacing={2}>
                              <Grid item xs={12} sm={4}>
                                <Card variant="outlined">
                                  <CardContent>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                      Document Front
                                    </Typography>
                                    <Box sx={{ height: 150, bgcolor: 'action.hover', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                      <Typography variant="body2" color="text.secondary">
                                        Image Preview
                                      </Typography>
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                              
                              {userDetails.kycVerification.documentBackImage && (
                                <Grid item xs={12} sm={4}>
                                  <Card variant="outlined">
                                    <CardContent>
                                      <Typography variant="body2" color="text.secondary" gutterBottom>
                                        Document Back
                                      </Typography>
                                      <Box sx={{ height: 150, bgcolor: 'action.hover', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <Typography variant="body2" color="text.secondary">
                                          Image Preview
                                        </Typography>
                                      </Box>
                                    </CardContent>
                                  </Card>
                                </Grid>
                              )}
                              
                              <Grid item xs={12} sm={4}>
                                <Card variant="outlined">
                                  <CardContent>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                      Selfie
                                    </Typography>
                                    <Box sx={{ height: 150, bgcolor: 'action.hover', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                      <Typography variant="body2" color="text.secondary">
                                        Image Preview
                                      </Typography>
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            </Grid>
                          </Grid>
                          
                          {userDetails.kycStatus === 'pending' && (
                            <Grid item xs={12} sx={{ mt: 2 }}>
                              <Button
                                variant="contained"
                                color="success"
                                sx={{ mr: 2 }}
                              >
                                Approve Verification
                              </Button>
                              <Button
                                variant="outlined"
                                color="error"
                              >
                                Reject Verification
                              </Button>
                            </Grid>
                          )}
                        </Grid>
                      </CardContent>
                    </Card>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                      <VerifiedUserIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary">
                        No KYC verification submitted
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
              
              {/* Activity Tab */}
              {activeTab === 3 && (
                <Box>
                  {userDetails.recentActivity && userDetails.recentActivity.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Activity</TableCell>
                            <TableCell>Date & Time</TableCell>
                            <TableCell>IP Address</TableCell>
                            <TableCell>Details</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {userDetails.recentActivity.map((activity, index) => (
                            <TableRow key={index}>
                              <TableCell>{activity.type}</TableCell>
                              <TableCell>{new Date(activity.timestamp).toLocaleString()}</TableCell>
                              <TableCell>{activity.ipAddress}</TableCell>
                              <TableCell>{activity.details}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                      <Typography variant="body1" color="text.secondary">
                        No recent activity found
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </>
          ) : (
            <Typography variant="body1" color="text.secondary" align="center">
              User details not found
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            {confirmAction?.message}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={confirmActionHandler} 
            color="primary" 
            variant="contained"
            autoFocus
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdminUsers;
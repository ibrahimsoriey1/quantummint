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
  Tabs,
  Tab,
  Avatar,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  VerifiedUser as VerifiedUserIcon,
  Person as PersonIcon,
  Image as ImageIcon,
  ZoomIn as ZoomInIcon
} from '@mui/icons-material';
import { 
  getKYCVerifications, 
  getKYCDetails, 
  approveKYC, 
  rejectKYC, 
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

// Format time
const formatTime = (dateString) => {
  if (!dateString) return '-';
  const options = { hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleTimeString('en-US', options);
};

const AdminKYC = () => {
  const [filters, setFilters] = useState({
    search: '',
    status: 'pending', // Default to pending verifications
    documentType: '',
    page: 0,
    limit: 10
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState({ url: '', title: '' });
  const [activeTab, setActiveTab] = useState(0);

  const dispatch = useDispatch();
  const { 
    kycVerifications, 
    kycDetails, 
    pagination, 
    loading, 
    error, 
    message 
  } = useSelector((state) => state.admin);

  // Fetch KYC verifications on component mount
  useEffect(() => {
    dispatch(getKYCVerifications(filters));
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
    dispatch(getKYCVerifications({ ...filters, page: newPage }));
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (event) => {
    const newLimit = parseInt(event.target.value, 10);
    setFilters({
      ...filters,
      limit: newLimit,
      page: 0
    });
    dispatch(getKYCVerifications({ ...filters, limit: newLimit, page: 0 }));
  };

  // Apply filters
  const applyFilters = () => {
    dispatch(getKYCVerifications(filters));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      search: '',
      status: 'pending',
      documentType: '',
      page: 0,
      limit: 10
    });
    dispatch(getKYCVerifications({
      status: 'pending',
      page: 0,
      limit: 10
    }));
  };

  // Handle verification click
  const handleVerificationClick = (verificationId) => {
    dispatch(getKYCDetails(verificationId))
      .unwrap()
      .then(() => {
        setVerificationDialogOpen(true);
      })
      .catch((err) => {
        console.error('Error fetching KYC details:', err);
      });
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Handle approve KYC
  const handleApproveKYC = () => {
    dispatch(approveKYC(kycDetails.verificationId))
      .unwrap()
      .then(() => {
        setVerificationDialogOpen(false);
        dispatch(getKYCVerifications(filters));
      })
      .catch((err) => {
        console.error('Error approving KYC:', err);
      });
  };

  // Handle reject KYC dialog open
  const handleRejectDialogOpen = () => {
    setRejectDialogOpen(true);
  };

  // Handle reject KYC
  const handleRejectKYC = () => {
    if (!rejectionReason.trim()) {
      return;
    }
    
    dispatch(rejectKYC({
      verificationId: kycDetails.verificationId,
      rejectionReason: rejectionReason
    }))
      .unwrap()
      .then(() => {
        setRejectDialogOpen(false);
        setVerificationDialogOpen(false);
        setRejectionReason('');
        dispatch(getKYCVerifications(filters));
      })
      .catch((err) => {
        console.error('Error rejecting KYC:', err);
      });
  };

  // Handle image click
  const handleImageClick = (url, title) => {
    setCurrentImage({ url, title });
    setImageDialogOpen(true);
  };

  // Get KYC status chip
  const getKYCStatusChip = (status) => {
    switch (status) {
      case 'verified':
        return <Chip size="small" label="Verified" color="success" icon={<CheckCircleIcon />} />;
      case 'pending':
        return <Chip size="small" label="Pending" color="warning" />;
      case 'rejected':
        return <Chip size="small" label="Rejected" color="error" />;
      default:
        return null;
    }
  };

  // Format document type
  const formatDocumentType = (type) => {
    if (!type) return '-';
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <PageTitle title="KYC Verification Management" />
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
                placeholder="User Name, Email, or ID"
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
                label="Status"
                name="status"
                fullWidth
                value={filters.status}
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="verified">Verified</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                label="Document Type"
                name="documentType"
                fullWidth
                value={filters.documentType}
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="passport">Passport</MenuItem>
                <MenuItem value="national_id">National ID</MenuItem>
                <MenuItem value="drivers_license">Driver's License</MenuItem>
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
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                onClick={resetFilters}
                disabled={loading}
                fullWidth
              >
                Reset Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* KYC Verifications Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Document Type</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Document Number</TableCell>
                <TableCell>Expiry Date</TableCell>
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
              ) : kycVerifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <VerifiedUserIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body1" color="text.secondary">
                        No KYC verifications found
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                kycVerifications.map((verification) => (
                  <TableRow 
                    key={verification.verificationId}
                    hover
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell onClick={() => handleVerificationClick(verification.verificationId)}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2 }}>
                          {verification.user.firstName ? verification.user.firstName[0] : 'U'}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">
                            {verification.user.firstName} {verification.user.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {verification.user.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell onClick={() => handleVerificationClick(verification.verificationId)}>
                      <Typography variant="body2">
                        {formatDocumentType(verification.documentType)}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => handleVerificationClick(verification.verificationId)}>
                      <Typography variant="body2">
                        {formatDate(verification.createdAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(verification.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => handleVerificationClick(verification.verificationId)}>
                      <Typography variant="body2">
                        {verification.documentNumber}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => handleVerificationClick(verification.verificationId)}>
                      <Typography variant="body2">
                        {formatDate(verification.documentExpiryDate)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" onClick={() => handleVerificationClick(verification.verificationId)}>
                      {getKYCStatusChip(verification.verificationStatus)}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        {verification.verificationStatus === 'pending' && (
                          <>
                            <Tooltip title="Approve">
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVerificationClick(verification.verificationId);
                                }}
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVerificationClick(verification.verificationId);
                                }}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => handleVerificationClick(verification.verificationId)}
                          >
                            <ZoomInIcon fontSize="small" />
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
        {!loading && kycVerifications.length > 0 && pagination && (
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

      {/* KYC Verification Details Dialog */}
      <Dialog open={verificationDialogOpen} onClose={() => setVerificationDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          KYC Verification Details
          {kycDetails && getKYCStatusChip(kycDetails.verificationStatus)}
        </DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <LoadingSpinner />
            </Box>
          ) : kycDetails ? (
            <>
              <Box sx={{ mb: 2 }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="kyc details tabs">
                  <Tab label="User Information" />
                  <Tab label="Document Details" />
                  <Tab label="Document Images" />
                </Tabs>
              </Box>
              
              {/* User Information Tab */}
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
                            bgcolor: 'primary.main'
                          }}
                        >
                          {kycDetails.user?.firstName ? kycDetails.user.firstName[0] : 'U'}
                        </Avatar>
                        <Typography variant="h6">
                          {kycDetails.user?.firstName} {kycDetails.user?.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {kycDetails.user?.email}
                        </Typography>
                        <Chip 
                          label={kycDetails.user?.role} 
                          color={kycDetails.user?.role === 'admin' ? 'primary' : 'default'}
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
                          User Information
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              User ID
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {kycDetails.user?.userId}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Status
                            </Typography>
                            <Typography variant="body1" gutterBottom sx={{ textTransform: 'capitalize' }}>
                              {kycDetails.user?.status}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Email Verified
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {kycDetails.user?.emailVerified ? 'Yes' : 'No'}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Phone Number
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {kycDetails.user?.phoneNumber || '-'}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Registered On
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {formatDate(kycDetails.user?.createdAt)}
                            </Typography>
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <Typography variant="body2" color="text.secondary">
                              Last Login
                            </Typography>
                            <Typography variant="body1" gutterBottom>
                              {kycDetails.user?.lastLogin ? new Date(kycDetails.user.lastLogin).toLocaleString() : '-'}
                            </Typography>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
              
              {/* Document Details Tab */}
              {activeTab === 1 && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Verification Information
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Verification ID
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {kycDetails.verificationId}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Box>
                          {getKYCStatusChip(kycDetails.verificationStatus)}
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Verification Type
                        </Typography>
                        <Typography variant="body1" gutterBottom sx={{ textTransform: 'capitalize' }}>
                          {kycDetails.verificationType === 'identity' ? 'Identity Verification' : 
                           kycDetails.verificationType === 'address' ? 'Address Verification' : 
                           'Both Identity & Address'}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Document Type
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {formatDocumentType(kycDetails.documentType)}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Document Number
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {kycDetails.documentNumber}
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Document Expiry Date
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                          {formatDate(kycDetails.documentExpiryDate)}
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
                          {formatDate(kycDetails.createdAt)} {formatTime(kycDetails.createdAt)}
                        </Typography>
                      </Grid>
                      
                      {kycDetails.verifiedAt && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            Verified At
                          </Typography>
                          <Typography variant="body1" gutterBottom>
                            {formatDate(kycDetails.verifiedAt)} {formatTime(kycDetails.verifiedAt)}
                          </Typography>
                        </Grid>
                      )}
                      
                      {kycDetails.verifiedBy && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">
                            Verified By
                          </Typography>
                          <Typography variant="body1" gutterBottom>
                            {kycDetails.verifiedBy}
                          </Typography>
                        </Grid>
                      )}
                      
                      {kycDetails.rejectionReason && (
                        <Grid item xs={12}>
                          <Alert severity="error" sx={{ mt: 1 }}>
                            <Typography variant="subtitle2">Rejection Reason:</Typography>
                            <Typography variant="body2">{kycDetails.rejectionReason}</Typography>
                          </Alert>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              )}
              
              {/* Document Images Tab */}
              {activeTab === 2 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" gutterBottom>
                          Document Front
                        </Typography>
                        <Box 
                          sx={{ 
                            height: 200, 
                            bgcolor: 'action.hover', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            cursor: 'pointer',
                            position: 'relative',
                            '&:hover': {
                              '& .zoom-icon': {
                                opacity: 1
                              }
                            }
                          }}
                          onClick={() => handleImageClick(kycDetails.documentFrontImage, 'Document Front')}
                        >
                          {kycDetails.documentFrontImage ? (
                            <>
                              <img 
                                src={kycDetails.documentFrontImage} 
                                alt="Document Front" 
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                              />
                              <Box 
                                className="zoom-icon"
                                sx={{ 
                                  position: 'absolute', 
                                  top: 0, 
                                  left: 0, 
                                  right: 0, 
                                  bottom: 0, 
                                  display: 'flex', 
                                  justifyContent: 'center', 
                                  alignItems: 'center',
                                  bgcolor: 'rgba(0,0,0,0.5)',
                                  opacity: 0,
                                  transition: 'opacity 0.2s'
                                }}
                              >
                                <ZoomInIcon sx={{ color: 'white', fontSize: 40 }} />
                              </Box>
                            </>
                          ) : (
                            <Box sx={{ textAlign: 'center' }}>
                              <ImageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                              <Typography variant="body2" color="text.secondary">
                                Image not available
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  {kycDetails.documentType !== 'passport' && (
                    <Grid item xs={12} sm={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            Document Back
                          </Typography>
                          <Box 
                            sx={{ 
                              height: 200, 
                              bgcolor: 'action.hover', 
                              display: 'flex', 
                              justifyContent: 'center', 
                              alignItems: 'center',
                              cursor: 'pointer',
                              position: 'relative',
                              '&:hover': {
                                '& .zoom-icon': {
                                  opacity: 1
                                }
                              }
                            }}
                            onClick={() => handleImageClick(kycDetails.documentBackImage, 'Document Back')}
                          >
                            {kycDetails.documentBackImage ? (
                              <>
                                <img 
                                  src={kycDetails.documentBackImage} 
                                  alt="Document Back" 
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                />
                                <Box 
                                  className="zoom-icon"
                                  sx={{ 
                                    position: 'absolute', 
                                    top: 0, 
                                    left: 0, 
                                    right: 0, 
                                    bottom: 0, 
                                    display: 'flex', 
                                    justifyContent: 'center', 
                                    alignItems: 'center',
                                    bgcolor: 'rgba(0,0,0,0.5)',
                                    opacity: 0,
                                    transition: 'opacity 0.2s'
                                  }}
                                >
                                  <ZoomInIcon sx={{ color: 'white', fontSize: 40 }} />
                                </Box>
                              </>
                            ) : (
                              <Box sx={{ textAlign: 'center' }}>
                                <ImageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                  Image not available
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  
                  <Grid item xs={12} sm={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1" gutterBottom>
                          Selfie with Document
                        </Typography>
                        <Box 
                          sx={{ 
                            height: 200, 
                            bgcolor: 'action.hover', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            cursor: 'pointer',
                            position: 'relative',
                            '&:hover': {
                              '& .zoom-icon': {
                                opacity: 1
                              }
                            }
                          }}
                          onClick={() => handleImageClick(kycDetails.selfieImage, 'Selfie with Document')}
                        >
                          {kycDetails.selfieImage ? (
                            <>
                              <img 
                                src={kycDetails.selfieImage} 
                                alt="Selfie" 
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                              />
                              <Box 
                                className="zoom-icon"
                                sx={{ 
                                  position: 'absolute', 
                                  top: 0, 
                                  left: 0, 
                                  right: 0, 
                                  bottom: 0, 
                                  display: 'flex', 
                                  justifyContent: 'center', 
                                  alignItems: 'center',
                                  bgcolor: 'rgba(0,0,0,0.5)',
                                  opacity: 0,
                                  transition: 'opacity 0.2s'
                                }}
                              >
                                <ZoomInIcon sx={{ color: 'white', fontSize: 40 }} />
                              </Box>
                            </>
                          ) : (
                            <Box sx={{ textAlign: 'center' }}>
                              <ImageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                              <Typography variant="body2" color="text.secondary">
                                Image not available
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
              
              {/* Verification Process */}
              {kycDetails.verificationStatus === 'pending' && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Verification Process
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Stepper activeStep={1} sx={{ mb: 3 }}>
                    <Step>
                      <StepLabel>Submitted</StepLabel>
                    </Step>
                    <Step>
                      <StepLabel>Under Review</StepLabel>
                    </Step>
                    <Step>
                      <StepLabel>Decision</StepLabel>
                    </Step>
                  </Stepper>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleApproveKYC}
                      sx={{ mr: 2 }}
                      startIcon={<CheckCircleIcon />}
                    >
                      Approve Verification
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={handleRejectDialogOpen}
                      startIcon={<CancelIcon />}
                    >
                      Reject Verification
                    </Button>
                  </Box>
                </Box>
              )}
            </>
          ) : (
            <Typography variant="body1" color="text.secondary" align="center">
              Verification details not found
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerificationDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Reject KYC Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)}>
        <DialogTitle>Reject KYC Verification</DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            Please provide a reason for rejecting this KYC verification. This reason will be visible to the user.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Rejection Reason"
            fullWidth
            multiline
            rows={4}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            error={rejectionReason.trim() === ''}
            helperText={rejectionReason.trim() === '' ? 'Rejection reason is required' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleRejectKYC} 
            color="error" 
            variant="contained"
            disabled={rejectionReason.trim() === ''}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={imageDialogOpen} onClose={() => setImageDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{currentImage.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            {currentImage.url ? (
              <img 
                src={currentImage.url} 
                alt={currentImage.title} 
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <ImageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  Image not available
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdminKYC;
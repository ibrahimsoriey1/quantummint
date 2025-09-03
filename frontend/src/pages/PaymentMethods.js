import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import {
  CreditCard as CreditCardIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  AccountBalance as BankIcon,
  Phone as PhoneIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import paymentService from '../services/paymentService';

const PaymentMethods = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [activeProviders, setActiveProviders] = useState([]);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);

  useEffect(() => {
    fetchPaymentMethods();
    fetchActiveProviders();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await paymentService.getPaymentMethods();
      setPaymentMethods(response.methods);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      setError('Failed to load payment methods. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveProviders = async () => {
    try {
      const response = await paymentService.getActiveProviders();
      setActiveProviders(response.providers);
      
      // Set default selected provider
      if (response.providers.length > 0) {
        setSelectedProvider(response.providers[0]);
      }
    } catch (error) {
      console.error('Error fetching active providers:', error);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleOpenAddDialog = () => {
    setOpenAddDialog(true);
  };

  const handleCloseAddDialog = () => {
    setOpenAddDialog(false);
    formik.resetForm();
  };

  const handleOpenDeleteDialog = (method) => {
    setSelectedMethod(method);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setSelectedMethod(null);
  };

  const handleProviderChange = (event) => {
    const provider = activeProviders.find(p => p.code === event.target.value);
    setSelectedProvider(provider);
    formik.setFieldValue('providerCode', provider.code);
  };

  const handleDeleteMethod = async () => {
    try {
      setLoading(true);
      await paymentService.removePaymentMethod(selectedMethod.id);
      
      // Update payment methods list
      setPaymentMethods(paymentMethods.filter(method => method.id !== selectedMethod.id));
      
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting payment method:', error);
      setError('Failed to delete payment method. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultMethod = async (methodId) => {
    try {
      setLoading(true);
      await paymentService.setDefaultPaymentMethod(methodId);
      
      // Update payment methods list to reflect new default
      setPaymentMethods(paymentMethods.map(method => ({
        ...method,
        isDefault: method.id === methodId
      })));
    } catch (error) {
      console.error('Error setting default payment method:', error);
      setError('Failed to set default payment method. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Form validation schema
  const validationSchema = Yup.object({
    providerCode: Yup.string().required('Payment provider is required'),
    accountNumber: Yup.string().required('Account number is required'),
    accountName: Yup.string().required('Account name is required'),
    expiryDate: Yup.string().when('providerCode', {
      is: (val) => {
        const provider = activeProviders.find(p => p.code === val);
        return provider?.type === 'card';
      },
      then: Yup.string().required('Expiry date is required').matches(
        /^(0[1-9]|1[0-2])\/([0-9]{2})$/,
        'Expiry date must be in MM/YY format'
      ),
    }),
    cvv: Yup.string().when('providerCode', {
      is: (val) => {
        const provider = activeProviders.find(p => p.code === val);
        return provider?.type === 'card';
      },
      then: Yup.string().required('CVV is required').matches(
        /^[0-9]{3,4}$/,
        'CVV must be 3 or 4 digits'
      ),
    }),
    phoneNumber: Yup.string().when('providerCode', {
      is: (val) => {
        const provider = activeProviders.find(p => p.code === val);
        return provider?.type === 'mobile';
      },
      then: Yup.string().required('Phone number is required'),
    }),
    routingNumber: Yup.string().when('providerCode', {
      is: (val) => {
        const provider = activeProviders.find(p => p.code === val);
        return provider?.type === 'bank';
      },
      then: Yup.string().required('Routing number is required'),
    }),
  });

  // Formik setup
  const formik = useFormik({
    initialValues: {
      providerCode: selectedProvider?.code || '',
      accountNumber: '',
      accountName: '',
      expiryDate: '',
      cvv: '',
      phoneNumber: '',
      routingNumber: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');
        
        const response = await paymentService.addPaymentMethod(values);
        
        // Add new method to the list
        setPaymentMethods([...paymentMethods, response.method]);
        
        handleCloseAddDialog();
      } catch (error) {
        console.error('Error adding payment method:', error);
        setError(error.message || 'Failed to add payment method. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  const getMethodIcon = (type) => {
    switch (type) {
      case 'card':
        return <CreditCardIcon />;
      case 'bank':
        return <BankIcon />;
      case 'mobile':
        return <PhoneIcon />;
      default:
        return <CreditCardIcon />;
    }
  };

  const renderAddMethodForm = () => {
    if (!selectedProvider) return null;

    return (
      <form onSubmit={formik.handleSubmit}>
        <FormControl fullWidth margin="normal" error={formik.touched.providerCode && Boolean(formik.errors.providerCode)}>
          <InputLabel id="provider-select-label">Payment Provider</InputLabel>
          <Select
            labelId="provider-select-label"
            id="providerCode"
            name="providerCode"
            value={formik.values.providerCode}
            onChange={(e) => {
              handleProviderChange(e);
              formik.handleChange(e);
            }}
            label="Payment Provider"
          >
            {activeProviders.map((provider) => (
              <MenuItem key={provider.code} value={provider.code}>
                {provider.name}
              </MenuItem>
            ))}
          </Select>
          {formik.touched.providerCode && formik.errors.providerCode && (
            <FormHelperText>{formik.errors.providerCode}</FormHelperText>
          )}
        </FormControl>

        <TextField
          fullWidth
          id="accountName"
          name="accountName"
          label="Account Name"
          value={formik.values.accountName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.accountName && Boolean(formik.errors.accountName)}
          helperText={formik.touched.accountName && formik.errors.accountName}
          margin="normal"
        />

        <TextField
          fullWidth
          id="accountNumber"
          name="accountNumber"
          label={selectedProvider.type === 'card' ? 'Card Number' : 'Account Number'}
          value={formik.values.accountNumber}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.accountNumber && Boolean(formik.errors.accountNumber)}
          helperText={formik.touched.accountNumber && formik.errors.accountNumber}
          margin="normal"
        />

        {selectedProvider.type === 'card' && (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                id="expiryDate"
                name="expiryDate"
                label="Expiry Date (MM/YY)"
                value={formik.values.expiryDate}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.expiryDate && Boolean(formik.errors.expiryDate)}
                helperText={formik.touched.expiryDate && formik.errors.expiryDate}
                margin="normal"
                placeholder="MM/YY"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                id="cvv"
                name="cvv"
                label="CVV"
                type="password"
                value={formik.values.cvv}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.cvv && Boolean(formik.errors.cvv)}
                helperText={formik.touched.cvv && formik.errors.cvv}
                margin="normal"
              />
            </Grid>
          </Grid>
        )}

        {selectedProvider.type === 'bank' && (
          <TextField
            fullWidth
            id="routingNumber"
            name="routingNumber"
            label="Routing Number"
            value={formik.values.routingNumber}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.routingNumber && Boolean(formik.errors.routingNumber)}
            helperText={formik.touched.routingNumber && formik.errors.routingNumber}
            margin="normal"
          />
        )}

        {selectedProvider.type === 'mobile' && (
          <TextField
            fullWidth
            id="phoneNumber"
            name="phoneNumber"
            label="Phone Number"
            value={formik.values.phoneNumber}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.phoneNumber && Boolean(formik.errors.phoneNumber)}
            helperText={formik.touched.phoneNumber && formik.errors.phoneNumber}
            margin="normal"
          />
        )}
      </form>
    );
  };

  const renderPaymentMethods = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (paymentMethods.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <Typography variant="body1" color="text.secondary" paragraph>
            You don't have any payment methods yet.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
          >
            Add Payment Method
          </Button>
        </Box>
      );
    }

    return (
      <List>
        {paymentMethods.map((method) => (
          <React.Fragment key={method.id}>
            <ListItem>
              <ListItemIcon>
                {getMethodIcon(method.type)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body1">
                      {method.accountName} - {method.maskedAccountNumber}
                    </Typography>
                    {method.isDefault && (
                      <Chip
                        label="Default"
                        color="primary"
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>
                }
                secondary={
                  <>
                    <Typography variant="body2" component="span">
                      {method.providerName}
                    </Typography>
                    {method.expiryDate && (
                      <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                        • Expires: {method.expiryDate}
                      </Typography>
                    )}
                  </>
                }
              />
              <ListItemSecondaryAction>
                {!method.isDefault && (
                  <IconButton
                    edge="end"
                    aria-label="set-default"
                    onClick={() => handleSetDefaultMethod(method.id)}
                    title="Set as Default"
                  >
                    <CheckIcon />
                  </IconButton>
                )}
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleOpenDeleteDialog(method)}
                  title="Delete"
                  sx={{ ml: 1 }}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            <Divider />
          </React.Fragment>
        ))}
      </List>
    );
  };

  const renderPaymentProviders = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (activeProviders.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <Typography variant="body1" color="text.secondary">
            No payment providers available.
          </Typography>
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {activeProviders.map((provider) => (
          <Grid item xs={12} sm={6} md={4} key={provider.code}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {getMethodIcon(provider.type)}
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    {provider.name}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {provider.description}
                </Typography>
                <Typography variant="body2">
                  <strong>Fee:</strong> {provider.feePercentage}% + ${provider.feeFixed}
                </Typography>
                <Typography variant="body2">
                  <strong>Processing Time:</strong> {provider.processingTime}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={() => {
                    setSelectedProvider(provider);
                    formik.setFieldValue('providerCode', provider.code);
                    handleOpenAddDialog();
                  }}
                >
                  Add as Payment Method
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Payment Methods
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="My Payment Methods" />
          <Tab label="Available Providers" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tabValue === 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Your Payment Methods</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleOpenAddDialog}
                >
                  Add Method
                </Button>
              </Box>
              {renderPaymentMethods()}
            </Box>
          )}
          {tabValue === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Available Payment Providers
              </Typography>
              {renderPaymentProviders()}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Add Payment Method Dialog */}
      <Dialog open={openAddDialog} onClose={handleCloseAddDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add Payment Method</DialogTitle>
        <DialogContent>
          <DialogContentText paragraph>
            Please enter your payment method details. This information is encrypted and stored securely.
          </DialogContentText>
          {renderAddMethodForm()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog}>Cancel</Button>
          <Button
            onClick={formik.handleSubmit}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Add Method'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Payment Method Dialog */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Delete Payment Method</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this payment method?
            {selectedMethod && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {selectedMethod.providerName} - {selectedMethod.maskedAccountNumber}
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button
            onClick={handleDeleteMethod}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PaymentMethods;
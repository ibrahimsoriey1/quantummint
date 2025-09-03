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
  Divider,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Cake as CakeIcon,
  Lock as LockIcon,
  QrCode2 as QrCodeIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../hooks/useAuth';

const Profile = () => {
  const { user, updateProfile, changePassword, setupTwoFactor, enableTwoFactor, disableTwoFactor } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [openTwoFactorDialog, setOpenTwoFactorDialog] = useState(false);
  const [twoFactorSetupData, setTwoFactorSetupData] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorCodeError, setTwoFactorCodeError] = useState('');

  useEffect(() => {
    // Reset messages when changing tabs
    setError('');
    setSuccess('');
  }, [tabValue]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleOpenTwoFactorDialog = async () => {
    if (user?.twoFactorEnabled) {
      setOpenTwoFactorDialog(true);
      return;
    }
    
    try {
      setLoading(true);
      const response = await setupTwoFactor();
      setTwoFactorSetupData(response);
      setOpenTwoFactorDialog(true);
    } catch (error) {
      console.error('Error setting up two-factor authentication:', error);
      setError('Failed to set up two-factor authentication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTwoFactorDialog = () => {
    setOpenTwoFactorDialog(false);
    setTwoFactorCode('');
    setTwoFactorCodeError('');
  };

  const handleEnableTwoFactor = async () => {
    if (!twoFactorCode) {
      setTwoFactorCodeError('Please enter the verification code');
      return;
    }
    
    try {
      setLoading(true);
      const result = await enableTwoFactor(twoFactorCode);
      if (result) {
        setSuccess('Two-factor authentication enabled successfully!');
        handleCloseTwoFactorDialog();
      }
    } catch (error) {
      console.error('Error enabling two-factor authentication:', error);
      setTwoFactorCodeError('Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableTwoFactor = async () => {
    if (!twoFactorCode) {
      setTwoFactorCodeError('Please enter the verification code');
      return;
    }
    
    try {
      setLoading(true);
      const result = await disableTwoFactor(twoFactorCode);
      if (result) {
        setSuccess('Two-factor authentication disabled successfully!');
        handleCloseTwoFactorDialog();
      }
    } catch (error) {
      console.error('Error disabling two-factor authentication:', error);
      setTwoFactorCodeError('Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Profile Form Validation
  const profileValidationSchema = Yup.object({
    firstName: Yup.string().required('First name is required'),
    lastName: Yup.string().required('Last name is required'),
    email: Yup.string().email('Invalid email address').required('Email is required'),
    phoneNumber: Yup.string().required('Phone number is required'),
    dateOfBirth: Yup.date().required('Date of birth is required'),
  });

  const profileFormik = useFormik({
    initialValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phoneNumber: user?.phoneNumber || '',
      dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth) : null,
    },
    validationSchema: profileValidationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');
        setSuccess('');
        
        await updateProfile({
          ...values,
          dateOfBirth: values.dateOfBirth.toISOString(),
        });
        
        setSuccess('Profile updated successfully!');
      } catch (error) {
        console.error('Error updating profile:', error);
        setError(error.message || 'Failed to update profile. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  // Password Change Form Validation
  const passwordChangeValidationSchema = Yup.object({
    currentPassword: Yup.string().required('Current password is required'),
    newPassword: Yup.string()
      .required('New password is required')
      .min(8, 'Password must be at least 8 characters')
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    confirmPassword: Yup.string()
      .required('Please confirm your password')
      .oneOf([Yup.ref('newPassword'), null], 'Passwords must match'),
  });

  const passwordChangeFormik = useFormik({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema: passwordChangeValidationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        setError('');
        setSuccess('');
        
        await changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        });
        
        setSuccess('Password changed successfully!');
        passwordChangeFormik.resetForm();
      } catch (error) {
        console.error('Error changing password:', error);
        setError(error.message || 'Failed to change password. Please try again.');
      } finally {
        setLoading(false);
      }
    },
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    loginAlerts: true,
    transactionAlerts: true,
    marketingEmails: false,
  });

  const handleNotificationChange = (event) => {
    setNotificationSettings({
      ...notificationSettings,
      [event.target.name]: event.target.checked,
    });
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        My Profile
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar
                sx={{
                  width: 100,
                  height: 100,
                  mx: 'auto',
                  mb: 2,
                  bgcolor: 'primary.main',
                  fontSize: 40,
                }}
              >
                {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
              </Avatar>
              <Typography variant="h5" gutterBottom>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {user?.email}
              </Typography>
              <Button variant="outlined" size="small" sx={{ mt: 1 }}>
                Change Photo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Information
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <EmailIcon />
                  </ListItemIcon>
                  <ListItemText primary="Email" secondary={user?.email} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemIcon>
                    <PhoneIcon />
                  </ListItemIcon>
                  <ListItemText primary="Phone" secondary={user?.phoneNumber || 'Not provided'} />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemIcon>
                    <CakeIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Date of Birth" 
                    secondary={user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'Not provided'} 
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemIcon>
                    <LockIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Two-Factor Authentication" 
                    secondary={user?.twoFactorEnabled ? 'Enabled' : 'Disabled'} 
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleOpenTwoFactorDialog}
                  >
                    {user?.twoFactorEnabled ? 'Disable' : 'Enable'}
                  </Button>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ mb: 3 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab icon={<PersonIcon />} label="Profile" />
              <Tab icon={<SecurityIcon />} label="Security" />
              <Tab icon={<NotificationsIcon />} label="Notifications" />
            </Tabs>

            <Box sx={{ p: 3 }}>
              {/* Profile Tab */}
              {tabValue === 0 && (
                <form onSubmit={profileFormik.handleSubmit}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        id="firstName"
                        name="firstName"
                        label="First Name"
                        value={profileFormik.values.firstName}
                        onChange={profileFormik.handleChange}
                        onBlur={profileFormik.handleBlur}
                        error={profileFormik.touched.firstName && Boolean(profileFormik.errors.firstName)}
                        helperText={profileFormik.touched.firstName && profileFormik.errors.firstName}
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        id="lastName"
                        name="lastName"
                        label="Last Name"
                        value={profileFormik.values.lastName}
                        onChange={profileFormik.handleChange}
                        onBlur={profileFormik.handleBlur}
                        error={profileFormik.touched.lastName && Boolean(profileFormik.errors.lastName)}
                        helperText={profileFormik.touched.lastName && profileFormik.errors.lastName}
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        id="email"
                        name="email"
                        label="Email Address"
                        value={profileFormik.values.email}
                        onChange={profileFormik.handleChange}
                        onBlur={profileFormik.handleBlur}
                        error={profileFormik.touched.email && Boolean(profileFormik.errors.email)}
                        helperText={profileFormik.touched.email && profileFormik.errors.email}
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        id="phoneNumber"
                        name="phoneNumber"
                        label="Phone Number"
                        value={profileFormik.values.phoneNumber}
                        onChange={profileFormik.handleChange}
                        onBlur={profileFormik.handleBlur}
                        error={profileFormik.touched.phoneNumber && Boolean(profileFormik.errors.phoneNumber)}
                        helperText={profileFormik.touched.phoneNumber && profileFormik.errors.phoneNumber}
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker
                          label="Date of Birth"
                          value={profileFormik.values.dateOfBirth}
                          onChange={(date) => profileFormik.setFieldValue('dateOfBirth', date)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              fullWidth
                              margin="normal"
                              error={profileFormik.touched.dateOfBirth && Boolean(profileFormik.errors.dateOfBirth)}
                              helperText={profileFormik.touched.dateOfBirth && profileFormik.errors.dateOfBirth}
                            />
                          )}
                        />
                      </LocalizationProvider>
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 3, textAlign: 'right' }}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={loading || !profileFormik.isValid}
                    >
                      {loading ? <CircularProgress size={24} /> : 'Save Changes'}
                    </Button>
                  </Box>
                </form>
              )}

              {/* Security Tab */}
              {tabValue === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Change Password
                  </Typography>
                  <form onSubmit={passwordChangeFormik.handleSubmit}>
                    <TextField
                      fullWidth
                      id="currentPassword"
                      name="currentPassword"
                      label="Current Password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordChangeFormik.values.currentPassword}
                      onChange={passwordChangeFormik.handleChange}
                      onBlur={passwordChangeFormik.handleBlur}
                      error={passwordChangeFormik.touched.currentPassword && Boolean(passwordChangeFormik.errors.currentPassword)}
                      helperText={passwordChangeFormik.touched.currentPassword && passwordChangeFormik.errors.currentPassword}
                      margin="normal"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="toggle password visibility"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              edge="end"
                            >
                              {showCurrentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      fullWidth
                      id="newPassword"
                      name="newPassword"
                      label="New Password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordChangeFormik.values.newPassword}
                      onChange={passwordChangeFormik.handleChange}
                      onBlur={passwordChangeFormik.handleBlur}
                      error={passwordChangeFormik.touched.newPassword && Boolean(passwordChangeFormik.errors.newPassword)}
                      helperText={passwordChangeFormik.touched.newPassword && passwordChangeFormik.errors.newPassword}
                      margin="normal"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="toggle password visibility"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              edge="end"
                            >
                              {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      fullWidth
                      id="confirmPassword"
                      name="confirmPassword"
                      label="Confirm New Password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordChangeFormik.values.confirmPassword}
                      onChange={passwordChangeFormik.handleChange}
                      onBlur={passwordChangeFormik.handleBlur}
                      error={passwordChangeFormik.touched.confirmPassword && Boolean(passwordChangeFormik.errors.confirmPassword)}
                      helperText={passwordChangeFormik.touched.confirmPassword && passwordChangeFormik.errors.confirmPassword}
                      margin="normal"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="toggle password visibility"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              edge="end"
                            >
                              {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Box sx={{ mt: 3, textAlign: 'right' }}>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={loading || !passwordChangeFormik.isValid}
                      >
                        {loading ? <CircularProgress size={24} /> : 'Change Password'}
                      </Button>
                    </Box>
                  </form>

                  <Divider sx={{ my: 4 }} />

                  <Typography variant="h6" gutterBottom>
                    Two-Factor Authentication
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Two-factor authentication adds an extra layer of security to your account by requiring more than just a password to sign in.
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {user?.twoFactorEnabled
                          ? 'Your account is protected with two-factor authentication.'
                          : 'Enable two-factor authentication for enhanced security.'}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      onClick={handleOpenTwoFactorDialog}
                    >
                      {user?.twoFactorEnabled ? 'Disable' : 'Enable'}
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Notifications Tab */}
              {tabValue === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Notification Settings
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Email Notifications"
                        secondary="Receive notifications via email"
                      />
                      <Switch
                        edge="end"
                        name="emailNotifications"
                        checked={notificationSettings.emailNotifications}
                        onChange={handleNotificationChange}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="SMS Notifications"
                        secondary="Receive notifications via SMS"
                      />
                      <Switch
                        edge="end"
                        name="smsNotifications"
                        checked={notificationSettings.smsNotifications}
                        onChange={handleNotificationChange}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="Login Alerts"
                        secondary="Get notified when someone logs into your account"
                      />
                      <Switch
                        edge="end"
                        name="loginAlerts"
                        checked={notificationSettings.loginAlerts}
                        onChange={handleNotificationChange}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="Transaction Alerts"
                        secondary="Get notified about transactions in your account"
                      />
                      <Switch
                        edge="end"
                        name="transactionAlerts"
                        checked={notificationSettings.transactionAlerts}
                        onChange={handleNotificationChange}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="Marketing Emails"
                        secondary="Receive promotional emails and offers"
                      />
                      <Switch
                        edge="end"
                        name="marketingEmails"
                        checked={notificationSettings.marketingEmails}
                        onChange={handleNotificationChange}
                      />
                    </ListItem>
                  </List>

                  <Box sx={{ mt: 3, textAlign: 'right' }}>
                    <Button
                      variant="contained"
                    >
                      Save Preferences
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Two-Factor Authentication Dialog */}
      <Dialog open={openTwoFactorDialog} onClose={handleCloseTwoFactorDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {user?.twoFactorEnabled ? 'Disable Two-Factor Authentication' : 'Enable Two-Factor Authentication'}
        </DialogTitle>
        <DialogContent>
          {user?.twoFactorEnabled ? (
            <Box>
              <DialogContentText paragraph>
                To disable two-factor authentication, please enter the verification code from your authenticator app.
              </DialogContentText>
              <TextField
                fullWidth
                label="Verification Code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                error={Boolean(twoFactorCodeError)}
                helperText={twoFactorCodeError}
                margin="normal"
              />
            </Box>
          ) : (
            <Box>
              <DialogContentText paragraph>
                Scan the QR code below with your authenticator app (like Google Authenticator or Authy) to enable two-factor authentication.
              </DialogContentText>
              
              {twoFactorSetupData && (
                <Box sx={{ textAlign: 'center', my: 3 }}>
                  <img
                    src={twoFactorSetupData.qrCodeUrl}
                    alt="QR Code for Two-Factor Authentication"
                    style={{ width: 200, height: 200 }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Or enter this code manually: <strong>{twoFactorSetupData.secretKey}</strong>
                  </Typography>
                </Box>
              )}
              
              <DialogContentText paragraph>
                After scanning, enter the verification code from your authenticator app below:
              </DialogContentText>
              
              <TextField
                fullWidth
                label="Verification Code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                error={Boolean(twoFactorCodeError)}
                helperText={twoFactorCodeError}
                margin="normal"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTwoFactorDialog}>Cancel</Button>
          <Button
            onClick={user?.twoFactorEnabled ? handleDisableTwoFactor : handleEnableTwoFactor}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : user?.twoFactorEnabled ? 'Disable' : 'Enable'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Profile;
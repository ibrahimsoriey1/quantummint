import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  Avatar,
  Divider,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  PhotoCamera as PhotoCameraIcon
} from '@mui/icons-material';
import { updateProfile, updatePassword, enable2FA, disable2FA } from '../store/slices/authSlice';
import PageTitle from '../components/common/PageTitle';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const Profile = () => {
  const [tabValue, setTabValue] = useState(0);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [twoFADialogOpen, setTwoFADialogOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [qrCode, setQrCode] = useState('');

  const dispatch = useDispatch();
  const { user, loading, error, updateSuccess, twoFactorAuthData } = useSelector((state) => state.auth);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || ''
      });
    }
  }, [user]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Handle profile form change
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm({
      ...profileForm,
      [name]: value
    });
  };

  // Handle password form change
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm({
      ...passwordForm,
      [name]: value
    });
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    setShowPasswords({
      ...showPasswords,
      [field]: !showPasswords[field]
    });
  };

  // Validate profile form
  const validateProfileForm = () => {
    const errors = {};

    if (!profileForm.firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    if (!profileForm.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }

    if (profileForm.phoneNumber && !/^\+?[0-9]{10,15}$/.test(profileForm.phoneNumber)) {
      errors.phoneNumber = 'Invalid phone number format';
    }

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate password form
  const validatePasswordForm = () => {
    const errors = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    }

    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle profile update
  const handleProfileUpdate = (e) => {
    e.preventDefault();

    if (validateProfileForm()) {
      dispatch(updateProfile(profileForm));
    }
  };

  // Handle password update
  const handlePasswordUpdate = (e) => {
    e.preventDefault();

    if (validatePasswordForm()) {
      dispatch(updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      }));

      // Reset form on successful submission
      if (!error) {
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    }
  };

  // Handle 2FA setup
  const handleSetup2FA = () => {
    dispatch(enable2FA())
      .unwrap()
      .then((data) => {
        setQrCode(data.qrCode);
        setTwoFADialogOpen(true);
      })
      .catch((err) => {
        console.error('Error setting up 2FA:', err);
      });
  };

  // Handle 2FA verification
  const handleVerify2FA = () => {
    if (!verificationCode.trim()) {
      setVerificationError('Verification code is required');
      return;
    }

    if (verificationCode.length !== 6) {
      setVerificationError('Verification code must be 6 digits');
      return;
    }

    dispatch(enable2FA({ verificationCode }))
      .unwrap()
      .then(() => {
        setTwoFADialogOpen(false);
        setVerificationCode('');
        setVerificationError('');
      })
      .catch((err) => {
        setVerificationError(err.message || 'Invalid verification code');
      });
  };

  // Handle 2FA disable
  const handleDisable2FA = () => {
    dispatch(disable2FA());
  };

  return (
    <>
      <PageTitle title="Profile Settings" />

      <Paper sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="profile settings tabs"
            variant="fullWidth"
          >
            <Tab icon={<PersonIcon />} label="Personal Information" />
            <Tab icon={<SecurityIcon />} label="Security" />
          </Tabs>
        </Box>

        {/* Personal Information Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  mb: 2,
                  fontSize: 48,
                  bgcolor: 'primary.main'
                }}
              >
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </Avatar>

              <Box sx={{ position: 'relative' }}>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="profile-photo-upload"
                  type="file"
                />
                <label htmlFor="profile-photo-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<PhotoCameraIcon />}
                    sx={{ mb: 2 }}
                  >
                    Change Photo
                  </Button>
                </label>
              </Box>

              <Typography variant="body2" color="text.secondary" align="center">
                Recommended size: 200x200 pixels
              </Typography>
            </Grid>

            <Grid item xs={12} md={8}>
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              {updateSuccess && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  Profile updated successfully
                </Alert>
              )}

              <form onSubmit={handleProfileUpdate}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="First Name"
                      name="firstName"
                      fullWidth
                      value={profileForm.firstName}
                      onChange={handleProfileChange}
                      error={!!profileErrors.firstName}
                      helperText={profileErrors.firstName}
                      disabled={loading}
                      required
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Last Name"
                      name="lastName"
                      fullWidth
                      value={profileForm.lastName}
                      onChange={handleProfileChange}
                      error={!!profileErrors.lastName}
                      helperText={profileErrors.lastName}
                      disabled={loading}
                      required
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Email Address"
                      name="email"
                      fullWidth
                      value={profileForm.email}
                      disabled={true}
                      helperText="Email cannot be changed"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Phone Number"
                      name="phoneNumber"
                      fullWidth
                      value={profileForm.phoneNumber}
                      onChange={handleProfileChange}
                      error={!!profileErrors.phoneNumber}
                      helperText={profileErrors.phoneNumber || "Optional"}
                      disabled={loading}
                      placeholder="+1234567890"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      disabled={loading}
                      startIcon={loading ? <LoadingSpinner size={20} /> : <EditIcon />}
                    >
                      Update Profile
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={4}>
            {/* Change Password Section */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Change Password
              </Typography>
              <Divider sx={{ mb: 3 }} />

              {error && tabValue === 1 && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              {updateSuccess && tabValue === 1 && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  Password updated successfully
                </Alert>
              )}

              <form onSubmit={handlePasswordUpdate}>
                <TextField
                  label="Current Password"
                  name="currentPassword"
                  type={showPasswords.currentPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  error={!!passwordErrors.currentPassword}
                  helperText={passwordErrors.currentPassword}
                  disabled={loading}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => togglePasswordVisibility('currentPassword')}
                          edge="end"
                        >
                          {showPasswords.currentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <TextField
                  label="New Password"
                  name="newPassword"
                  type={showPasswords.newPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  error={!!passwordErrors.newPassword}
                  helperText={passwordErrors.newPassword}
                  disabled={loading}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => togglePasswordVisibility('newPassword')}
                          edge="end"
                        >
                          {showPasswords.newPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <TextField
                  label="Confirm New Password"
                  name="confirmPassword"
                  type={showPasswords.confirmPassword ? 'text' : 'password'}
                  fullWidth
                  margin="normal"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  error={!!passwordErrors.confirmPassword}
                  helperText={passwordErrors.confirmPassword}
                  disabled={loading}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => togglePasswordVisibility('confirmPassword')}
                          edge="end"
                        >
                          {showPasswords.confirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={loading}
                  sx={{ mt: 2 }}
                  startIcon={loading ? <LoadingSpinner size={20} /> : null}
                >
                  Update Password
                </Button>
              </form>
            </Grid>

            {/* Two-Factor Authentication Section */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Two-Factor Authentication
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Typography variant="body1" paragraph>
                Two-factor authentication adds an extra layer of security to your account by requiring more than just a password to sign in.
              </Typography>

              {user?.twoFactorEnabled ? (
                <>
                  <Alert severity="success" sx={{ mb: 3 }}>
                    Two-factor authentication is enabled for your account.
                  </Alert>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleDisable2FA}
                    disabled={loading}
                  >
                    Disable 2FA
                  </Button>
                </>
              ) : (
                <>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    Protect your account with two-factor authentication.
                  </Alert>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSetup2FA}
                    disabled={loading}
                  >
                    Enable 2FA
                  </Button>
                </>
              )}
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>

      {/* 2FA Setup Dialog */}
      <Dialog open={twoFADialogOpen} onClose={() => setTwoFADialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            {qrCode ? (
              <img src={qrCode} alt="QR Code for 2FA" style={{ maxWidth: '100%', height: 'auto' }} />
            ) : (
              <CircularProgress />
            )}
          </Box>
          <Typography variant="body1" paragraph>
            Scan the QR code with an authenticator app like Google Authenticator or Authy, then enter the verification code below.
          </Typography>
          <TextField
            label="Verification Code"
            fullWidth
            margin="normal"
            value={verificationCode}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9]/g, '');
              if (value.length <= 6) {
                setVerificationCode(value);
              }
            }}
            error={!!verificationError}
            helperText={verificationError}
            placeholder="Enter 6-digit code"
            inputProps={{ maxLength: 6 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTwoFADialogOpen(false)}>Cancel</Button>
          <Button onClick={handleVerify2FA} variant="contained" color="primary" disabled={loading}>
            {loading ? <LoadingSpinner size={24} /> : 'Verify'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Profile;
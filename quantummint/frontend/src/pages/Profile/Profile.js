import React, { useState, useEffect } from 'react';
import {
  Grid,
  Typography,
  Card,
  CardContent,
  Box,
  TextField,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Person,
  Edit,
  Save,
  Cancel,
  AccountBalance,
  History,
  Security,
  Verified,
  CalendarToday
} from '@mui/icons-material';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editData, setEditData] = useState({});

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async() => {
    try {
      setLoading(true);

      // Mock user data
      const mockUser = {
        id: 'user_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        dateOfBirth: '1990-01-15',
        address: '123 Main St, New York, NY 10001',
        nationality: 'US',
        avatar: null,
        kycStatus: 'verified',
        accountStatus: 'active',
        memberSince: '2024-01-01T00:00:00Z',
        lastLogin: '2024-01-15T10:30:00Z',
        stats: {
          totalTransactions: 45,
          totalGenerated: 1250.50,
          walletBalance: 850.75
        }
      };

      setUser(mockUser);
      setEditData({
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        phone: mockUser.phone,
        address: mockUser.address
      });
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async() => {
    try {
      setSaving(true);
      setError('');

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setUser(prev => ({
        ...prev,
        ...editData
      }));

      setEditing(false);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address
    });
    setEditing(false);
    setError('');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
    case 'verified':
    case 'active':
      return 'success';
    case 'pending':
      return 'warning';
    case 'suspended':
      return 'error';
    default:
      return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Failed to load profile</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Person />
        Profile
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6">Personal Information</Typography>
                {!editing ? (
                  <Button
                    startIcon={<Edit />}
                    onClick={() => setEditing(true)}
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      startIcon={saving ? <CircularProgress size={16} /> : <Save />}
                      onClick={handleSave}
                      disabled={saving}
                    >
                      Save
                    </Button>
                    <Button
                      startIcon={<Cancel />}
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Avatar
                  sx={{ width: 80, height: 80, mr: 2 }}
                  src={user.avatar}
                >
                  {user.firstName[0]}{user.lastName[0]}
                </Avatar>
                <Box>
                  <Typography variant="h5">
                    {user.firstName} {user.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Member since {formatDate(user.memberSince)}
                  </Typography>
                </Box>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    name="firstName"
                    value={editing ? editData.firstName : user.firstName}
                    onChange={handleEditChange}
                    disabled={!editing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    name="lastName"
                    value={editing ? editData.lastName : user.lastName}
                    onChange={handleEditChange}
                    disabled={!editing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={user.email}
                    disabled
                    helperText="Email cannot be changed"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    name="phone"
                    value={editing ? editData.phone : user.phone}
                    onChange={handleEditChange}
                    disabled={!editing}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Date of Birth"
                    value={formatDate(user.dateOfBirth)}
                    disabled
                    helperText="Date of birth cannot be changed"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nationality"
                    value={user.nationality}
                    disabled
                    helperText="Nationality cannot be changed"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address"
                    name="address"
                    value={editing ? editData.address : user.address}
                    onChange={handleEditChange}
                    disabled={!editing}
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Status
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Verified />
                  </ListItemIcon>
                  <ListItemText
                    primary="KYC Status"
                    secondary={
                      <Chip
                        label={user.kycStatus.toUpperCase()}
                        color={getStatusColor(user.kycStatus)}
                        size="small"
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Security />
                  </ListItemIcon>
                  <ListItemText
                    primary="Account Status"
                    secondary={
                      <Chip
                        label={user.accountStatus.toUpperCase()}
                        color={getStatusColor(user.accountStatus)}
                        size="small"
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CalendarToday />
                  </ListItemIcon>
                  <ListItemText
                    primary="Last Login"
                    secondary={formatDate(user.lastLogin)}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Statistics
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <History />
                  </ListItemIcon>
                  <ListItemText
                    primary="Total Transactions"
                    secondary={user.stats.totalTransactions}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <AccountBalance />
                  </ListItemIcon>
                  <ListItemText
                    primary="Total Generated"
                    secondary={`$${user.stats.totalGenerated.toFixed(2)}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <AccountBalance />
                  </ListItemIcon>
                  <ListItemText
                    primary="Wallet Balance"
                    secondary={`$${user.stats.walletBalance.toFixed(2)}`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile;

import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Box,
  TextField,
  Button,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  FormControlLabel
} from '@mui/material';
import {
  Settings,
  Security,
  Notifications,
  Payment,
  CheckCircle,
  Warning,
  Error,
  Info,
  Refresh,
  Save
} from '@mui/icons-material';

const SystemSettings = () => {
  const [settings, setSettings] = useState({
    system: {
      maintenanceMode: false,
      debugMode: false,
      autoBackup: true,
      logLevel: 'info'
    },
    security: {
      maxLoginAttempts: 5,
      sessionTimeout: 30,
      requireTwoFactor: false,
      passwordExpiry: 90
    },
    limits: {
      maxTransactionAmount: 10000,
      dailyTransactionLimit: 50000,
      maxGenerationAmount: 1000,
      dailyGenerationLimit: 5000
    },
    notifications: {
      emailNotifications: true,
      smsNotifications: true,
      adminAlerts: true,
      systemAlerts: true
    }
  });

  const [systemStatus] = useState({
    database: 'healthy',
    redis: 'healthy',
    rabbitmq: 'healthy',
    storage: 'healthy',
    apiGateway: 'healthy'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: '', title: '', content: '' });

  useEffect(() => {
    fetchSystemSettings();
    fetchSystemStatus();
  }, []);

  const fetchSystemSettings = async() => {
    try {
      setLoading(true);
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Settings already initialized above
    } catch (err) {
      setError('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStatus = async() => {
    try {
      // Mock system status check
      await new Promise(resolve => setTimeout(resolve, 500));
      // Status already initialized above
    } catch (err) {
      setError('Failed to fetch system status');
    }
  };

  const handleSystemChange = (key) => (event) => {
    setSettings(prev => ({
      ...prev,
      system: {
        ...prev.system,
        [key]: event.target.checked !== undefined ? event.target.checked : event.target.value
      }
    }));
  };

  const handleSecurityChange = (key) => (event) => {
    setSettings(prev => ({
      ...prev,
      security: {
        ...prev.security,
        [key]: event.target.value
      }
    }));
  };

  const handleLimitsChange = (key) => (event) => {
    setSettings(prev => ({
      ...prev,
      limits: {
        ...prev.limits,
        [key]: parseFloat(event.target.value) || 0
      }
    }));
  };

  const handleNotificationChange = (key) => (event) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: event.target.checked
      }
    }));
  };

  const handleSaveSettings = async() => {
    try {
      setSaving(true);
      setError('');

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      setSuccess('System settings saved successfully!');
    } catch (err) {
      setError('Failed to save system settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSystemAction = (action) => {
    const actions = {
      restart: {
        title: 'Restart System',
        content: 'Are you sure you want to restart the system? This will temporarily interrupt service for all users.'
      },
      backup: {
        title: 'Create Backup',
        content: 'This will create a full system backup. The process may take several minutes.'
      },
      maintenance: {
        title: 'Enable Maintenance Mode',
        content: 'This will put the system in maintenance mode, preventing user access.'
      }
    };

    setConfirmDialog({
      open: true,
      action,
      ...actions[action]
    });
  };

  const executeSystemAction = async() => {
    try {
      setSaving(true);

      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      switch (confirmDialog.action) {
      case 'restart':
        setSuccess('System restart initiated successfully!');
        break;
      case 'backup':
        setSuccess('System backup created successfully!');
        break;
      case 'maintenance':
        setSettings(prev => ({
          ...prev,
          system: { ...prev.system, maintenanceMode: true }
        }));
        setSuccess('Maintenance mode enabled!');
        break;
      default:
        break;
      }

      setConfirmDialog({ open: false, action: '', title: '', content: '' });
    } catch (err) {
      setError(`Failed to ${confirmDialog.action}`);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
    case 'healthy':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
    case 'healthy':
      return <CheckCircle />;
    case 'warning':
      return <Warning />;
    case 'error':
      return <Error />;
    default:
      return <Info />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Settings />
        System Settings
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
        <Grid item xs={12} md={6}>
          {/* System Status */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Status
              </Typography>

              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Service</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(systemStatus).map(([service, status]) => (
                      <TableRow key={service}>
                        <TableCell sx={{ textTransform: 'capitalize' }}>
                          {service.replace(/([A-Z])/g, ' $1')}
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={getStatusIcon(status)}
                            label={status.toUpperCase()}
                            color={getStatusColor(status)}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={fetchSystemStatus}
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleSystemAction('restart')}
                >
                  Restart System
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleSystemAction('backup')}
                >
                  Create Backup
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* System Configuration */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Configuration
              </Typography>

              <List>
                <ListItem>
                  <ListItemText
                    primary="Maintenance Mode"
                    secondary="Put system in maintenance mode"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.system.maintenanceMode}
                      onChange={handleSystemChange('maintenanceMode')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="Debug Mode"
                    secondary="Enable detailed logging and debugging"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.system.debugMode}
                      onChange={handleSystemChange('debugMode')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText
                    primary="Auto Backup"
                    secondary="Automatically backup system data"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.system.autoBackup}
                      onChange={handleSystemChange('autoBackup')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>

              <TextField
                select
                fullWidth
                label="Log Level"
                value={settings.system.logLevel}
                onChange={handleSystemChange('logLevel')}
                SelectProps={{ native: true }}
                sx={{ mt: 2 }}
              >
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </TextField>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          {/* Security Settings */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Security />
                Security Settings
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Login Attempts"
                    value={settings.security.maxLoginAttempts}
                    onChange={handleSecurityChange('maxLoginAttempts')}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Session Timeout (minutes)"
                    value={settings.security.sessionTimeout}
                    onChange={handleSecurityChange('sessionTimeout')}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Password Expiry (days)"
                    value={settings.security.passwordExpiry}
                    onChange={handleSecurityChange('passwordExpiry')}
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.security.requireTwoFactor}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      security: { ...prev.security, requireTwoFactor: e.target.checked }
                    }))}
                  />
                }
                label="Require Two-Factor Authentication"
                sx={{ mt: 2 }}
              />
            </CardContent>
          </Card>

          {/* Transaction Limits */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Payment />
                Transaction Limits
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Transaction Amount"
                    value={settings.limits.maxTransactionAmount}
                    onChange={handleLimitsChange('maxTransactionAmount')}
                    InputProps={{ startAdornment: '$' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Daily Transaction Limit"
                    value={settings.limits.dailyTransactionLimit}
                    onChange={handleLimitsChange('dailyTransactionLimit')}
                    InputProps={{ startAdornment: '$' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Generation Amount"
                    value={settings.limits.maxGenerationAmount}
                    onChange={handleLimitsChange('maxGenerationAmount')}
                    InputProps={{ startAdornment: '$' }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Daily Generation Limit"
                    value={settings.limits.dailyGenerationLimit}
                    onChange={handleLimitsChange('dailyGenerationLimit')}
                    InputProps={{ startAdornment: '$' }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Notifications />
                Notification Settings
              </Typography>

              <List>
                <ListItem>
                  <ListItemText primary="Email Notifications" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.notifications.emailNotifications}
                      onChange={handleNotificationChange('emailNotifications')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText primary="SMS Notifications" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.notifications.smsNotifications}
                      onChange={handleNotificationChange('smsNotifications')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText primary="Admin Alerts" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.notifications.adminAlerts}
                      onChange={handleNotificationChange('adminAlerts')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemText primary="System Alerts" />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={settings.notifications.systemAlerts}
                      onChange={handleNotificationChange('systemAlerts')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={saving ? <CircularProgress size={20} /> : <Save />}
          onClick={handleSaveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
        <DialogTitle>
          {confirmDialog.title}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {confirmDialog.content}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={executeSystemAction}
            disabled={saving}
          >
            {saving ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SystemSettings;

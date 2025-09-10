import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle,
  Schedule,
  Error,
  Warning,
  Person,
  Description,
  Verified,
  Refresh,
  ContactSupport
} from '@mui/icons-material';

const VerificationStatus = () => {
  const [verificationData, setVerificationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  const fetchVerificationStatus = async() => {
    try {
      setLoading(true);

      // Mock verification data
      const mockData = {
        status: 'pending_review',
        submittedAt: '2024-01-15T10:30:00Z',
        estimatedCompletion: '2024-01-17T10:30:00Z',
        progress: 75,
        steps: [
          {
            id: 'personal_info',
            name: 'Personal Information',
            status: 'completed',
            completedAt: '2024-01-15T10:30:00Z',
            description: 'Personal details verified'
          },
          {
            id: 'documents',
            name: 'Document Upload',
            status: 'completed',
            completedAt: '2024-01-15T11:00:00Z',
            description: 'Identity documents uploaded'
          },
          {
            id: 'review',
            name: 'Manual Review',
            status: 'in_progress',
            description: 'Documents under review by our team'
          },
          {
            id: 'approval',
            name: 'Final Approval',
            status: 'pending',
            description: 'Awaiting final verification'
          }
        ],
        documents: [
          {
            type: 'identity',
            name: 'Government ID',
            status: 'approved',
            uploadedAt: '2024-01-15T10:45:00Z'
          },
          {
            type: 'address',
            name: 'Proof of Address',
            status: 'approved',
            uploadedAt: '2024-01-15T10:50:00Z'
          },
          {
            type: 'selfie',
            name: 'Selfie with ID',
            status: 'under_review',
            uploadedAt: '2024-01-15T10:55:00Z'
          }
        ],
        rejectionReasons: []
      };

      setVerificationData(mockData);
    } catch (err) {
      setError('Failed to load verification status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
    case 'completed':
    case 'approved':
      return 'success';
    case 'in_progress':
    case 'under_review':
      return 'warning';
    case 'pending':
      return 'info';
    case 'rejected':
    case 'failed':
      return 'error';
    default:
      return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
    case 'completed':
    case 'approved':
      return <CheckCircle />;
    case 'in_progress':
    case 'under_review':
      return <Schedule />;
    case 'rejected':
    case 'failed':
      return <Error />;
    default:
      return <Warning />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getOverallStatusMessage = (status) => {
    switch (status) {
    case 'pending_review':
      return 'Your documents are being reviewed by our verification team.';
    case 'verified':
      return 'Congratulations! Your identity has been successfully verified.';
    case 'rejected':
      return 'Your verification was rejected. Please review the feedback and resubmit.';
    case 'in_progress':
      return 'Your verification is in progress. Please complete all required steps.';
    default:
      return 'Please start your KYC verification process.';
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Verification Status
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchVerificationStatus}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Verified />
        Verification Status
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Current Status</Typography>
                <Chip
                  icon={getStatusIcon(verificationData.status)}
                  label={verificationData.status.replace('_', ' ').toUpperCase()}
                  color={getStatusColor(verificationData.status)}
                />
              </Box>

              <Typography variant="body1" color="text.secondary" gutterBottom>
                {getOverallStatusMessage(verificationData.status)}
              </Typography>

              {verificationData.progress && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Progress</Typography>
                    <Typography variant="body2">{verificationData.progress}%</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={verificationData.progress} />
                </Box>
              )}

              {verificationData.estimatedCompletion && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Estimated completion: {formatDate(verificationData.estimatedCompletion)}
                </Typography>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Verification Timeline
              </Typography>

              <List>
                {verificationData.steps.map((step) => (
                  <ListItem key={step.id}>
                    <ListItemIcon>
                      {getStatusIcon(step.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={step.name}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {step.description}
                          </Typography>
                          {step.completedAt && (
                            <Typography variant="caption" color="text.secondary">
                              Completed: {formatDate(step.completedAt)}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <Chip
                      label={step.status.replace('_', ' ')}
                      color={getStatusColor(step.status)}
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Submitted Documents
              </Typography>

              <List dense>
                {verificationData.documents.map((doc, index) => (
                  <React.Fragment key={doc.type}>
                    <ListItem>
                      <ListItemIcon>
                        <Description />
                      </ListItemIcon>
                      <ListItemText
                        primary={doc.name}
                        secondary={
                          <Box>
                            <Chip
                              label={doc.status.replace('_', ' ')}
                              color={getStatusColor(doc.status)}
                              size="small"
                              sx={{ mt: 0.5 }}
                            />
                            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                              Uploaded: {formatDate(doc.uploadedAt)}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < verificationData.documents.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>

          {verificationData.rejectionReasons.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom color="error">
                  Issues to Address
                </Typography>

                <List dense>
                  {verificationData.rejectionReasons.map((reason, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Error color="error" />
                      </ListItemIcon>
                      <ListItemText primary={reason} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Actions
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={fetchVerificationStatus}
                  fullWidth
                >
                  Refresh Status
                </Button>

                {verificationData.status === 'rejected' && (
                  <Button
                    variant="contained"
                    startIcon={<Person />}
                    href="/kyc"
                    fullWidth
                  >
                    Resubmit Documents
                  </Button>
                )}

                <Button
                  variant="outlined"
                  startIcon={<ContactSupport />}
                  fullWidth
                >
                  Contact Support
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VerificationStatus;

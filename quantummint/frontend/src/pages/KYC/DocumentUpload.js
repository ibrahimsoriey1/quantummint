import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  CloudUpload,
  Description,
  Delete,
  CheckCircle,
  Error,
  Warning,
  Image,
  PictureAsPdf
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';

const DocumentUpload = () => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const requiredDocuments = [
    {
      type: 'identity',
      name: 'Government-issued ID',
      description: 'Passport, National ID, or Driver\'s License',
      required: true
    },
    {
      type: 'address',
      name: 'Proof of Address',
      description: 'Utility bill, Bank statement (not older than 3 months)',
      required: true
    },
    {
      type: 'selfie',
      name: 'Selfie with ID',
      description: 'Clear photo of yourself holding your ID',
      required: true
    }
  ];

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      setError('Some files were rejected. Please check file size and format.');
      return;
    }

    setError('');
    const newDocuments = acceptedFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: getDocumentType(file.name),
      status: 'pending',
      uploadProgress: 0
    }));

    setDocuments(prev => [...prev, ...newDocuments]);
    uploadDocuments(newDocuments);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  });

  const getDocumentType = (filename) => {
    // Simple logic to determine document type based on filename
    const lower = filename.toLowerCase();
    if (lower.includes('id') || lower.includes('passport') || lower.includes('license')) {
      return 'identity';
    }
    if (lower.includes('bill') || lower.includes('statement') || lower.includes('address')) {
      return 'address';
    }
    if (lower.includes('selfie') || lower.includes('photo')) {
      return 'selfie';
    }
    return 'other';
  };

  const uploadDocuments = async(docs) => {
    setUploading(true);

    for (const doc of docs) {
      try {
        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setDocuments(prev => prev.map(d =>
            d.id === doc.id ? { ...d, uploadProgress: progress } : d
          ));
        }

        // Simulate upload completion
        setDocuments(prev => prev.map(d =>
          d.id === doc.id ? { ...d, status: 'uploaded', uploadProgress: 100 } : d
        ));

      } catch (err) {
        setDocuments(prev => prev.map(d =>
          d.id === doc.id ? { ...d, status: 'error' } : d
        ));
      }
    }

    setUploading(false);
    setSuccess('Documents uploaded successfully!');
  };

  const removeDocument = (docId) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const getStatusIcon = (status) => {
    switch (status) {
    case 'uploaded':
      return <CheckCircle color="success" />;
    case 'error':
      return <Error color="error" />;
    case 'pending':
      return <Warning color="warning" />;
    default:
      return <Description />;
    }
  };

  const getFileIcon = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return <Image />;
    }
    if (extension === 'pdf') {
      return <PictureAsPdf />;
    }
    return <Description />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDocumentStatus = (type) => {
    const uploaded = documents.filter(d => d.type === type && d.status === 'uploaded');
    return uploaded.length > 0 ? 'completed' : 'pending';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CloudUpload />
        Document Upload
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Required Documents
              </Typography>

              <List>
                {requiredDocuments.map((doc) => (
                  <ListItem key={doc.type}>
                    <ListItemIcon>
                      {getStatusIcon(getDocumentStatus(doc.type))}
                    </ListItemIcon>
                    <ListItemText
                      primary={doc.name}
                      secondary={doc.description}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={getDocumentStatus(doc.type)}
                        color={getDocumentStatus(doc.type) === 'completed' ? 'success' : 'default'}
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Upload Documents
              </Typography>

              <Paper
                {...getRootProps()}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  border: '2px dashed',
                  borderColor: isDragActive ? 'primary.main' : 'grey.300',
                  backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
                  cursor: 'pointer',
                  mb: 2
                }}
              >
                <input {...getInputProps()} />
                <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  or click to select files
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Supported formats: JPG, PNG, PDF (Max 10MB)
                </Typography>
              </Paper>

              {documents.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Uploaded Documents ({documents.length})
                  </Typography>

                  <List dense>
                    {documents.map((doc) => (
                      <ListItem key={doc.id}>
                        <ListItemIcon>
                          {getFileIcon(doc.name)}
                        </ListItemIcon>
                        <ListItemText
                          primary={doc.name}
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                {formatFileSize(doc.size)} • {doc.type}
                              </Typography>
                              {doc.status === 'pending' && doc.uploadProgress < 100 && (
                                <LinearProgress
                                  variant="determinate"
                                  value={doc.uploadProgress}
                                  sx={{ mt: 1 }}
                                />
                              )}
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getStatusIcon(doc.status)}
                            <IconButton
                              edge="end"
                              onClick={() => removeDocument(doc.id)}
                              size="small"
                            >
                              <Delete />
                            </IconButton>
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" href="/kyc">
          Back to KYC
        </Button>

        <Button
          variant="contained"
          disabled={uploading || documents.filter(d => d.status === 'uploaded').length === 0}
          startIcon={uploading ? <CircularProgress size={20} /> : <CheckCircle />}
        >
          {uploading ? 'Processing...' : 'Continue Verification'}
        </Button>
      </Box>
    </Box>
  );
};

export default DocumentUpload;

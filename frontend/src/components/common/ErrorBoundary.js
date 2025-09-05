import React from 'react';
import { Box, Typography, Button, Paper, Accordion, AccordionSummary, AccordionDetails, Alert } from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true,
      errorId: Date.now().toString()
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: send to error reporting service
      // errorReportingService.captureException(error, { extra: errorInfo });
    }
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" color="error" sx={{ mb: 2 }}>
              Oops! Something went wrong
            </Typography>
            
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body1" sx={{ mb: 1 }}>
                We're sorry, but something unexpected happened. This error has been logged and our team will investigate.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Error ID: {this.state.errorId}
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
              <Button 
                variant="contained" 
                startIcon={<RefreshIcon />}
                onClick={this.handleRefresh}
              >
                Refresh Page
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<HomeIcon />}
                onClick={this.handleGoHome}
              >
                Go Home
              </Button>
            </Box>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Error Details (Development Only)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Error:</Typography>
                    <Typography 
                      variant="body2" 
                      component="pre" 
                      sx={{ 
                        backgroundColor: 'grey.100', 
                        p: 1, 
                        borderRadius: 1,
                        overflow: 'auto',
                        fontSize: '0.75rem'
                      }}
                    >
                      {this.state.error.toString()}
                    </Typography>
                    
                    <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>Stack Trace:</Typography>
                    <Typography 
                      variant="body2" 
                      component="pre" 
                      sx={{ 
                        backgroundColor: 'grey.100', 
                        p: 1, 
                        borderRadius: 1,
                        overflow: 'auto',
                        fontSize: '0.75rem'
                      }}
                    >
                      {this.state.errorInfo?.componentStack}
                    </Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;



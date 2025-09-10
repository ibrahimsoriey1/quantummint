import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { OTPInput } from 'input-otp';
import { useAuth } from '../../contexts/AuthContext';

const TwoFactorAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyTwoFactor } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = location.state?.token;
  const from = location.state?.from || '/dashboard';

  if (!token) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          p: 2
        }}
      >
        <Card sx={{ maxWidth: 400, width: '100%' }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom color="error">
              Invalid Access
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              No verification token found. Please login again.
            </Typography>
            <Button
              component={Link}
              to="/login"
              variant="contained"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const handleSubmit = async(e) => {
    e.preventDefault();

    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    const result = await verifyTwoFactor(token, code);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error);
      setCode('');
    }

    setLoading(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 2
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box textAlign="center" mb={3}>
            <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
              Two-Factor Authentication
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enter the 6-digit code from your authenticator app
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Box display="flex" justifyContent="center" mb={3}>
              <OTPInput
                maxLength={6}
                value={code}
                onChange={setCode}
                containerClassName="otp-container"
                render={({ slots }) => (
                  <Box display="flex" gap="8px">
                    {slots.slice(0, 3).map((slot, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          width: '40px',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          borderRadius: '8px',
                          border: slot.isActive ? '2px solid #1976d2' : '1px solid #ccc',
                          backgroundColor: 'white',
                          transition: 'border-color 0.2s',
                          cursor: 'text'
                        }}
                      >
                        {slot.char || ''}
                      </Box>
                    ))}
                    <Box sx={{ width: '8px' }} />
                    {slots.slice(3).map((slot, idx) => (
                      <Box
                        key={idx + 3}
                        sx={{
                          width: '40px',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          borderRadius: '8px',
                          border: slot.isActive ? '2px solid #1976d2' : '1px solid #ccc',
                          backgroundColor: 'white',
                          transition: 'border-color 0.2s',
                          cursor: 'text'
                        }}
                      >
                        {slot.char || ''}
                      </Box>
                    ))}
                  </Box>
                )}
              />
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || code.length !== 6}
              sx={{ mt: 2, mb: 2, py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Verify Code'}
            </Button>

            <Box textAlign="center">
              <Typography variant="body2" color="text.secondary" paragraph>
                Didn&apos;t receive a code? Check your authenticator app or contact support.
              </Typography>
              <Link
                to="/login"
                style={{ textDecoration: 'none', color: '#1976d2' }}
              >
                <Typography variant="body2">
                  Back to Login
                </Typography>
              </Link>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TwoFactorAuth;

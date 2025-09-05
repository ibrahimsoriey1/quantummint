import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Button,
  TextField,
  Typography,
  Link,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../contexts/NotificationContext';

// Validation schema
const LoginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

const Login = () => {
  const { login, isLoading } = useAuth();
  const { showSuccess, showError } = useNotifications();
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setLoginError('');
      await login(values);
      showSuccess('Welcome back! You have been successfully logged in.');
    } catch (error) {
      const errorMessage = error.message || 'Login failed. Please try again.';
      setLoginError(errorMessage);
      showError(errorMessage);
      setSubmitting(false);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom align="center">
        Welcome Back
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
        Sign in to your QuantumMint account
      </Typography>

      {loginError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {loginError}
        </Alert>
      )}

      <Formik
        initialValues={{ email: '', password: '' }}
        validationSchema={LoginSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form>
            <Field
              as={TextField}
              name="email"
              label="Email Address"
              variant="outlined"
              fullWidth
              margin="normal"
              error={touched.email && Boolean(errors.email)}
              helperText={touched.email && errors.email}
              disabled={isLoading || isSubmitting}
            />

            <Field
              as={TextField}
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              variant="outlined"
              fullWidth
              margin="normal"
              error={touched.password && Boolean(errors.password)}
              helperText={touched.password && errors.password}
              disabled={isLoading || isSubmitting}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePassword}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, mb: 2 }}>
              <Link
                component={RouterLink}
                to="/forgot-password"
                variant="body2"
                color="primary"
              >
                Forgot password?
              </Link>
            </Box>

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              disabled={isLoading || isSubmitting}
              sx={{ mb: 2 }}
            >
              {(isLoading || isSubmitting) ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
            </Button>

            <Typography variant="body2" align="center">
              Don't have an account?{' '}
              <Link component={RouterLink} to="/register" color="primary">
                Sign up
              </Link>
            </Typography>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default Login;
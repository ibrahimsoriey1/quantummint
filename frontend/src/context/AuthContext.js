import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import authService from '../services/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const navigate = useNavigate();

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Authentication error:', error);
          logout();
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [token]);

  // Login function
  const login = async (credentials) => {
    try {
      setIsLoading(true);
      const response = await authService.login(credentials);
      
      if (response.twoFactorRequired) {
        // Redirect to 2FA page with email
        navigate('/two-factor-auth', { state: { email: credentials.email } });
        return;
      }
      
      const { token, user } = response;
      
      // Save token to localStorage
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      setIsAuthenticated(true);
      
      toast.success('Login successful!');
      navigate('/');
    } catch (error) {
      toast.error(error.message || 'Login failed. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setIsLoading(true);
      await authService.register(userData);
      toast.success('Registration successful! Please check your email to verify your account.');
      navigate('/login');
    } catch (error) {
      toast.error(error.message || 'Registration failed. Please try again.');
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    navigate('/login');
    toast.info('You have been logged out.');
  };

  // Verify email function
  const verifyEmail = async (token) => {
    try {
      setIsLoading(true);
      await authService.verifyEmail(token);
      toast.success('Email verified successfully! You can now log in.');
      navigate('/login');
    } catch (error) {
      toast.error(error.message || 'Email verification failed. Please try again.');
      console.error('Email verification error:', error);
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password function
  const forgotPassword = async (email) => {
    try {
      setIsLoading(true);
      await authService.forgotPassword(email);
      toast.success('Password reset email sent. Please check your inbox.');
      navigate('/login');
    } catch (error) {
      toast.error(error.message || 'Failed to send reset email. Please try again.');
      console.error('Forgot password error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset password function
  const resetPassword = async (token, password) => {
    try {
      setIsLoading(true);
      await authService.resetPassword(token, password);
      toast.success('Password reset successful! You can now log in with your new password.');
      navigate('/login');
    } catch (error) {
      toast.error(error.message || 'Password reset failed. Please try again.');
      console.error('Reset password error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify two-factor authentication
  const verifyTwoFactor = async (email, code) => {
    try {
      setIsLoading(true);
      const response = await authService.verifyTwoFactor(email, code);
      
      const { token, user } = response;
      
      // Save token to localStorage
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      setIsAuthenticated(true);
      
      toast.success('Two-factor authentication successful!');
      navigate('/');
    } catch (error) {
      toast.error(error.message || 'Two-factor authentication failed. Please try again.');
      console.error('Two-factor authentication error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update user profile
  const updateProfile = async (userData) => {
    try {
      setIsLoading(true);
      const updatedUser = await authService.updateProfile(userData);
      setUser(updatedUser);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to update profile. Please try again.');
      console.error('Update profile error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Change password
  const changePassword = async (passwordData) => {
    try {
      setIsLoading(true);
      await authService.changePassword(passwordData);
      toast.success('Password changed successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to change password. Please try again.');
      console.error('Change password error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Setup two-factor authentication
  const setupTwoFactor = async () => {
    try {
      setIsLoading(true);
      const response = await authService.setupTwoFactor();
      return response;
    } catch (error) {
      toast.error(error.message || 'Failed to setup two-factor authentication. Please try again.');
      console.error('Setup two-factor error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Enable two-factor authentication
  const enableTwoFactor = async (code) => {
    try {
      setIsLoading(true);
      await authService.enableTwoFactor(code);
      
      // Update user object with 2FA enabled
      const updatedUser = { ...user, twoFactorEnabled: true };
      setUser(updatedUser);
      
      toast.success('Two-factor authentication enabled successfully!');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to enable two-factor authentication. Please try again.');
      console.error('Enable two-factor error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Disable two-factor authentication
  const disableTwoFactor = async (code) => {
    try {
      setIsLoading(true);
      await authService.disableTwoFactor(code);
      
      // Update user object with 2FA disabled
      const updatedUser = { ...user, twoFactorEnabled: false };
      setUser(updatedUser);
      
      toast.success('Two-factor authentication disabled successfully!');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to disable two-factor authentication. Please try again.');
      console.error('Disable two-factor error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        verifyEmail,
        forgotPassword,
        resetPassword,
        verifyTwoFactor,
        updateProfile,
        changePassword,
        setupTwoFactor,
        enableTwoFactor,
        disableTwoFactor
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
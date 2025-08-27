import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { jwtDecode } from 'jwt-decode';
import authService from '../../services/authService';

// Helper function to set tokens in localStorage
const setTokens = (accessToken, refreshToken) => {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
};

// Helper function to remove tokens from localStorage
const removeTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Helper function to get user from token
const getUserFromToken = (token) => {
  try {
    const decoded = jwtDecode(token);
    return {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      expiresAt: new Date(decoded.exp * 1000),
    };
  } catch (error) {
    return null;
  }
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const response = await authService.login(username, password);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Login failed' });
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authService.register(userData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Registration failed' });
    }
  }
);

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async ({ userId, token }, { rejectWithValue }) => {
    try {
      const response = await authService.verifyEmail(userId, token);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Email verification failed' });
    }
  }
);

export const verifyTwoFactor = createAsyncThunk(
  'auth/verifyTwoFactor',
  async ({ userId, code, tempToken }, { rejectWithValue }) => {
    try {
      const response = await authService.verifyTwoFactor(userId, code, tempToken);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: '2FA verification failed' });
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        return rejectWithValue({ message: 'No refresh token found' });
      }
      
      const response = await authService.refreshToken(refreshToken);
      return response;
    } catch (error) {
      removeTokens();
      return rejectWithValue(error.response?.data?.error || { message: 'Token refresh failed' });
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      removeTokens();
      return { success: true };
    } catch (error) {
      // Even if the API call fails, we still want to remove tokens
      removeTokens();
      return rejectWithValue(error.response?.data?.error || { message: 'Logout failed' });
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (email, { rejectWithValue }) => {
    try {
      const response = await authService.forgotPassword(email);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Password reset request failed' });
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ userId, token, newPassword }, { rejectWithValue }) => {
    try {
      const response = await authService.resetPassword(userId, token, newPassword);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Password reset failed' });
    }
  }
);

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      const response = await authService.changePassword(currentPassword, newPassword);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Password change failed' });
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const response = await authService.updateProfile(profileData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Profile update failed' });
    }
  }
);

export const enableTwoFactor = createAsyncThunk(
  'auth/enableTwoFactor',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.enableTwoFactor();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: '2FA setup failed' });
    }
  }
);

export const verifyTwoFactorSetup = createAsyncThunk(
  'auth/verifyTwoFactorSetup',
  async (code, { rejectWithValue }) => {
    try {
      const response = await authService.verifyTwoFactorSetup(code);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: '2FA verification failed' });
    }
  }
);

export const disableTwoFactor = createAsyncThunk(
  'auth/disableTwoFactor',
  async (password, { rejectWithValue }) => {
    try {
      const response = await authService.disableTwoFactor(password);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: '2FA disable failed' });
    }
  }
);

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  twoFactorRequired: false,
  tempToken: null,
  userId: null,
  twoFactorSetup: {
    qrCode: null,
    secret: null,
    recoveryCodes: [],
  },
  message: null,
};

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearMessage: (state) => {
      state.message = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        
        if (action.payload.data.twoFactorRequired) {
          state.twoFactorRequired = true;
          state.userId = action.payload.data.userId;
          state.tempToken = action.payload.data.tempToken;
        } else {
          state.isAuthenticated = true;
          state.user = getUserFromToken(action.payload.data.accessToken);
          setTokens(action.payload.data.accessToken, action.payload.data.refreshToken);
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Register
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.message = 'Registration successful. Please verify your email.';
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Verify Email
      .addCase(verifyEmail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyEmail.fulfilled, (state, action) => {
        state.loading = false;
        state.message = 'Email verified successfully. You can now log in.';
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Verify Two Factor
      .addCase(verifyTwoFactor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyTwoFactor.fulfilled, (state, action) => {
        state.loading = false;
        state.twoFactorRequired = false;
        state.tempToken = null;
        state.userId = null;
        state.isAuthenticated = true;
        state.user = getUserFromToken(action.payload.data.accessToken);
        setTokens(action.payload.data.accessToken, action.payload.data.refreshToken);
      })
      .addCase(verifyTwoFactor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Refresh Token
      .addCase(refreshToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = getUserFromToken(action.payload.data.accessToken);
        setTokens(action.payload.data.accessToken, action.payload.data.refreshToken);
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        removeTokens();
      })
      
      // Logout
      .addCase(logout.pending, (state) => {
        state.loading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
      })
      .addCase(logout.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
      })
      
      // Forgot Password
      .addCase(forgotPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.loading = false;
        state.message = 'Password reset instructions sent to your email.';
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Reset Password
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.loading = false;
        state.message = 'Password reset successful. You can now log in.';
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Change Password
      .addCase(changePassword.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.loading = false;
        state.message = 'Password changed successfully.';
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Update Profile
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.message = 'Profile updated successfully.';
        // Update user data if needed
        if (state.user && action.payload.data) {
          state.user = {
            ...state.user,
            ...action.payload.data,
          };
        }
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Enable Two Factor
      .addCase(enableTwoFactor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(enableTwoFactor.fulfilled, (state, action) => {
        state.loading = false;
        state.twoFactorSetup.qrCode = action.payload.data.qrCodeUrl;
        state.twoFactorSetup.secret = action.payload.data.secret;
      })
      .addCase(enableTwoFactor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Verify Two Factor Setup
      .addCase(verifyTwoFactorSetup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyTwoFactorSetup.fulfilled, (state, action) => {
        state.loading = false;
        state.twoFactorSetup.recoveryCodes = action.payload.data.recoveryCodes;
        state.message = 'Two-factor authentication enabled successfully.';
        if (state.user) {
          state.user.twoFactorEnabled = true;
        }
      })
      .addCase(verifyTwoFactorSetup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Disable Two Factor
      .addCase(disableTwoFactor.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(disableTwoFactor.fulfilled, (state) => {
        state.loading = false;
        state.message = 'Two-factor authentication disabled successfully.';
        if (state.user) {
          state.user.twoFactorEnabled = false;
        }
        state.twoFactorSetup = {
          qrCode: null,
          secret: null,
          recoveryCodes: [],
        };
      })
      .addCase(disableTwoFactor.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearMessage } = authSlice.actions;

export default authSlice.reducer;
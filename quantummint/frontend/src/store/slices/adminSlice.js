import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import adminService from '../../services/adminService';

// Async thunks
export const getAllUsers = createAsyncThunk(
  'admin/getAllUsers',
  async (params, { rejectWithValue }) => {
    try {
      const response = await adminService.getAllUsers(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch users' });
    }
  }
);

export const getUserDetails = createAsyncThunk(
  'admin/getUserDetails',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await adminService.getUserDetails(userId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch user details' });
    }
  }
);

export const updateUserStatus = createAsyncThunk(
  'admin/updateUserStatus',
  async ({ userId, status, reason }, { rejectWithValue }) => {
    try {
      const response = await adminService.updateUserStatus(userId, status, reason);
      return { ...response, userId, status };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to update user status' });
    }
  }
);

export const reviewKYC = createAsyncThunk(
  'admin/reviewKYC',
  async ({ verificationId, status, notes, rejectionReason }, { rejectWithValue }) => {
    try {
      const response = await adminService.reviewKYC(verificationId, status, notes, rejectionReason);
      return { ...response, verificationId, status };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to review KYC' });
    }
  }
);

export const getSystemStatistics = createAsyncThunk(
  'admin/getSystemStatistics',
  async (period, { rejectWithValue }) => {
    try {
      const response = await adminService.getSystemStatistics(period);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch system statistics' });
    }
  }
);

export const getPendingKYC = createAsyncThunk(
  'admin/getPendingKYC',
  async (params, { rejectWithValue }) => {
    try {
      const response = await adminService.getPendingKYC(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch pending KYC verifications' });
    }
  }
);

// Initial state
const initialState = {
  users: [],
  currentUser: null,
  kycVerifications: [],
  statistics: null,
  usersPagination: {
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    itemsPerPage: 10,
  },
  kycPagination: {
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    itemsPerPage: 10,
  },
  loading: false,
  error: null,
  message: null,
};

// Admin slice
const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearMessage: (state) => {
      state.message = null;
    },
    resetCurrentUser: (state) => {
      state.currentUser = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get All Users
      .addCase(getAllUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.data.users;
        state.usersPagination = action.payload.data.pagination;
      })
      .addCase(getAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get User Details
      .addCase(getUserDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUserDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload.data;
      })
      .addCase(getUserDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Update User Status
      .addCase(updateUserStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(updateUserStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.message = 'User status updated successfully.';
        
        // Update user in users array
        const index = state.users.findIndex(user => user.userId === action.payload.userId);
        if (index !== -1) {
          state.users[index].status = action.payload.status;
        }
        
        // Update current user if it's the same user
        if (state.currentUser && state.currentUser.userId === action.payload.userId) {
          state.currentUser.status = action.payload.status;
        }
      })
      .addCase(updateUserStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Review KYC
      .addCase(reviewKYC.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(reviewKYC.fulfilled, (state, action) => {
        state.loading = false;
        state.message = 'KYC verification reviewed successfully.';
        
        // Update KYC verification in array
        const index = state.kycVerifications.findIndex(
          verification => verification.verificationId === action.payload.verificationId
        );
        
        if (index !== -1) {
          state.kycVerifications[index].status = action.payload.status;
          state.kycVerifications[index].verifiedAt = new Date().toISOString();
        }
      })
      .addCase(reviewKYC.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get System Statistics
      .addCase(getSystemStatistics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSystemStatistics.fulfilled, (state, action) => {
        state.loading = false;
        state.statistics = action.payload.data;
      })
      .addCase(getSystemStatistics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get Pending KYC
      .addCase(getPendingKYC.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getPendingKYC.fulfilled, (state, action) => {
        state.loading = false;
        state.kycVerifications = action.payload.data.verifications;
        state.kycPagination = action.payload.data.pagination;
      })
      .addCase(getPendingKYC.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearMessage, resetCurrentUser } = adminSlice.actions;

export default adminSlice.reducer;
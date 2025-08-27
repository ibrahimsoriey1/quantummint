import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import kycService from '../../services/kycService';

// Async thunks
export const submitKYC = createAsyncThunk(
  'kyc/submitKYC',
  async (kycData, { rejectWithValue }) => {
    try {
      const response = await kycService.submitKYC(kycData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'KYC submission failed' });
    }
  }
);

export const getKYCStatus = createAsyncThunk(
  'kyc/getKYCStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await kycService.getKYCStatus();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch KYC status' });
    }
  }
);

// Initial state
const initialState = {
  kycStatus: 'not_submitted', // not_submitted, pending, verified, rejected
  verificationId: null,
  submittedAt: null,
  verifiedAt: null,
  rejectionReason: null,
  loading: false,
  error: null,
  message: null,
};

// KYC slice
const kycSlice = createSlice({
  name: 'kyc',
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
      // Submit KYC
      .addCase(submitKYC.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(submitKYC.fulfilled, (state, action) => {
        state.loading = false;
        state.kycStatus = 'pending';
        state.verificationId = action.payload.data.verificationId;
        state.submittedAt = new Date().toISOString();
        state.message = 'KYC information submitted successfully.';
      })
      .addCase(submitKYC.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get KYC Status
      .addCase(getKYCStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getKYCStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.kycStatus = action.payload.data.status;
        
        if (action.payload.data.verificationId) {
          state.verificationId = action.payload.data.verificationId;
        }
        
        if (action.payload.data.submittedAt) {
          state.submittedAt = action.payload.data.submittedAt;
        }
        
        if (action.payload.data.verifiedAt) {
          state.verifiedAt = action.payload.data.verifiedAt;
        }
        
        if (action.payload.data.rejectionReason) {
          state.rejectionReason = action.payload.data.rejectionReason;
        }
      })
      .addCase(getKYCStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearMessage } = kycSlice.actions;

export default kycSlice.reducer;
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import transactionService from '../../services/transactionService';

// Async thunks
export const getTransactionHistory = createAsyncThunk(
  'transaction/getTransactionHistory',
  async (params, { rejectWithValue }) => {
    try {
      const response = await transactionService.getTransactionHistory(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch transaction history' });
    }
  }
);

export const getTransactionDetails = createAsyncThunk(
  'transaction/getTransactionDetails',
  async (transactionId, { rejectWithValue }) => {
    try {
      const response = await transactionService.getTransactionDetails(transactionId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch transaction details' });
    }
  }
);

// Initial state
const initialState = {
  transactions: [],
  currentTransaction: null,
  pagination: {
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    itemsPerPage: 10,
  },
  loading: false,
  error: null,
};

// Transaction slice
const transactionSlice = createSlice({
  name: 'transaction',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetCurrentTransaction: (state) => {
      state.currentTransaction = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get Transaction History
      .addCase(getTransactionHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTransactionHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload.data.transactions;
        state.pagination = action.payload.data.pagination;
      })
      .addCase(getTransactionHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get Transaction Details
      .addCase(getTransactionDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTransactionDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.currentTransaction = action.payload.data;
      })
      .addCase(getTransactionDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, resetCurrentTransaction } = transactionSlice.actions;

export default transactionSlice.reducer;
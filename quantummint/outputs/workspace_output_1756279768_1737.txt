import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import cashOutService from '../../services/cashOutService';

// Async thunks
export const getPaymentProviders = createAsyncThunk(
  'cashOut/getPaymentProviders',
  async (_, { rejectWithValue }) => {
    try {
      const response = await cashOutService.getPaymentProviders();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch payment providers' });
    }
  }
);

export const initiateCashOut = createAsyncThunk(
  'cashOut/initiateCashOut',
  async (cashOutData, { rejectWithValue }) => {
    try {
      const response = await cashOutService.initiateCashOut(cashOutData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Cash out request failed' });
    }
  }
);

export const getCashOutStatus = createAsyncThunk(
  'cashOut/getCashOutStatus',
  async (cashOutId, { rejectWithValue }) => {
    try {
      const response = await cashOutService.getCashOutStatus(cashOutId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch cash out status' });
    }
  }
);

export const getCashOutHistory = createAsyncThunk(
  'cashOut/getCashOutHistory',
  async (params, { rejectWithValue }) => {
    try {
      const response = await cashOutService.getCashOutHistory(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch cash out history' });
    }
  }
);

// Initial state
const initialState = {
  providers: [],
  currentCashOut: null,
  cashOutHistory: [],
  pagination: {
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    itemsPerPage: 10,
  },
  loading: false,
  error: null,
  message: null,
};

// Cash Out slice
const cashOutSlice = createSlice({
  name: 'cashOut',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearMessage: (state) => {
      state.message = null;
    },
    resetCurrentCashOut: (state) => {
      state.currentCashOut = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get Payment Providers
      .addCase(getPaymentProviders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getPaymentProviders.fulfilled, (state, action) => {
        state.loading = false;
        state.providers = action.payload.data.providers;
      })
      .addCase(getPaymentProviders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Initiate Cash Out
      .addCase(initiateCashOut.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(initiateCashOut.fulfilled, (state, action) => {
        state.loading = false;
        state.currentCashOut = action.payload.data;
        state.message = 'Cash out request initiated successfully.';
      })
      .addCase(initiateCashOut.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get Cash Out Status
      .addCase(getCashOutStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getCashOutStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.currentCashOut = action.payload.data;
      })
      .addCase(getCashOutStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get Cash Out History
      .addCase(getCashOutHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getCashOutHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.cashOutHistory = action.payload.data.cashOuts;
        state.pagination = action.payload.data.pagination;
      })
      .addCase(getCashOutHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearMessage, resetCurrentCashOut } = cashOutSlice.actions;

export default cashOutSlice.reducer;
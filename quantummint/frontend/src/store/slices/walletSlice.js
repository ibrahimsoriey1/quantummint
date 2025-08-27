import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import walletService from '../../services/walletService';

// Async thunks
export const getUserWallets = createAsyncThunk(
  'wallet/getUserWallets',
  async (_, { rejectWithValue }) => {
    try {
      const response = await walletService.getUserWallets();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch wallets' });
    }
  }
);

export const getWalletDetails = createAsyncThunk(
  'wallet/getWalletDetails',
  async (walletId, { rejectWithValue }) => {
    try {
      const response = await walletService.getWalletDetails(walletId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch wallet details' });
    }
  }
);

// Initial state
const initialState = {
  wallets: [],
  currentWallet: null,
  loading: false,
  error: null,
};

// Wallet slice
const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentWallet: (state, action) => {
      state.currentWallet = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get User Wallets
      .addCase(getUserWallets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUserWallets.fulfilled, (state, action) => {
        state.loading = false;
        state.wallets = action.payload.data.wallets;
        
        // Set current wallet if not already set
        if (!state.currentWallet && action.payload.data.wallets.length > 0) {
          state.currentWallet = action.payload.data.wallets[0];
        }
      })
      .addCase(getUserWallets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get Wallet Details
      .addCase(getWalletDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getWalletDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.currentWallet = action.payload.data;
        
        // Update wallet in wallets array
        const index = state.wallets.findIndex(wallet => wallet.walletId === action.payload.data.walletId);
        if (index !== -1) {
          state.wallets[index] = action.payload.data;
        }
      })
      .addCase(getWalletDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, setCurrentWallet } = walletSlice.actions;

export default walletSlice.reducer;
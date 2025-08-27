import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import generationService from '../../services/generationService';

// Async thunks
export const generateMoney = createAsyncThunk(
  'generation/generateMoney',
  async ({ walletId, amount, generationMethod }, { rejectWithValue }) => {
    try {
      const response = await generationService.generateMoney(walletId, amount, generationMethod);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Money generation failed' });
    }
  }
);

export const verifyGeneration = createAsyncThunk(
  'generation/verifyGeneration',
  async ({ generationId, verificationCode }, { rejectWithValue }) => {
    try {
      const response = await generationService.verifyGeneration(generationId, verificationCode);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Generation verification failed' });
    }
  }
);

export const getGenerationStatus = createAsyncThunk(
  'generation/getGenerationStatus',
  async (generationId, { rejectWithValue }) => {
    try {
      const response = await generationService.getGenerationStatus(generationId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch generation status' });
    }
  }
);

export const getGenerationHistory = createAsyncThunk(
  'generation/getGenerationHistory',
  async (params, { rejectWithValue }) => {
    try {
      const response = await generationService.getGenerationHistory(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch generation history' });
    }
  }
);

// Initial state
const initialState = {
  currentGeneration: null,
  generationHistory: [],
  pagination: {
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    itemsPerPage: 10,
  },
  loading: false,
  error: null,
  message: null,
  verificationRequired: false,
};

// Generation slice
const generationSlice = createSlice({
  name: 'generation',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearMessage: (state) => {
      state.message = null;
    },
    resetCurrentGeneration: (state) => {
      state.currentGeneration = null;
      state.verificationRequired = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Generate Money
      .addCase(generateMoney.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(generateMoney.fulfilled, (state, action) => {
        state.loading = false;
        state.currentGeneration = action.payload.data;
        state.verificationRequired = true;
        state.message = 'Money generation initiated. Please verify to complete.';
      })
      .addCase(generateMoney.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Verify Generation
      .addCase(verifyGeneration.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.message = null;
      })
      .addCase(verifyGeneration.fulfilled, (state, action) => {
        state.loading = false;
        state.currentGeneration = action.payload.data;
        state.verificationRequired = false;
        state.message = 'Money generation completed successfully.';
      })
      .addCase(verifyGeneration.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get Generation Status
      .addCase(getGenerationStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getGenerationStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.currentGeneration = action.payload.data;
        state.verificationRequired = action.payload.data.status === 'pending';
      })
      .addCase(getGenerationStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get Generation History
      .addCase(getGenerationHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getGenerationHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.generationHistory = action.payload.data.generations;
        state.pagination = action.payload.data.pagination;
      })
      .addCase(getGenerationHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearMessage, resetCurrentGeneration } = generationSlice.actions;

export default generationSlice.reducer;
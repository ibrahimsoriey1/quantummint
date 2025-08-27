import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import walletReducer from './slices/walletSlice';
import transactionReducer from './slices/transactionSlice';
import generationReducer from './slices/generationSlice';
import cashOutReducer from './slices/cashOutSlice';
import kycReducer from './slices/kycSlice';
import notificationReducer from './slices/notificationSlice';
import adminReducer from './slices/adminSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    wallet: walletReducer,
    transaction: transactionReducer,
    generation: generationReducer,
    cashOut: cashOutReducer,
    kyc: kycReducer,
    notification: notificationReducer,
    admin: adminReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['auth/loginSuccess', 'auth/refreshTokenSuccess'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.expiresAt'],
        // Ignore these paths in the state
        ignoredPaths: ['auth.user.expiresAt'],
      },
    }),
});
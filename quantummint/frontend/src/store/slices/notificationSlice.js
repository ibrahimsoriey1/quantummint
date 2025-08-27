import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import notificationService from '../../services/notificationService';

// Async thunks
export const getNotifications = createAsyncThunk(
  'notification/getNotifications',
  async (params, { rejectWithValue }) => {
    try {
      const response = await notificationService.getNotifications(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch notifications' });
    }
  }
);

export const markNotificationAsRead = createAsyncThunk(
  'notification/markNotificationAsRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      const response = await notificationService.markNotificationAsRead(notificationId);
      return { ...response, notificationId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to mark notification as read' });
    }
  }
);

export const markAllNotificationsAsRead = createAsyncThunk(
  'notification/markAllNotificationsAsRead',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notificationService.markAllNotificationsAsRead();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to mark all notifications as read' });
    }
  }
);

// Initial state
const initialState = {
  notifications: [],
  unreadCount: 0,
  pagination: {
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    itemsPerPage: 10,
  },
  loading: false,
  error: null,
};

// Notification slice
const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    addNotification: (state, action) => {
      state.notifications.unshift(action.payload);
      state.unreadCount += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get Notifications
      .addCase(getNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload.data.notifications;
        state.pagination = action.payload.data.pagination;
        state.unreadCount = action.payload.data.notifications.filter(notification => !notification.read).length;
      })
      .addCase(getNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Mark Notification as Read
      .addCase(markNotificationAsRead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        state.loading = false;
        
        // Update notification in state
        const index = state.notifications.findIndex(notification => 
          notification.notificationId === action.payload.notificationId
        );
        
        if (index !== -1) {
          state.notifications[index].read = true;
          state.notifications[index].readAt = new Date().toISOString();
          
          // Update unread count
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markNotificationAsRead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Mark All Notifications as Read
      .addCase(markAllNotificationsAsRead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.loading = false;
        
        // Mark all notifications as read
        state.notifications.forEach(notification => {
          notification.read = true;
          notification.readAt = new Date().toISOString();
        });
        
        // Reset unread count
        state.unreadCount = 0;
      })
      .addCase(markAllNotificationsAsRead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, addNotification } = notificationSlice.actions;

export default notificationSlice.reducer;
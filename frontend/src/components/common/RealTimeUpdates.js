import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Paper, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';
import { 
  CheckCircle as CheckCircleIcon, 
  Error as ErrorIcon, 
  Info as InfoIcon,
  Warning as WarningIcon 
} from '@mui/icons-material';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useNotifications } from '../../contexts/NotificationContext';

const RealTimeUpdates = () => {
  const { showSuccess, showError, showInfo, showWarning } = useNotifications();
  const [updates, setUpdates] = useState([]);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalVolume: 0,
    activeUsers: 0,
    systemHealth: 'healthy'
  });

  const { connected, emit, on, off } = useWebSocket(process.env.REACT_APP_WS_URL || 'ws://localhost:3000', {
    auth: {
      token: localStorage.getItem('token')
    }
  });

  useEffect(() => {
    if (!connected) return;

    // Listen for real-time updates
    const handleTransactionUpdate = (data) => {
      setUpdates(prev => [{
        id: Date.now(),
        type: 'transaction',
        message: `New transaction: ${data.amount} ${data.currency}`,
        timestamp: new Date(),
        status: data.status
      }, ...prev.slice(0, 9)]); // Keep only last 10 updates

      if (data.status === 'completed') {
        showSuccess(`Transaction completed: ${data.amount} ${data.currency}`);
      } else if (data.status === 'failed') {
        showError(`Transaction failed: ${data.amount} ${data.currency}`);
      }
    };

    const handleUserUpdate = (data) => {
      setUpdates(prev => [{
        id: Date.now(),
        type: 'user',
        message: `User ${data.action}: ${data.username}`,
        timestamp: new Date(),
        status: data.action
      }, ...prev.slice(0, 9)]);

      if (data.action === 'registered') {
        showInfo(`New user registered: ${data.username}`);
      }
    };

    const handleSystemUpdate = (data) => {
      setUpdates(prev => [{
        id: Date.now(),
        type: 'system',
        message: data.message,
        timestamp: new Date(),
        status: data.level
      }, ...prev.slice(0, 9)]);

      if (data.level === 'error') {
        showError(data.message);
      } else if (data.level === 'warning') {
        showWarning(data.message);
      }
    };

    const handleStatsUpdate = (data) => {
      setStats(data);
    };

    // Register event listeners
    on('transaction_update', handleTransactionUpdate);
    on('user_update', handleUserUpdate);
    on('system_update', handleSystemUpdate);
    on('stats_update', handleStatsUpdate);

    // Request initial stats
    emit('get_stats');

    // Cleanup
    return () => {
      off('transaction_update', handleTransactionUpdate);
      off('user_update', handleUserUpdate);
      off('system_update', handleSystemUpdate);
      off('stats_update', handleStatsUpdate);
    };
  }, [connected, emit, on, off, showSuccess, showError, showInfo, showWarning]);

  const getUpdateIcon = (type, status) => {
    switch (type) {
      case 'transaction':
        return status === 'completed' ? <CheckCircleIcon color="success" /> : 
               status === 'failed' ? <ErrorIcon color="error" /> : 
               <InfoIcon color="info" />;
      case 'user':
        return <InfoIcon color="info" />;
      case 'system':
        return status === 'error' ? <ErrorIcon color="error" /> :
               status === 'warning' ? <WarningIcon color="warning" /> :
               <InfoIcon color="info" />;
      default:
        return <InfoIcon />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'registered':
        return 'success';
      case 'failed':
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {/* Real-time Stats */}
      <Paper sx={{ p: 2, flex: 1, minWidth: 200 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Live Statistics</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">Total Transactions:</Typography>
            <Typography variant="body2" fontWeight="bold">{stats.totalTransactions}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">Total Volume:</Typography>
            <Typography variant="body2" fontWeight="bold">${stats.totalVolume.toLocaleString()}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2">Active Users:</Typography>
            <Typography variant="body2" fontWeight="bold">{stats.activeUsers}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2">System Health:</Typography>
            <Chip 
              label={stats.systemHealth} 
              color={stats.systemHealth === 'healthy' ? 'success' : 'error'}
              size="small"
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2">Connection:</Typography>
            <Chip 
              label={connected ? 'Connected' : 'Disconnected'} 
              color={connected ? 'success' : 'error'}
              size="small"
            />
          </Box>
        </Box>
      </Paper>

      {/* Recent Updates */}
      <Paper sx={{ p: 2, flex: 1, minWidth: 300 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Recent Updates</Typography>
        <List sx={{ maxHeight: 300, overflow: 'auto' }}>
          {updates.length === 0 ? (
            <ListItem>
              <ListItemText 
                primary="No recent updates" 
                secondary="Real-time updates will appear here"
              />
            </ListItem>
          ) : (
            updates.map((update) => (
              <ListItem key={update.id} sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {getUpdateIcon(update.type, update.status)}
                </ListItemIcon>
                <ListItemText
                  primary={update.message}
                  secondary={update.timestamp.toLocaleTimeString()}
                />
                <Chip 
                  label={update.status} 
                  color={getStatusColor(update.status)}
                  size="small"
                  sx={{ ml: 1 }}
                />
              </ListItem>
            ))
          )}
        </List>
      </Paper>
    </Box>
  );
};

export default RealTimeUpdates;






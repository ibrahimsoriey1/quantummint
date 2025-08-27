import React from 'react';
import { Alert, Snackbar, AlertTitle } from '@mui/material';

/**
 * Alert message component for displaying success, error, info, and warning messages
 * @param {Object} props - Component props
 * @param {string} props.severity - Alert severity (success, error, info, warning)
 * @param {string} props.message - Alert message
 * @param {string} props.title - Alert title (optional)
 * @param {boolean} props.open - Whether the alert is open
 * @param {Function} props.onClose - Function to call when the alert is closed
 * @param {number} props.autoHideDuration - Auto hide duration in milliseconds (default: 6000)
 * @param {Object} props.sx - Additional styles
 * @returns {JSX.Element} Alert message component
 */
const AlertMessage = ({
  severity = 'info',
  message,
  title,
  open,
  onClose,
  autoHideDuration = 6000,
  sx = {},
}) => {
  if (!message) return null;

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        sx={{ width: '100%', ...sx }}
      >
        {title && <AlertTitle>{title}</AlertTitle>}
        {message}
      </Alert>
    </Snackbar>
  );
};

export default AlertMessage;
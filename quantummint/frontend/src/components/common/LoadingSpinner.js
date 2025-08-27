import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Loading spinner component
 * @param {Object} props - Component props
 * @param {string} props.message - Loading message
 * @param {boolean} props.fullScreen - Whether to display full screen
 * @param {number} props.size - Size of the spinner
 * @param {Object} props.sx - Additional styles
 * @returns {JSX.Element} Loading spinner component
 */
const LoadingSpinner = ({
  message = 'Loading...',
  fullScreen = false,
  size = 40,
  sx = {},
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: fullScreen ? '100vh' : '100%',
        width: '100%',
        p: 3,
        ...sx,
      }}
    >
      <CircularProgress size={size} />
      {message && (
        <Typography variant="body1" sx={{ mt: 2, color: 'text.secondary' }}>
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingSpinner;
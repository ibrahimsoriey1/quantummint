import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const PagePlaceholder = ({ title, description, ctaText = 'Go to Dashboard', ctaHref = '/' }) => {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh" textAlign="center" px={2}>
      <Typography variant="h4" gutterBottom>{title}</Typography>
      {description && (
        <Typography variant="body1" color="text.secondary" mb={3} maxWidth={600}>
          {description}
        </Typography>
      )}
      <Button variant="contained" color="primary" component={RouterLink} to={ctaHref}>
        {ctaText}
      </Button>
    </Box>
  );
};

export default PagePlaceholder;




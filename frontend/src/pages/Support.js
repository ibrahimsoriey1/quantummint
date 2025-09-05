import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText } from '@mui/material';

const Support = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Support</Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Contact</Typography>
        <List dense>
          <ListItem><ListItemText primary="Email" secondary="support@quantummint.com" /></ListItem>
          <ListItem><ListItemText primary="Status Page" secondary="status.quantummint.com" /></ListItem>
          <ListItem><ListItemText primary="Documentation" secondary="docs.quantummint.com" /></ListItem>
        </List>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Common Topics</Typography>
        <List dense>
          <ListItem><ListItemText primary="KYC Verification" secondary="Required documents and processing times." /></ListItem>
          <ListItem><ListItemText primary="Provider Integrations" secondary="Connecting Stripe, mobile money, webhooks." /></ListItem>
          <ListItem><ListItemText primary="Security" secondary="Enabling 2FA, password best practices." /></ListItem>
          <ListItem><ListItemText primary="Troubleshooting" secondary="Handling failed transactions and retries." /></ListItem>
        </List>
      </Paper>
    </Box>
  );
};

export default Support;


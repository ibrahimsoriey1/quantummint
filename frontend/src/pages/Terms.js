import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText } from '@mui/material';

const Terms = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Terms & Conditions</Typography>
      <Paper sx={{ p: 3 }}>
        <Typography sx={{ mb: 2 }}>
          By accessing or using QuantumMint, you agree to the following terms and conditions.
        </Typography>
        <List dense>
          <ListItem><ListItemText primary="Use of Service" secondary="You agree to comply with all applicable laws and not misuse the platform." /></ListItem>
          <ListItem><ListItemText primary="Account Security" secondary="You are responsible for maintaining the confidentiality of your account credentials." /></ListItem>
          <ListItem><ListItemText primary="Prohibited Activities" secondary="Fraud, money laundering, or any illegal activity is strictly forbidden." /></ListItem>
          <ListItem><ListItemText primary="Fees & Pricing" secondary="Certain features may incur fees. Pricing is subject to change with notice." /></ListItem>
          <ListItem><ListItemText primary="Termination" secondary="We may suspend or terminate accounts that violate these terms." /></ListItem>
          <ListItem><ListItemText primary="Limitation of Liability" secondary="QuantumMint is provided “as is” without warranties, to the extent permitted by law." /></ListItem>
          <ListItem><ListItemText primary="Changes to Terms" secondary="Terms may be updated periodically. Continued use constitutes acceptance." /></ListItem>
        </List>
      </Paper>
    </Box>
  );
};

export default Terms;


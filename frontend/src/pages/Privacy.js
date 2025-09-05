import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText } from '@mui/material';

const Privacy = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Privacy Policy</Typography>
      <Paper sx={{ p: 3 }}>
        <Typography sx={{ mb: 2 }}>
          We value your privacy and are committed to protecting your personal data.
        </Typography>
        <List dense>
          <ListItem><ListItemText primary="Data We Collect" secondary="Account details, contact information, and technical metadata for security." /></ListItem>
          <ListItem><ListItemText primary="How We Use Data" secondary="To provide services, prevent fraud, and improve platform reliability." /></ListItem>
          <ListItem><ListItemText primary="Sharing" secondary="We do not sell your data. Limited sharing occurs with providers to process transactions." /></ListItem>
          <ListItem><ListItemText primary="Security" secondary="Encryption in transit and at rest; access controls; regular audits." /></ListItem>
          <ListItem><ListItemText primary="Your Rights" secondary="Access, correction, deletion, and export subject to applicable laws." /></ListItem>
          <ListItem><ListItemText primary="Retention" secondary="We retain data as required for legal, accounting, and security obligations." /></ListItem>
          <ListItem><ListItemText primary="Contact" secondary="privacy@quantummint.com for privacy-related requests." /></ListItem>
        </List>
      </Paper>
    </Box>
  );
};

export default Privacy;


import React from 'react';
import { Box, Typography, Grid, Paper, List, ListItem, ListItemText, Divider } from '@mui/material';

const About = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>About QuantumMint</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        QuantumMint is a secure digital money generation and transaction platform providing
        seamless wallet management, KYC verification, and integrations with leading payment providers.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Our Mission</Typography>
            <Typography color="text.secondary">
              Empower users and businesses with reliable digital cashflow tools, transparent pricing,
              and enterprise-grade security across regions.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>What We Offer</Typography>
            <List dense>
              <ListItem><ListItemText primary="Instant money generation and transfers" /></ListItem>
              <ListItem><ListItemText primary="Multi-currency wallets and balances" /></ListItem>
              <ListItem><ListItemText primary="Integrated KYC flows and document verification" /></ListItem>
              <ListItem><ListItemText primary="Two-factor authentication and session security" /></ListItem>
              <ListItem><ListItemText primary="Provider integrations (e.g., Stripe, mobile money)" /></ListItem>
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Values</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle1">Security</Typography>
                <Typography color="text.secondary">Zero trust principles, 2FA, audit logs, and encrypted data in transit and at rest.</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle1">Reliability</Typography>
                <Typography color="text.secondary">Redundant services, health checks, and continuous monitoring for high availability.</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle1">Compliance</Typography>
                <Typography color="text.secondary">KYC-ready workflows and robust data retention policies.</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default About;


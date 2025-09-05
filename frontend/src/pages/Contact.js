import React, { useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Alert } from '@mui/material';

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    // In a real app, post to a support endpoint or ticketing system
    setSent(true);
    setForm({ name: '', email: '', message: '' });
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Contact Us</Typography>
      {sent && <Alert severity="success" sx={{ mb: 2 }}>Your message has been sent. We will get back to you shortly.</Alert>}
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Your Name" name="name" value={form.name} onChange={onChange} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Email" name="email" value={form.email} onChange={onChange} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Message" name="message" value={form.message} onChange={onChange} multiline rows={4} />
            </Grid>
            <Grid item xs={12}>
              <Button type="submit" variant="contained">Send Message</Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default Contact;


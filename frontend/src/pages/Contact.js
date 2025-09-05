import React, { useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Alert } from '@mui/material';
import { useFormValidation } from '../hooks/useFormValidation';
import { contactSchema } from '../utils/validationSchemas';
import { useNotifications } from '../contexts/NotificationContext';

const Contact = () => {
  const { showSuccess, showError } = useNotifications();
  const [loading, setLoading] = useState(false);
  
  const {
    values,
    errors,
    touched,
    isValid,
    handleChange,
    handleBlur,
    resetForm,
    validateForm,
    getFieldProps
  } = useFormValidation(
    { name: '', email: '', subject: '', message: '' },
    contactSchema
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    
    const isFormValid = await validateForm();
    if (!isFormValid) return;
    
    setLoading(true);
    try {
      // In a real app, post to a support endpoint or ticketing system
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      showSuccess('Your message has been sent successfully! We will get back to you shortly.');
      resetForm();
    } catch (error) {
      showError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Contact Us</Typography>
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                label="Your Name" 
                {...getFieldProps('name')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                label="Email" 
                {...getFieldProps('email')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Subject" 
                {...getFieldProps('subject')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Message" 
                multiline 
                rows={4} 
                {...getFieldProps('message')}
              />
            </Grid>
            <Grid item xs={12}>
              <Button 
                type="submit" 
                variant="contained" 
                disabled={loading || !isValid}
                fullWidth
              >
                {loading ? 'Sending...' : 'Send Message'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default Contact;


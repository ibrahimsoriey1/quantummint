import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Container, Paper, Typography, useTheme, useMediaQuery } from '@mui/material';

const AuthLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(45deg, #4a148c 30%, #7c43bd 90%)',
      }}
    >
      <Container maxWidth="lg" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', py: 4 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            width: '100%',
            height: isMobile ? 'auto' : '600px',
            borderRadius: 4,
            overflow: 'hidden',
            boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.15)',
          }}
        >
          {/* Left side - Branding */}
          <Box
            sx={{
              flex: isMobile ? 'none' : 1,
              bgcolor: 'primary.dark',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              p: 4,
              textAlign: 'center',
              backgroundImage: 'url(/static/images/auth-bg.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(74, 20, 140, 0.85)',
              },
            }}
          >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
                QuantumMint
              </Typography>
              <Typography variant="h6" sx={{ mb: 4 }}>
                Generate Digital Money Securely
              </Typography>
              <Typography variant="body1" sx={{ maxWidth: '400px', mx: 'auto' }}>
                A comprehensive platform for generating digital money with secure cash-out options through multiple payment providers.
              </Typography>
            </Box>
          </Box>

          {/* Right side - Auth Forms */}
          <Paper
            elevation={0}
            sx={{
              flex: isMobile ? 'none' : 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              p: { xs: 3, sm: 6 },
              bgcolor: 'background.paper',
            }}
          >
            <Outlet />
          </Paper>
        </Box>
      </Container>

      <Box
        component="footer"
        sx={{
          py: 2,
          textAlign: 'center',
          color: 'white',
        }}
      >
        <Typography variant="body2">
          &copy; {new Date().getFullYear()} QuantumMint. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
};

export default AuthLayout;
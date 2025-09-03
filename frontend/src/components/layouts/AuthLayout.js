import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Container, Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import Logo from '../common/Logo';

const AuthWrapper = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
}));

const AuthContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  width: '100%',
  maxWidth: 450,
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.12)',
}));

const AuthHeader = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(4),
  textAlign: 'center',
}));

const AuthFooter = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(4),
  textAlign: 'center',
}));

const AuthLayout = () => {
  return (
    <AuthWrapper>
      <Container maxWidth="sm">
        <AuthContainer>
          <AuthHeader>
            <Logo size="large" />
          </AuthHeader>
          
          <Outlet />
          
          <AuthFooter>
            <Typography variant="body2" color="text.secondary">
              &copy; {new Date().getFullYear()} QuantumMint. All rights reserved.
            </Typography>
          </AuthFooter>
        </AuthContainer>
      </Container>
    </AuthWrapper>
  );
};

export default AuthLayout;
import React from 'react';
import { Box, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { styled } from '@mui/material/styles';

const LogoWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  textDecoration: 'none',
  color: 'inherit',
}));

const LogoIcon = styled(Box)(({ theme, size }) => ({
  width: size === 'large' ? 48 : size === 'medium' ? 40 : 32,
  height: size === 'large' ? 48 : size === 'medium' ? 40 : 32,
  borderRadius: '50%',
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: theme.spacing(1),
  color: '#fff',
  fontWeight: 'bold',
  fontSize: size === 'large' ? 24 : size === 'medium' ? 20 : 16,
}));

const LogoText = styled(Typography)(({ theme, size }) => ({
  fontWeight: 700,
  fontSize: size === 'large' ? 24 : size === 'medium' ? 20 : 16,
  background: `-webkit-linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}));

const Logo = ({ size = 'medium', onClick }) => {
  return (
    <LogoWrapper component={Link} to="/" onClick={onClick}>
      <LogoIcon size={size}>Q</LogoIcon>
      <LogoText variant="h6" size={size}>
        QuantumMint
      </LogoText>
    </LogoWrapper>
  );
};

export default Logo;
import { PropsWithChildren } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItemButton, ListItemText, Box, Button, Badge } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { useRealtime } from '../hooks/useRealtime';

export default function Shell({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [kycPending, setKycPending] = useState(false);

  useEffect(() => {
    api.get('/api/v1/kyc/user/applications').then((res) => {
      const hasPending = (res.data?.data || []).some((k: any) => ['pending','submitted','under_review','on_hold'].includes(k.status));
      setKycPending(!!hasPending);
    }).catch(() => setKycPending(false));
  }, []);

  useRealtime(undefined, (k) => {
    if (k?.status) setKycPending(['pending','submitted','under_review','on_hold'].includes(k.status));
  });

  const navItems = [
    { label: 'Dashboard', to: '/' },
    { label: 'Wallet', to: '/wallet' },
    { label: 'Transactions', to: '/transactions' },
    { label: 'Payments', to: '/payments' },
    { label: 'KYC', to: '/kyc' },
    { label: 'Transfer', to: '/transfer' },
    { label: 'Balance', to: '/balance' },
    { label: 'KYC Upload', to: '/kyc/upload' },
    { label: 'Card Pay', to: '/pay/card' },
  ];

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>QuantumMint</Typography>
          <Button color="inherit" onClick={logout}>Logout</Button>
        </Toolbar>
      </AppBar>
      <Drawer open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 250 }} role="presentation" onClick={() => setOpen(false)}>
          <List>
            {navItems.map((item) => (
              <ListItemButton key={item.to} onClick={() => navigate(item.to)}>
                {item.label === 'KYC' ? (
                  <Badge color="warning" variant="dot" invisible={!kycPending}>
                    <ListItemText primary={item.label} />
                  </Badge>
                ) : (
                  <ListItemText primary={item.label} />
                )}
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box p={3}>{children}</Box>
    </Box>
  );
}



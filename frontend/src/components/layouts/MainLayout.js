import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  useMediaQuery,
  useTheme,
  Container,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  AccountBalanceWallet as WalletIcon,
  Payments as PaymentsIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  VerifiedUser as VerifiedUserIcon,
  CreditCard as CreditCardIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../common/Logo';
import ThemeToggle from '../common/ThemeToggle';

const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth}px`,
    ...(open && {
      transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginLeft: 0,
    }),
  }),
);

const AppBarStyled = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

const MainLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(!isMobile);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [anchorEl, setAnchorEl] = useState(null);
  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);
  
  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };
  
  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleNotificationMenuOpen = (event) => {
    setNotificationAnchorEl(event.currentTarget);
  };
  
  const handleNotificationMenuClose = () => {
    setNotificationAnchorEl(null);
  };
  
  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
  };
  
  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Generate Money', icon: <PaymentsIcon />, path: '/generate' },
    { text: 'My Wallet', icon: <WalletIcon />, path: '/wallet' },
    { text: 'Transactions', icon: <HistoryIcon />, path: '/transactions' },
    { text: 'Payment Methods', icon: <CreditCardIcon />, path: '/payment-methods' },
    { text: 'KYC Verification', icon: <VerifiedUserIcon />, path: '/kyc' },
    { text: 'Profile', icon: <PersonIcon />, path: '/profile' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBarStyled position="fixed" open={open} color="default" elevation={1}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{ mr: 2, ...(open && { display: 'none' }) }}
          >
            <MenuIcon />
          </IconButton>
          
          {!open && <Logo size="small" />}
          
          <Box sx={{ flexGrow: 1 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ThemeToggle />
            <IconButton
              color="inherit"
              aria-label="notifications"
              onClick={handleNotificationMenuOpen}
            >
              <Badge badgeContent={3} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            
            <IconButton
              edge="end"
              aria-label="account of current user"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Avatar
                alt={user?.name || 'User'}
                src={user?.avatar || ''}
                sx={{ width: 32, height: 32 }}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBarStyled>
      
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant={isMobile ? 'temporary' : 'persistent'}
        anchor="left"
        open={open}
        onClose={handleDrawerClose}
      >
        <DrawerHeader>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', pl: 2 }}>
            <Logo size="small" />
          </Box>
          <IconButton onClick={handleDrawerClose}>
            <ChevronLeftIcon />
          </IconButton>
        </DrawerHeader>
        
        <Divider />
        
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                component={Link}
                to={item.path}
                onClick={isMobile ? handleDrawerClose : undefined}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>
      
      <Main open={open}>
        <DrawerHeader />
        <Container maxWidth="xl">
          <Outlet />
        </Container>
      </Main>
      
      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        id="profile-menu"
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            '& .MuiAvatar-root': {
              width: 32,
              height: 32,
              ml: -0.5,
              mr: 1,
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { handleProfileMenuClose(); navigate('/profile'); }}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          My Profile
        </MenuItem>
        <MenuItem onClick={() => { handleProfileMenuClose(); navigate('/profile/settings'); }}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
      
      {/* Notifications Menu */}
      <Menu
        anchorEl={notificationAnchorEl}
        id="notifications-menu"
        keepMounted
        open={Boolean(notificationAnchorEl)}
        onClose={handleNotificationMenuClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            width: 320,
            maxHeight: 400,
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
          <Typography variant="subtitle1" fontWeight="bold">Notifications</Typography>
        </Box>
        <MenuItem onClick={handleNotificationMenuClose}>
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <Typography variant="body2" fontWeight="bold">Money Generation Complete</Typography>
            <Typography variant="caption" color="text.secondary">
              Your money generation request for $500 has been completed.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              2 hours ago
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleNotificationMenuClose}>
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <Typography variant="body2" fontWeight="bold">KYC Verification Approved</Typography>
            <Typography variant="caption" color="text.secondary">
              Your KYC verification has been approved. You now have full access to all features.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              1 day ago
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleNotificationMenuClose}>
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <Typography variant="body2" fontWeight="bold">New Payment Method Added</Typography>
            <Typography variant="caption" color="text.secondary">
              You have successfully added a new payment method to your account.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              3 days ago
            </Typography>
          </Box>
        </MenuItem>
        <Box sx={{ p: 1, borderTop: '1px solid #eee', textAlign: 'center' }}>
          <Typography 
            variant="body2" 
            color="primary" 
            sx={{ cursor: 'pointer' }}
            onClick={() => { handleNotificationMenuClose(); navigate('/notifications'); }}
          >
            View All Notifications
          </Typography>
        </Box>
      </Menu>
    </Box>
  );
};

export default MainLayout;
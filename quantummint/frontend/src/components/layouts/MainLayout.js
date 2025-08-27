import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  AccountBalanceWallet as WalletIcon,
  Bolt as GenerateIcon,
  Receipt as TransactionsIcon,
  MonetizationOn as CashOutIcon,
  VerifiedUser as KYCIcon,
  Person as ProfileIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
  People as UsersIcon,
  Assessment as StatisticsIcon,
} from '@mui/icons-material';
import { logout } from '../../store/slices/authSlice';
import { getNotifications, markNotificationAsRead } from '../../store/slices/notificationSlice';

const drawerWidth = 240;

const MainLayout = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [anchorElNotifications, setAnchorElNotifications] = useState(null);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { user } = useSelector((state) => state.auth);
  const { notifications, unreadCount } = useSelector((state) => state.notification);
  
  useEffect(() => {
    dispatch(getNotifications({ page: 1, limit: 5 }));
  }, [dispatch]);
  
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };
  
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };
  
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };
  
  const handleOpenNotificationsMenu = (event) => {
    setAnchorElNotifications(event.currentTarget);
    dispatch(getNotifications({ page: 1, limit: 5 }));
  };
  
  const handleCloseNotificationsMenu = () => {
    setAnchorElNotifications(null);
  };
  
  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      dispatch(markNotificationAsRead(notification.notificationId));
    }
    
    // Navigate based on notification type
    if (notification.type === 'generation') {
      navigate(`/generate?id=${notification.metadata.generationId}`);
    } else if (notification.type === 'transaction') {
      navigate(`/transactions?id=${notification.metadata.transactionId}`);
    } else if (notification.type === 'cashout') {
      navigate(`/cash-out?id=${notification.metadata.cashOutId}`);
    } else if (notification.type === 'kyc') {
      navigate('/kyc');
    }
    
    handleCloseNotificationsMenu();
  };
  
  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };
  
  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };
  
  const isActive = (path) => {
    return location.pathname === path;
  };
  
  const userMenuItems = [
    { text: 'Profile', icon: <ProfileIcon />, path: '/profile' },
    { text: 'Logout', icon: <LogoutIcon />, onClick: handleLogout },
  ];
  
  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Wallet', icon: <WalletIcon />, path: '/wallet' },
    { text: 'Generate Money', icon: <GenerateIcon />, path: '/generate' },
    { text: 'Transactions', icon: <TransactionsIcon />, path: '/transactions' },
    { text: 'Cash Out', icon: <CashOutIcon />, path: '/cash-out' },
    { text: 'KYC Verification', icon: <KYCIcon />, path: '/kyc' },
  ];
  
  const adminMenuItems = [
    { text: 'Admin Dashboard', icon: <AdminIcon />, path: '/admin/dashboard' },
    { text: 'Users', icon: <UsersIcon />, path: '/admin/users' },
    { text: 'KYC Verifications', icon: <KYCIcon />, path: '/admin/kyc' },
    { text: 'Transactions', icon: <TransactionsIcon />, path: '/admin/transactions' },
  ];
  
  const drawer = (
    <div>
      <Toolbar sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: 'primary.main' }}>
          QuantumMint
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              selected={isActive(item.path)}
            >
              <ListItemIcon sx={{ color: isActive(item.path) ? 'primary.main' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      {user && user.role === 'admin' && (
        <>
          <Divider />
          <List>
            <ListItem>
              <Typography variant="subtitle2" color="text.secondary">
                Admin
              </Typography>
            </ListItem>
            {adminMenuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  selected={isActive(item.path)}
                >
                  <ListItemIcon sx={{ color: isActive(item.path) ? 'primary.main' : 'inherit' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}
    </div>
  );
  
  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Box sx={{ flexGrow: 1 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title="Notifications">
              <IconButton
                onClick={handleOpenNotificationsMenu}
                size="large"
                aria-label="show notifications"
                color="inherit"
              >
                <Badge badgeContent={unreadCount} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <Menu
              sx={{ mt: '45px' }}
              id="notifications-menu"
              anchorEl={anchorElNotifications}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorElNotifications)}
              onClose={handleCloseNotificationsMenu}
            >
              {notifications.length > 0 ? (
                <>
                  {notifications.map((notification) => (
                    <MenuItem
                      key={notification.notificationId}
                      onClick={() => handleNotificationClick(notification)}
                      sx={{
                        bgcolor: notification.read ? 'inherit' : 'action.hover',
                        borderLeft: notification.read ? 'none' : `4px solid ${theme.palette.primary.main}`,
                      }}
                    >
                      <Box sx={{ maxWidth: 300 }}>
                        <Typography variant="subtitle2">{notification.subject}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {notification.content}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(notification.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem onClick={() => handleNavigation('/notifications')}>
                    <Typography variant="body2" color="primary" align="center" sx={{ width: '100%' }}>
                      View All Notifications
                    </Typography>
                  </MenuItem>
                </>
              ) : (
                <MenuItem>
                  <Typography variant="body2">No notifications</Typography>
                </MenuItem>
              )}
            </Menu>
            
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0, ml: 2 }}>
                <Avatar
                  alt={user ? `${user.firstName} ${user.lastName}` : 'User'}
                  src="/static/images/avatar/2.jpg"
                  sx={{ bgcolor: 'primary.main' }}
                >
                  {user && user.firstName ? user.firstName[0] : 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
            
            <Menu
              sx={{ mt: '45px' }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              {user && (
                <Box sx={{ px: 2, py: 1 }}>
                  <Typography variant="subtitle1">{`${user.firstName} ${user.lastName}`}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.email}
                  </Typography>
                </Box>
              )}
              <Divider />
              {userMenuItems.map((item) => (
                <MenuItem
                  key={item.text}
                  onClick={item.onClick || (() => handleNavigation(item.path))}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <Typography textAlign="center">{item.text}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;
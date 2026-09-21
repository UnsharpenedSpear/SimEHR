import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Stack,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Badge,
  Tooltip,
  Select,
  FormControl,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  Shield,
  Building2,
  KeyRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { useUIStore } from '../../stores/uiStore.js';

export const TopAppBar: React.FC = () => {
  const { user, logout, setActiveFacility } = useAuthStore();
  const { themeMode, toggleThemeMode, toggleNavRail, setGlobalSearchOpen } = useUIStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };

  const fullName = user
    ? `${user.name.given.join(' ')} ${user.name.family}`
    : 'Guest User';
  const roleDisplay = user?.roles?.join(', ') || 'Staff';

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 1, sm: 2 } }}>
        {/* Left: Brand & Nav Toggle */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton edge="start" color="inherit" onClick={toggleNavRail} aria-label="toggle navigation rail">
            <MenuIcon size={22} />
          </IconButton>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 2,
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.contrastText',
                fontWeight: 800,
                fontSize: '1rem',
              }}
            >
              +
            </Box>
            <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: -0.5, display: { xs: 'none', sm: 'block' } }}>
              Simulated<span style={{ color: '#006874' }}>EHR</span>
            </Typography>
          </Stack>
        </Stack>

        {/* Center: Global Search Bar trigger */}
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<Search size={18} />}
          onClick={() => setGlobalSearchOpen(true)}
          sx={{
            borderRadius: 6,
            px: 2,
            py: 0.75,
            width: { xs: 160, sm: 300, md: 420 },
            justifyContent: 'space-between',
            bgcolor: 'background.default',
            borderColor: 'divider',
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'action.hover',
              borderColor: 'primary.main',
            },
          }}
        >
          <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Search patients, MRN, orders...
          </Typography>
          <Typography variant="body2" sx={{ display: { xs: 'inline', sm: 'none' } }}>
            Search...
          </Typography>
          <Typography variant="caption" sx={{ bgcolor: 'action.selected', px: 1, py: 0.25, borderRadius: 1 }}>
            ⌘K
          </Typography>
        </Button>

        {/* Right: Actions, Facility & User Menu */}
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Facility Switcher */}
          {user?.facilityIds && user.facilityIds.length > 0 && (
            <FormControl size="small" sx={{ display: { xs: 'none', md: 'block' }, minWidth: 140 }}>
              <Select
                value={user.activeFacilityId || user.facilityIds[0]}
                onChange={(e) => setActiveFacility(e.target.value)}
                sx={{ borderRadius: 3, height: 36, fontSize: '0.8125rem' }}
              >
                {user.facilityIds.map((facId) => (
                  <MenuItem key={facId} value={facId}>
                    Facility {facId.slice(-4).toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Theme Toggle */}
          <Tooltip title={`Switch to ${themeMode === 'light' ? 'Dark' : 'Light'} Mode`}>
            <IconButton onClick={toggleThemeMode} color="inherit">
              {themeMode === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="Notifications & Critical Alerts">
            <IconButton color="inherit" onClick={() => navigate('/notifications')}>
              <Badge badgeContent={2} color="error">
                <Bell size={20} />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* User Avatar & Menu */}
          <IconButton onClick={handleMenuOpen} sx={{ p: 0.5 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: '0.875rem', fontWeight: 600 }}>
              {user?.name?.given?.[0]?.[0] || 'U'}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            PaperProps={{ sx: { width: 240, borderRadius: 3, mt: 1.5, p: 0.5 } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {fullName}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {user?.email}
              </Typography>
              <Typography variant="caption" color="primary.main" fontWeight={600} display="block" sx={{ mt: 0.5 }}>
                {roleDisplay}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>
              <ListItemIcon><UserIcon size={18} /></ListItemIcon>
              <ListItemText primary="Profile & Licenses" />
            </MenuItem>
            <MenuItem onClick={() => { handleMenuClose(); navigate('/mfa-setup'); }}>
              <ListItemIcon><KeyRound size={18} /></ListItemIcon>
              <ListItemText primary="Two-Factor Auth (MFA)" />
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
              <ListItemIcon sx={{ color: 'error.main' }}><LogOut size={18} /></ListItemIcon>
              <ListItemText primary="Sign Out" />
            </MenuItem>
          </Menu>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

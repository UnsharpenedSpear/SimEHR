import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Send,
  FlaskConical,
  Pill,
  ScanLine,
  Calendar,
  CreditCard,
  BarChart3,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';
import { useUIStore } from '../../stores/uiStore.js';
import { PERMISSIONS } from '@ehr/shared';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
  roles?: string[];
}

export const NavigationRail: React.FC = () => {
  const { user, hasPermission, hasRole } = useAuthStore();
  const { navRailExpanded } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/',
      icon: <LayoutDashboard size={20} />,
    },
    {
      label: 'Patients',
      path: '/patients',
      icon: <Users size={20} />,
      permission: PERMISSIONS.PATIENT_READ,
    },
    {
      label: 'Register Patient',
      path: '/patients/new',
      icon: <UserPlus size={20} />,
      permission: PERMISSIONS.PATIENT_CREATE,
    },
    {
      label: 'Dispatch Board',
      path: '/dispatch',
      icon: <Send size={20} />,
      permission: PERMISSIONS.DISPATCH_READ,
    },
    {
      label: 'Lab Worklist',
      path: '/lab',
      icon: <FlaskConical size={20} />,
      permission: PERMISSIONS.LAB_RESULT_ENTRY,
    },
    {
      label: 'Pharmacy',
      path: '/pharmacy',
      icon: <Pill size={20} />,
      permission: PERMISSIONS.PRESCRIPTION_READ,
    },
    {
      label: 'Radiology',
      path: '/radiology',
      icon: <ScanLine size={20} />,
      permission: PERMISSIONS.IMAGING_REPORT_WRITE,
    },
    {
      label: 'Appointments',
      path: '/appointments',
      icon: <Calendar size={20} />,
      permission: PERMISSIONS.APPOINTMENT_READ,
    },
    {
      label: 'Billing & Invoices',
      path: '/billing',
      icon: <CreditCard size={20} />,
      permission: PERMISSIONS.BILLING_READ,
    },
    {
      label: 'Reports & KPIs',
      path: '/reports',
      icon: <BarChart3 size={20} />,
      permission: PERMISSIONS.REPORT_VIEW,
    },
    {
      label: 'Audit & Compliance',
      path: '/audit',
      icon: <ShieldCheck size={20} />,
      permission: PERMISSIONS.AUDIT_READ,
    },
    {
      label: 'Administration',
      path: '/admin',
      icon: <Settings size={20} />,
      permission: PERMISSIONS.USER_CREATE,
    },
  ];

  const visibleItems = navItems.filter((item) => {
    if (!item.permission && !item.roles) return true;
    if (item.permission && hasPermission(item.permission)) return true;
    if (item.roles && item.roles.some((r) => hasRole(r))) return true;
    return false;
  });

  const drawerWidth = navRailExpanded ? 240 : 72;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowX: 'hidden',
          pt: 1,
        },
      }}
    >
      <List sx={{ px: 1 }}>
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          const button = (
            <ListItemButton
              key={item.path}
              onClick={() => navigate(item.path)}
              sx={{
                minHeight: 44,
                borderRadius: 3,
                mb: 0.5,
                justifyContent: navRailExpanded ? 'initial' : 'center',
                px: 2,
                bgcolor: isActive ? 'primary.main' : 'transparent',
                color: isActive ? 'primary.contrastText' : 'text.primary',
                '&:hover': {
                  bgcolor: isActive ? 'primary.dark' : 'action.hover',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: navRailExpanded ? 2 : 'auto',
                  justifyContent: 'center',
                  color: isActive ? 'primary.contrastText' : 'inherit',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {navRailExpanded && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 500,
                  }}
                />
              )}
            </ListItemButton>
          );

          return navRailExpanded ? (
            <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
              {button}
            </ListItem>
          ) : (
            <Tooltip key={item.path} title={item.label} placement="right">
              <ListItem disablePadding sx={{ display: 'block' }}>
                {button}
              </ListItem>
            </Tooltip>
          );
        })}
      </List>
    </Drawer>
  );
};

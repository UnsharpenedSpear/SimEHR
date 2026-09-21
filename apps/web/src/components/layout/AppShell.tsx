import React from 'react';
import { Box, Container, CssBaseline } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { TopAppBar } from './TopAppBar.js';
import { NavigationRail } from './NavigationRail.js';
import { GlobalSearchDialog } from '../common/GlobalSearchDialog.js';
import { SessionTimeoutModal } from '../common/SessionTimeoutModal.js';

export const AppShell: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />
      <NavigationRail />
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopAppBar />
        <Container maxWidth="xl" sx={{ flexGrow: 1, py: 3, px: { xs: 2, sm: 3 } }}>
          <Outlet />
        </Container>
      </Box>
      <GlobalSearchDialog />
      <SessionTimeoutModal />
    </Box>
  );
};

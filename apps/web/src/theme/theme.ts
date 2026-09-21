import { createTheme, Theme, alpha } from '@mui/material/styles';
import { m3Colors } from './m3Tokens.js';

export function buildM3Theme(mode: 'light' | 'dark'): Theme {
  const colors = m3Colors[mode];

  return createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary,
        contrastText: colors.onPrimary,
      },
      secondary: {
        main: colors.secondary,
        contrastText: colors.onSecondary,
      },
      error: {
        main: colors.error,
        contrastText: colors.onError,
      },
      background: {
        default: colors.background,
        paper: colors.surfaceContainerLowest,
      },
      text: {
        primary: colors.onBackground,
        secondary: colors.onSurfaceVariant,
      },
      divider: colors.outlineVariant,
    },
    typography: {
      fontFamily: '"Roboto Flex", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 600,
        lineHeight: 1.25,
        letterSpacing: '-0.01em',
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.35,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      body1: {
        fontSize: '0.9375rem',
        lineHeight: 1.5,
      },
      body2: {
        fontSize: '0.8125rem',
        lineHeight: 1.45,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.875rem',
      },
    },
    shape: {
      borderRadius: 16, // M3 medium shape
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.background,
            color: colors.onBackground,
            scrollbarColor: `${colors.outlineVariant} transparent`,
            '&::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: colors.outlineVariant,
              borderRadius: 8,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 20, // M3 full pill button
            padding: '8px 20px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            },
          },
          containedPrimary: {
            backgroundColor: colors.primary,
            color: colors.onPrimary,
            '&:hover': {
              backgroundColor: alpha(colors.primary, 0.9),
            },
          },
          outlined: {
            borderColor: colors.outline,
            '&:hover': {
              borderColor: colors.primary,
              backgroundColor: alpha(colors.primary, 0.05),
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            backgroundColor: colors.surfaceContainerLowest,
            border: `1px solid ${colors.outlineVariant}`,
            boxShadow: mode === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          elevation1: {
            boxShadow: mode === 'light' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500,
            fontSize: '0.75rem',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
          size: 'small',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            '& fieldset': {
              borderColor: colors.outlineVariant,
            },
            '&:hover fieldset': {
              borderColor: colors.outline,
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.primary,
              borderWidth: 2,
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: colors.surfaceContainerLowest,
            color: colors.onSurface,
            boxShadow: 'none',
            borderBottom: `1px solid ${colors.outlineVariant}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: colors.surfaceContainerLow,
            borderRight: `1px solid ${colors.outlineVariant}`,
          },
        },
      },
    },
  });
}

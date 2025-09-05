import React, { createContext, useContext, useState, useMemo } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a CustomThemeProvider');
  }
  return context;
};

export const CustomThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', JSON.stringify(newMode));
  };

  const theme = useMemo(() => {
    const baseTheme = {
      typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        h1: { fontSize: '2.5rem', fontWeight: 600 },
        h2: { fontSize: '2rem', fontWeight: 600 },
        h3: { fontSize: '1.75rem', fontWeight: 600 },
        h4: { fontSize: '1.5rem', fontWeight: 600 },
        h5: { fontSize: '1.25rem', fontWeight: 600 },
        h6: { fontSize: '1rem', fontWeight: 600 },
      },
      shape: {
        borderRadius: 8,
      },
      spacing: 8,
    };

    if (darkMode) {
      return createTheme({
        ...baseTheme,
        palette: {
          mode: 'dark',
          primary: {
            main: '#90caf9',
            light: '#e3f2fd',
            dark: '#1976d2',
            contrastText: '#000',
          },
          secondary: {
            main: '#f48fb1',
            light: '#fce4ec',
            dark: '#c2185b',
            contrastText: '#000',
          },
          background: {
            default: '#121212',
            paper: '#1e1e1e',
          },
          text: {
            primary: '#ffffff',
            secondary: 'rgba(255, 255, 255, 0.7)',
          },
          divider: 'rgba(255, 255, 255, 0.12)',
          action: {
            hover: 'rgba(255, 255, 255, 0.08)',
            selected: 'rgba(255, 255, 255, 0.12)',
          },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
        },
      });
    }

    return createTheme({
      ...baseTheme,
      palette: {
        mode: 'light',
        primary: {
          main: '#1976d2',
          light: '#42a5f5',
          dark: '#1565c0',
          contrastText: '#fff',
        },
        secondary: {
          main: '#dc004e',
          light: '#ff5983',
          dark: '#9a0036',
          contrastText: '#fff',
        },
        background: {
          default: '#f5f5f5',
          paper: '#ffffff',
        },
        text: {
          primary: 'rgba(0, 0, 0, 0.87)',
          secondary: 'rgba(0, 0, 0, 0.6)',
        },
        divider: 'rgba(0, 0, 0, 0.12)',
        action: {
          hover: 'rgba(0, 0, 0, 0.04)',
          selected: 'rgba(0, 0, 0, 0.08)',
        },
      },
    });
  }, [darkMode]);

  const value = {
    darkMode,
    toggleDarkMode,
    theme,
  };

  return (
    <ThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};






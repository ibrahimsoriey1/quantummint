import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { LightMode, DarkMode } from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeToggle = () => {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <Tooltip title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton onClick={toggleDarkMode} color="inherit">
        {darkMode ? <LightMode /> : <DarkMode />}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;






import React from 'react';
import { Box, Typography, Breadcrumbs, Link, useTheme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

/**
 * Page title component with breadcrumbs
 * @param {Object} props - Component props
 * @param {string} props.title - Page title
 * @param {string} props.subtitle - Page subtitle
 * @param {Array} props.breadcrumbs - Breadcrumb items
 * @param {JSX.Element} props.action - Action button or component
 * @param {Object} props.sx - Additional styles
 * @returns {JSX.Element} Page title component
 */
const PageTitle = ({
  title,
  subtitle,
  breadcrumbs = [],
  action,
  sx = {},
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 4, ...sx }}>
      {breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          aria-label="breadcrumb"
          sx={{ mb: 1 }}
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            
            return isLast ? (
              <Typography key={index} color="text.primary" variant="body2">
                {crumb.label}
              </Typography>
            ) : (
              <Link
                key={index}
                component={RouterLink}
                to={crumb.href}
                underline="hover"
                color="inherit"
                variant="body2"
              >
                {crumb.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          
          {subtitle && (
            <Typography
              variant="subtitle1"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        
        {action && <Box>{action}</Box>}
      </Box>
      
      <Box
        sx={{
          mt: 2,
          mb: 3,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      />
    </Box>
  );
};

export default PageTitle;
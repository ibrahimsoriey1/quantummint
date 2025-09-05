import React from 'react';
import { Box, Skeleton, Paper } from '@mui/material';

export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <Paper sx={{ p: 2 }}>
    <Box sx={{ mb: 2 }}>
      <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
      <Skeleton variant="rectangular" height={40} />
    </Box>
    {Array.from({ length: rows }).map((_, index) => (
      <Box key={index} sx={{ display: 'flex', gap: 2, mb: 1 }}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} variant="text" width="100%" height={40} />
        ))}
      </Box>
    ))}
  </Paper>
);

export const CardSkeleton = ({ count = 3 }) => (
  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
    {Array.from({ length: count }).map((_, index) => (
      <Paper key={index} sx={{ p: 3, minWidth: 200, flex: 1 }}>
        <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
        <Skeleton variant="text" width="40%" height={32} />
        <Skeleton variant="rectangular" height={60} sx={{ mt: 2 }} />
      </Paper>
    ))}
  </Box>
);

export const FormSkeleton = () => (
  <Paper sx={{ p: 3 }}>
    <Skeleton variant="text" width="30%" height={32} sx={{ mb: 3 }} />
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Skeleton variant="rectangular" height={56} />
      <Skeleton variant="rectangular" height={56} />
      <Skeleton variant="rectangular" height={56} />
      <Skeleton variant="rectangular" height={120} />
      <Skeleton variant="rectangular" height={40} width="30%" />
    </Box>
  </Paper>
);

export const DashboardSkeleton = () => (
  <Box>
    <Skeleton variant="text" width="40%" height={48} sx={{ mb: 3 }} />
    <CardSkeleton count={4} />
    <Box sx={{ mt: 4 }}>
      <Skeleton variant="text" width="30%" height={32} sx={{ mb: 2 }} />
      <TableSkeleton rows={8} columns={5} />
    </Box>
  </Box>
);

export const ProfileSkeleton = () => (
  <Paper sx={{ p: 3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
      <Skeleton variant="circular" width={80} height={80} sx={{ mr: 2 }} />
      <Box>
        <Skeleton variant="text" width={200} height={32} />
        <Skeleton variant="text" width={150} height={24} />
      </Box>
    </Box>
    <FormSkeleton />
  </Paper>
);

export const ListSkeleton = ({ count = 5 }) => (
  <Box>
    {Array.from({ length: count }).map((_, index) => (
      <Paper key={index} sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} />
          </Box>
          <Skeleton variant="rectangular" width={80} height={32} />
        </Box>
      </Paper>
    ))}
  </Box>
);

export const ChartSkeleton = () => (
  <Paper sx={{ p: 3 }}>
    <Skeleton variant="text" width="30%" height={32} sx={{ mb: 2 }} />
    <Skeleton variant="rectangular" height={300} />
  </Paper>
);

export const NotificationSkeleton = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
    {Array.from({ length: 3 }).map((_, index) => (
      <Paper key={index} sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={24} height={24} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="70%" height={20} />
            <Skeleton variant="text" width="50%" height={16} />
          </Box>
          <Skeleton variant="text" width={60} height={16} />
        </Box>
      </Paper>
    ))}
  </Box>
);

export default {
  TableSkeleton,
  CardSkeleton,
  FormSkeleton,
  DashboardSkeleton,
  ProfileSkeleton,
  ListSkeleton,
  ChartSkeleton,
  NotificationSkeleton,
};






import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import api from '../../services/apiClient';
import { handleApiError } from '../../utils/errorHandler';
import DataTable from '../../components/common/DataTable';

const UsersAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/users');
        if (!isMounted) return;
        setUsers(Array.isArray(data?.users) ? data.users : []);
      } catch (e) {
        const err = handleApiError(e);
        setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  const columns = [
    { field: 'firstName', headerName: 'First Name' },
    { field: 'lastName', headerName: 'Last Name' },
    { field: 'email', headerName: 'Email' },
    { field: 'username', headerName: 'Username' },
    { field: 'role', headerName: 'Role' },
    { field: 'status', headerName: 'Status', type: 'status' },
    { field: 'createdAt', headerName: 'Created', type: 'date' },
    { field: 'lastLogin', headerName: 'Last Login', type: 'datetime' }
  ];

  const actions = [
    {
      label: 'View Details',
      icon: '👁️',
      onClick: (user) => console.log('View user:', user)
    },
    {
      label: 'Edit User',
      icon: '✏️',
      onClick: (user) => console.log('Edit user:', user)
    },
    {
      label: 'Suspend User',
      icon: '⏸️',
      onClick: (user) => console.log('Suspend user:', user)
    }
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Admin - Users</Typography>
      <DataTable
        data={users}
        columns={columns}
        loading={loading}
        error={error}
        title="Users"
        searchable={true}
        exportable={true}
        pagination={true}
        pageSize={10}
        actions={actions}
        onRowClick={(user) => console.log('Row clicked:', user)}
      />
    </Box>
  );
};

export default UsersAdmin;


import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import api from '../../services/apiClient';
import { handleApiError } from '../../utils/errorHandler';
import DataTable from '../../components/common/DataTable';

const ProvidersAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/providers/active');
        if (!isMounted) return;
        setProviders(Array.isArray(data?.providers) ? data.providers : []);
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
    { field: 'name', headerName: 'Provider Name' },
    { field: 'code', headerName: 'Code' },
    { field: 'active', headerName: 'Status', type: 'status' },
    { field: 'feeStructure', headerName: 'Fee Structure' }
  ];

  const actions = [
    {
      label: 'View Details',
      icon: '👁️',
      onClick: (provider) => console.log('View provider:', provider)
    },
    {
      label: 'Edit Provider',
      icon: '✏️',
      onClick: (provider) => console.log('Edit provider:', provider)
    },
    {
      label: 'Toggle Status',
      icon: '🔄',
      onClick: (provider) => console.log('Toggle provider status:', provider)
    }
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Admin - Payment Providers</Typography>
      <DataTable
        data={providers}
        columns={columns}
        loading={loading}
        error={error}
        title="Payment Providers"
        searchable={true}
        exportable={true}
        pagination={true}
        pageSize={10}
        actions={actions}
        onRowClick={(provider) => console.log('Row clicked:', provider)}
      />
    </Box>
  );
};

export default ProvidersAdmin;


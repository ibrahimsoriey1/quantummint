import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import api from '../../services/apiClient';
import { handleApiError } from '../../utils/errorHandler';
import DataTable from '../../components/common/DataTable';

const TransactionsAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/transactions');
        if (!isMounted) return;
        setRows(Array.isArray(data?.transactions) ? data.transactions : []);
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
    { field: 'reference', headerName: 'Reference' },
    { field: 'type', headerName: 'Type' },
    { field: 'amount', headerName: 'Amount' },
    { field: 'status', headerName: 'Status', type: 'status' },
    { field: 'createdAt', headerName: 'Created', type: 'datetime' }
  ];

  const actions = [
    {
      label: 'View Details',
      icon: '👁️',
      onClick: (transaction) => console.log('View transaction:', transaction)
    },
    {
      label: 'Refund',
      icon: '💰',
      onClick: (transaction) => console.log('Refund transaction:', transaction)
    },
    {
      label: 'Cancel',
      icon: '❌',
      onClick: (transaction) => console.log('Cancel transaction:', transaction)
    }
  ];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Admin - Transactions</Typography>
      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        error={error}
        title="Transactions"
        searchable={true}
        exportable={true}
        pagination={true}
        pageSize={15}
        actions={actions}
        onRowClick={(transaction) => console.log('Row clicked:', transaction)}
      />
    </Box>
  );
};

export default TransactionsAdmin;


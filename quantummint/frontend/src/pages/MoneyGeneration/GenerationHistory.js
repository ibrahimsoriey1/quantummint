import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Grid,
  Avatar,
  LinearProgress
} from '@mui/material';
import {
  Search,
  MonetizationOn,
  TrendingUp,
  Schedule,
  CheckCircle,
  Error,
  Pending
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useWallet } from '../../contexts/WalletContext';
import { useAuth } from '../../contexts/AuthContext';

const GenerationHistory = () => {
  useAuth(); // Hook required for context
  const { fetchGenerationHistory } = useWallet();
  const [generations, setGenerations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [stats, setStats] = useState({
    totalGenerated: 0,
    totalTransactions: 0,
    successRate: 0,
    averageAmount: 0
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchData = useCallback(async() => {
    try {
      setLoading(true);
      const result = await fetchGenerationHistory(page + 1, rowsPerPage);
      if (result) {
        setGenerations(result.generations || []);
        setStats({
          totalGenerated: result.stats?.totalGenerated || 0,
          totalTransactions: result.stats?.totalTransactions || 0,
          successRate: result.stats?.successRate || 0,
          averageAmount: result.stats?.averageAmount || 0
        });
      }
    } catch (error) {
      // Error fetching generation history
    } finally {
      setLoading(false);
    }
  }, [fetchGenerationHistory, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusIcon = (status) => {
    switch (status) {
    case 'completed':
      return <CheckCircle color="success" />;
    case 'failed':
      return <Error color="error" />;
    case 'processing':
      return <Pending color="warning" />;
    default:
      return <Schedule color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'processing':
      return 'warning';
    default:
      return 'default';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const filteredGenerations = generations.filter((generation) => {
    const matchesSearch = generation.description
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase()) ||
      generation.transactionId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDateRange = (!startDate || new Date(generation.createdAt) >= startDate) &&
      (!endDate || new Date(generation.createdAt) <= endDate);

    return matchesSearch && matchesDateRange;
  });

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Generation History
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Track your quantum money generation transactions and performance.
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Generated
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(stats.totalGenerated)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <MonetizationOn />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Transactions
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {stats.totalTransactions}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <TrendingUp />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Success Rate
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {stats.successRate}%
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <CheckCircle />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Average Amount
                  </Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(stats.averageAmount)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <MonetizationOn />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent>
          {loading && <LinearProgress sx={{ mb: 2 }} />}

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Transaction ID</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Complexity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Algorithm</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Processing Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredGenerations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="textSecondary" py={4}>
                        No generation history found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGenerations.map((generation) => (
                    <TableRow key={generation._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {generation.transactionId?.slice(0, 8)}...
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold" color="primary">
                          {formatCurrency(generation.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`Level ${generation.complexity}`}
                          size="small"
                          color={generation.complexity >= 7 ? 'error' : generation.complexity >= 4 ? 'warning' : 'success'}
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <IconButton size="small" sx={{ mr: 1 }}>
                            {getStatusIcon(generation.status)}
                          </IconButton>
                          <Chip
                            label={generation.status}
                            size="small"
                            color={getStatusColor(generation.status)}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {generation.algorithm || 'quantum_v2'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(generation.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {generation.processingTime || 'N/A'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={generations.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default GenerationHistory;

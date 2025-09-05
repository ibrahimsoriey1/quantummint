import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Button,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { exportToCSV, exportToExcel, exportToJSON, exportToPDF, formatDataForExport, getExportOptions } from '../../utils/exportUtils';
import { useNotifications } from '../../contexts/NotificationContext';

const DataTable = ({
  data = [],
  columns = [],
  loading = false,
  error = null,
  title = 'Data Table',
  searchable = true,
  exportable = true,
  pagination = true,
  pageSize = 10,
  onRowClick = null,
  actions = null,
  filters = null
}) => {
  const { showSuccess, showError } = useNotifications();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);

  // Filter and search data
  const filteredData = useMemo(() => {
    let filtered = data;

    // Apply search
    if (searchTerm && searchable) {
      filtered = filtered.filter(row =>
        columns.some(column => {
          const value = row[column.field];
          return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Apply filters if provided
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          filtered = filtered.filter(row => row[key] === filters[key]);
        }
      });
    }

    return filtered;
  }, [data, searchTerm, columns, searchable, filters]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return filteredData;
    
    const startIndex = page * rowsPerPage;
    return filteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredData, page, rowsPerPage, pagination]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleExport = async (format) => {
    try {
      const exportData = formatDataForExport(filteredData);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${title.toLowerCase().replace(/\s+/g, '_')}_${timestamp}`;

      switch (format) {
        case 'csv':
          exportToCSV(exportData, filename);
          break;
        case 'excel':
          exportToExcel(exportData, filename);
          break;
        case 'json':
          exportToJSON(exportData, filename);
          break;
        case 'pdf':
          await exportToPDF(exportData, filename, title);
          break;
        default:
          throw new Error('Unsupported export format');
      }

      showSuccess(`Data exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      showError(`Export failed: ${error.message}`);
    } finally {
      setExportMenuAnchor(null);
    }
  };

  const getCellValue = (row, column) => {
    const value = row[column.field];
    
    if (column.render) {
      return column.render(value, row);
    }
    
    if (column.type === 'date' && value) {
      return new Date(value).toLocaleDateString();
    }
    
    if (column.type === 'datetime' && value) {
      return new Date(value).toLocaleString();
    }
    
    if (column.type === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (column.type === 'status') {
      const statusColors = {
        active: 'success',
        inactive: 'default',
        pending: 'warning',
        completed: 'success',
        failed: 'error',
        cancelled: 'default'
      };
      return (
        <Chip
          label={value}
          color={statusColors[value?.toLowerCase()] || 'default'}
          size="small"
        />
      );
    }
    
    return value || '-';
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="center" minHeight="200px">
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

  return (
    <Paper>
      {/* Header with search and export */}
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {searchable && (
            <TextField
              size="small"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 200 }}
            />
          )}
          {filters && (
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <FilterIcon />
            </IconButton>
          )}
        </Box>

        {exportable && (
          <Box>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportMenuAnchor}
              open={Boolean(exportMenuAnchor)}
              onClose={() => setExportMenuAnchor(null)}
            >
              {getExportOptions(title.toLowerCase()).map((option) => (
                <MenuItem key={option.value} onClick={() => handleExport(option.value)}>
                  {option.icon} {option.label}
                </MenuItem>
              ))}
            </Menu>
          </Box>
        )}
      </Box>

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.field} align={column.align || 'left'}>
                  {column.headerName}
                </TableCell>
              ))}
              {actions && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row, index) => (
              <TableRow
                key={row.id || row._id || index}
                hover
                onClick={() => onRowClick && onRowClick(row)}
                sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((column) => (
                  <TableCell key={column.field} align={column.align || 'left'}>
                    {getCellValue(row, column)}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnchorEl(e.currentTarget);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}

      {/* Actions Menu */}
      {actions && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          {actions.map((action, index) => (
            <MenuItem key={index} onClick={() => {
              action.onClick();
              setAnchorEl(null);
            }}>
              {action.icon} {action.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Paper>
  );
};

export default DataTable;






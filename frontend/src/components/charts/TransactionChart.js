import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Box, Typography, Paper, Grid, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const TransactionChart = ({ data = [], type = 'line', title = 'Transaction Analytics' }) => {
  const [chartType, setChartType] = React.useState(type);
  const [timeRange, setTimeRange] = React.useState('7d');

  // Sample data for demonstration
  const sampleData = [
    { name: 'Jan', transactions: 4000, volume: 2400, users: 240 },
    { name: 'Feb', transactions: 3000, volume: 1398, users: 221 },
    { name: 'Mar', transactions: 2000, volume: 9800, users: 229 },
    { name: 'Apr', transactions: 2780, volume: 3908, users: 200 },
    { name: 'May', transactions: 1890, volume: 4800, users: 218 },
    { name: 'Jun', transactions: 2390, volume: 3800, users: 250 },
    { name: 'Jul', transactions: 3490, volume: 4300, users: 210 },
  ];

  const pieData = [
    { name: 'Completed', value: 400, color: '#4caf50' },
    { name: 'Pending', value: 300, color: '#ff9800' },
    { name: 'Failed', value: 200, color: '#f44336' },
    { name: 'Cancelled', value: 100, color: '#9e9e9e' },
  ];

  const renderChart = () => {
    const chartData = data.length > 0 ? data : sampleData;

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="transactions" stroke="#1976d2" strokeWidth={2} />
              <Line type="monotone" dataKey="volume" stroke="#dc004e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="transactions" fill="#1976d2" />
              <Bar dataKey="volume" fill="#dc004e" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">{title}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Chart Type</InputLabel>
            <Select
              value={chartType}
              label="Chart Type"
              onChange={(e) => setChartType(e.target.value)}
            >
              <MenuItem value="line">Line Chart</MenuItem>
              <MenuItem value="bar">Bar Chart</MenuItem>
              <MenuItem value="pie">Pie Chart</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>
      {renderChart()}
    </Paper>
  );
};

export default TransactionChart;






import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Slider,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  MonetizationOn,
  Security,
  Speed,
  TrendingUp,
  Info
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useWallet } from '../../contexts/WalletContext';
import { useAuth } from '../../contexts/AuthContext';

const validationSchema = Yup.object({
  amount: Yup.number()
    .min(1, 'Minimum generation amount is $1')
    .max(10000, 'Maximum generation amount is $10,000 per transaction')
    .required('Amount is required'),
  complexity: Yup.number()
    .min(1)
    .max(10)
    .required('Complexity level is required')
});

const MoneyGeneration = () => {
  useAuth(); // Hook required for context
  const { generateMoney, balance, fetchBalance } = useWallet();
  const [loading, setLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [generationData, setGenerationData] = useState(null);
  const [dailyLimit, setDailyLimit] = useState({ used: 2500, total: 5000 });

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const formik = useFormik({
    initialValues: {
      amount: '',
      complexity: 5,
      description: ''
    },
    validationSchema,
    onSubmit: (values) => {
      setGenerationData(values);
      setShowConfirmDialog(true);
    }
  });

  const handleConfirmGeneration = async() => {
    setShowConfirmDialog(false);
    setLoading(true);
    setGenerationProgress(0);

    // Simulate quantum generation process
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const result = await generateMoney({
        amount: parseFloat(generationData.amount),
        complexity: generationData.complexity,
        description: generationData.description || `Quantum generation of $${generationData.amount}`,
        algorithm: 'quantum_entanglement_v2',
        securityLevel: generationData.complexity >= 7 ? 'high' : 'medium'
      });

      if (result.success) {
        formik.resetForm();
        setDailyLimit(prev => ({
          ...prev,
          used: prev.used + parseFloat(generationData.amount)
        }));
      }
    } catch (error) {
      // Generation failed
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
      setGenerationProgress(0);
    }
  };

  const getComplexityLabel = (value) => {
    if (value <= 3) {
      return 'Basic';
    }
    if (value <= 6) {
      return 'Standard';
    }
    if (value <= 8) {
      return 'Advanced';
    }
    return 'Quantum';
  };

  const getComplexityColor = (value) => {
    if (value <= 3) {
      return 'success';
    }
    if (value <= 6) {
      return 'info';
    }
    if (value <= 8) {
      return 'warning';
    }
    return 'error';
  };

  const estimatedTime = Math.ceil(formik.values.complexity * 2 + (parseFloat(formik.values.amount) || 0) / 100);
  const energyRequired = Math.ceil(formik.values.complexity * 0.5 + (parseFloat(formik.values.amount) || 0) / 1000);
  const securityLevel = formik.values.complexity >= 7 ? 'Military Grade' : formik.values.complexity >= 4 ? 'Enterprise' : 'Standard';

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Quantum Money Generation
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Generate digital currency using advanced quantum algorithms and blockchain technology.
      </Typography>

      <Grid container spacing={3}>
        {/* Generation Form */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Generation Parameters
              </Typography>

              {loading && (
                <Box mb={3}>
                  <Typography variant="body2" gutterBottom>
                    Quantum Generation in Progress...
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={generationProgress}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="text.secondary" mt={1} display="block">
                    {Math.round(generationProgress)}% Complete
                  </Typography>
                </Box>
              )}

              <form onSubmit={formik.handleSubmit}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      id="amount"
                      name="amount"
                      label="Amount ($)"
                      type="number"
                      value={formik.values.amount}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={formik.touched.amount && Boolean(formik.errors.amount)}
                      helperText={formik.touched.amount && formik.errors.amount}
                      disabled={loading}
                      InputProps={{
                        startAdornment: <MonetizationOn sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Typography gutterBottom>
                      Complexity Level: {formik.values.complexity}
                      <Chip
                        label={getComplexityLabel(formik.values.complexity)}
                        color={getComplexityColor(formik.values.complexity)}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                    <Slider
                      value={formik.values.complexity}
                      onChange={(_, value) => formik.setFieldValue('complexity', value)}
                      min={1}
                      max={10}
                      marks
                      step={1}
                      disabled={loading}
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Higher complexity provides better security but requires more processing time
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      id="description"
                      name="description"
                      label="Description (Optional)"
                      multiline
                      rows={3}
                      value={formik.values.description}
                      onChange={formik.handleChange}
                      disabled={loading}
                      placeholder="Enter a description for this generation..."
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={loading || !formik.values.amount}
                      startIcon={<MonetizationOn />}
                      sx={{ mr: 2 }}
                    >
                      {loading ? <CircularProgress size={24} /> : 'Generate Money'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => formik.resetForm()}
                      disabled={loading}
                    >
                      Reset
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Stats and Info */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={2}>
            {/* Current Balance */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Current Balance
                  </Typography>
                  <Typography variant="h4" color="primary" fontWeight="bold">
                    ${balance ? (balance.available + balance.locked).toLocaleString() : '0.00'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Available: ${balance ? balance.available.toLocaleString() : '0.00'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Daily Limit */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Daily Generation Limit
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(dailyLimit.used / dailyLimit.total) * 100}
                    sx={{ height: 8, borderRadius: 4, mb: 1 }}
                  />
                  <Typography variant="body2">
                    ${dailyLimit.used.toLocaleString()} / ${dailyLimit.total.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Remaining: ${(dailyLimit.total - dailyLimit.used).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Generation Estimates */}
            {formik.values.amount && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Generation Estimates
                    </Typography>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Speed sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        Time: ~{estimatedTime} minutes
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" mb={1}>
                      <TrendingUp sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        Energy: {energyRequired} units
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center">
                      <Security sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        Security: {securityLevel}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Info Card */}
            <Grid item xs={12}>
              <Alert severity="info" icon={<Info />}>
                <Typography variant="body2" fontWeight="medium">
                  Quantum Generation Process
                </Typography>
                <Typography variant="caption">
                  Our quantum algorithms use advanced cryptographic principles to generate
                  secure digital currency backed by mathematical proof of work.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <DialogTitle>Confirm Money Generation</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            You are about to generate <strong>${generationData?.amount}</strong> using
            complexity level <strong>{generationData?.complexity}</strong>.
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Estimated processing time: ~{estimatedTime} minutes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This operation cannot be cancelled once started.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmGeneration} variant="contained">
            Confirm Generation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MoneyGeneration;

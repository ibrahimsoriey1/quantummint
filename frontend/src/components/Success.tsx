import { Box, Button, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';

export default function Success({ title = 'Success', to = '/' }: { title?: string; to?: string }) {
  const navigate = useNavigate();
  return (
    <Box textAlign="center" py={6}>
      <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
      <Typography variant="h5" mt={2}>{title}</Typography>
      <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate(to)}>Continue</Button>
    </Box>
  );
}



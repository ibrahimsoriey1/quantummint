import { useState } from 'react';
import { Box, Button, Container, Paper, TextField, Typography } from '@mui/material';
import api from '../api/client';
import { notify } from '../api/notify';

export default function KYCUpload() {
  const [type, setType] = useState('passport');
  const [file, setFile] = useState<File | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return notify('Select a file', 'warning');
    const form = new FormData();
    form.append('type', type);
    form.append('file', file);
    await api.post('/api/v1/documents', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    notify('Document uploaded', 'success');
    setFile(null);
  };

  return (
    <Container maxWidth="sm">
      <Box mt={4} component={Paper} p={3}>
        <Typography variant="h6" mb={2}>KYC Document Upload</Typography>
        <form onSubmit={submit}>
          <TextField fullWidth label="Document Type" margin="normal" value={type} onChange={(e) => setType(e.target.value)} />
          <Button variant="outlined" component="label" sx={{ mt: 2 }}>
            Select File
            <input hidden type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Button>
          <Typography variant="body2" mt={1}>{file?.name || 'No file selected'}</Typography>
          <Button type="submit" variant="contained" sx={{ mt: 2 }}>Upload</Button>
        </form>
      </Box>
    </Container>
  );
}



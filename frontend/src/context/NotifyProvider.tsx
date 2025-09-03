import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { setNotifier } from '../api/notify';

type Notify = (message: string, severity?: 'success' | 'info' | 'warning' | 'error') => void;

const NotifyContext = createContext<Notify | undefined>(undefined);

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('info');

  const notify: Notify = (msg, sev = 'info') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  };

  const value = useMemo(() => notify, []);

  useEffect(() => {
    setNotifier(notify);
  }, []);

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <Snackbar open={open} autoHideDuration={4000} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setOpen(false)} severity={severity} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotifyContext);
  if (!ctx) throw new Error('useNotify must be used within NotifyProvider');
  return ctx;
}



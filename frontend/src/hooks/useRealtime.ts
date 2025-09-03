import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { notify } from '../api/notify';

let paymentsSocket: Socket | null = null;
let kycSocket: Socket | null = null;

export function useRealtime(onPayment?: (p: any) => void, onKYC?: (k: any) => void) {
  useEffect(() => {
    if (!paymentsSocket) {
      const base = (import.meta.env.VITE_GATEWAY_WS_URL as string) || 'http://localhost:3000';
      const token = localStorage.getItem('token') || '';
      paymentsSocket = io(base + '/ws/payments', {
        transports: ['websocket'],
        withCredentials: false,
        path: '/socket.io',
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });
    }
    if (!kycSocket) {
      const base = (import.meta.env.VITE_GATEWAY_WS_URL as string) || 'http://localhost:3000';
      const token = localStorage.getItem('token') || '';
      kycSocket = io(base + '/ws/kyc', {
        transports: ['websocket'],
        withCredentials: false,
        path: '/socket.io',
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });
    }

    const handlePayment = (payload: any) => {
      onPayment?.(payload);
      notify(`Payment update: ${payload?.status || 'unknown'}`, 'info');
    };

    const handleKyc = (payload: any) => {
      onKYC?.(payload);
      notify(`KYC update: ${payload?.status || 'unknown'}`, 'info');
    };

    paymentsSocket.on('payment:update', handlePayment);
    paymentsSocket.on('connect_error', (err) => notify(`Payments WS error: ${err.message}`, 'warning'));
    kycSocket.on('kyc:update', handleKyc);
    kycSocket.on('connect_error', (err) => notify(`KYC WS error: ${err.message}`, 'warning'));

    return () => {
      paymentsSocket?.off('payment:update', handlePayment);
      kycSocket?.off('kyc:update', handleKyc);
    };
  }, [onPayment, onKYC]);
}



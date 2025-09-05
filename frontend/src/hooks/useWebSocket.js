import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

export const useWebSocket = (url, options = {}) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Create socket connection
    const newSocket = io(url, {
      transports: ['websocket'],
      ...options
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      setConnected(true);
      setError(null);
      console.log('WebSocket connected');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('WebSocket disconnected');
    });

    newSocket.on('connect_error', (err) => {
      setError(err);
      setConnected(false);
      console.error('WebSocket connection error:', err);
    });

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, [url, options]);

  const emit = (event, data) => {
    if (socket && connected) {
      socket.emit(event, data);
    }
  };

  const on = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const off = (event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
    }
  };

  const reconnect = () => {
    if (socket) {
      socket.connect();
    }
  };

  return {
    socket,
    connected,
    error,
    emit,
    on,
    off,
    disconnect,
    reconnect
  };
};






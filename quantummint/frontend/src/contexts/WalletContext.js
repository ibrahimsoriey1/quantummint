import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [walletStats, setWalletStats] = useState(null);

  // Fetch wallet balance
  const fetchBalance = async () => {
    if (!isAuthenticated || !user) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`/api/transactions/balance/${user.id}`);
      setBalance(response.data.data);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      toast.error('Failed to fetch wallet balance');
    } finally {
      setLoading(false);
    }
  };

  // Fetch transaction history
  const fetchTransactions = async (page = 1, limit = 10) => {
    if (!isAuthenticated || !user) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`/api/transactions/user/${user.id}`, {
        params: { page, limit }
      });
      setTransactions(response.data.data.transactions);
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      toast.error('Failed to fetch transaction history');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Create transaction
  const createTransaction = async (transactionData) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/transactions', {
        ...transactionData,
        userId: user.id
      });
      
      toast.success('Transaction created successfully!');
      
      // Refresh balance and transactions
      await fetchBalance();
      await fetchTransactions();
      
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Transaction failed';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Transfer funds
  const transferFunds = async (transferData) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/transactions/transfer', {
        ...transferData,
        fromUserId: user.id
      });
      
      toast.success('Transfer completed successfully!');
      
      // Refresh balance and transactions
      await fetchBalance();
      await fetchTransactions();
      
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Transfer failed';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Lock funds
  const lockFunds = async (amount, reason) => {
    try {
      setLoading(true);
      await axios.post(`/api/transactions/balance/${user.id}/lock`, {
        amount,
        reason
      });
      
      toast.success('Funds locked successfully!');
      await fetchBalance();
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to lock funds';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Unlock funds
  const unlockFunds = async (amount, reason) => {
    try {
      setLoading(true);
      await axios.post(`/api/transactions/balance/${user.id}/unlock`, {
        amount,
        reason
      });
      
      toast.success('Funds unlocked successfully!');
      await fetchBalance();
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to unlock funds';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Get wallet statistics
  const fetchWalletStats = async () => {
    if (!isAuthenticated || !user) return;
    
    try {
      const response = await axios.get(`/api/transactions/stats/${user.id}`);
      setWalletStats(response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch wallet stats:', error);
      return null;
    }
  };

  // Generate money (quantum generation)
  const generateMoney = async (generationData) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/money-generation/generate', {
        ...generationData,
        userId: user.id
      });
      
      toast.success('Money generated successfully!');
      
      // Refresh balance
      await fetchBalance();
      
      return { success: true, data: response.data.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Money generation failed';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Get generation history
  const fetchGenerationHistory = async (page = 1, limit = 10) => {
    if (!isAuthenticated || !user) return;
    
    try {
      const response = await axios.get(`/api/money-generation/history/${user.id}`, {
        params: { page, limit }
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch generation history:', error);
      toast.error('Failed to fetch generation history');
      return null;
    }
  };

  // Initialize wallet data when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchBalance();
      fetchWalletStats();
    }
  }, [isAuthenticated, user]);

  const value = {
    balance,
    transactions,
    walletStats,
    loading,
    fetchBalance,
    fetchTransactions,
    createTransaction,
    transferFunds,
    lockFunds,
    unlockFunds,
    fetchWalletStats,
    generateMoney,
    fetchGenerationHistory,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

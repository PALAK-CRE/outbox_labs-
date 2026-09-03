import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SlackStatus } from '../types';
import { ApiService } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  slackStatus: SlackStatus | null;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithDemo: (name?: string, email?: string) => Promise<void>;
  logout: () => void;
  refreshSlackStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);

  const refreshSlackStatus = async () => {
    try {
      const status = await ApiService.getSlackStatus();
      setSlackStatus(status);
    } catch (err) {
      console.error('Failed to load Slack status:', err);
    }
  };

  const loadUser = async () => {
    const token = localStorage.getItem('reachinbox_auth_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await ApiService.getCurrentUser();
      setUser(data.user);
      setSlackStatus({
        connected: data.slackConnected,
        teamName: data.slackTeam,
        channelName: data.slackChannel,
      });
    } catch (err) {
      console.warn('Auth token expired or invalid');
      localStorage.removeItem('reachinbox_auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();

    // Check if URL has Slack connected param
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack_connected') === 'true') {
      refreshSlackStatus();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loginWithGoogle = async (credential: string) => {
    setLoading(true);
    try {
      const res = await ApiService.loginWithGoogle(credential);
      localStorage.setItem('reachinbox_auth_token', res.token);
      setUser(res.user);
      await refreshSlackStatus();
    } finally {
      setLoading(false);
    }
  };

  const loginWithDemo = async (name?: string, email?: string) => {
    setLoading(true);
    try {
      const res = await ApiService.loginWithDemo(name, email);
      localStorage.setItem('reachinbox_auth_token', res.token);
      setUser(res.user);
      await refreshSlackStatus();
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('reachinbox_auth_token');
    setUser(null);
    setSlackStatus(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        slackStatus,
        loginWithGoogle,
        loginWithDemo,
        logout,
        refreshSlackStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

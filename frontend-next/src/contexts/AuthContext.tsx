'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'guest';
  is_owner?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  setupComplete: boolean | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setupAdmin: (username: string, password: string) => Promise<void>;
  checkSetup: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = '/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  // Check if setup is complete
  const checkSetup = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/auth/check-setup`);
      const data = await response.json();
      setSetupComplete(data.setupComplete);
      return data.setupComplete;
    } catch (error) {
      console.error('Failed to check setup status:', error);
      setSetupComplete(false);
      return false;
    }
  }, []);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);

      // Check setup status first
      await checkSetup();

      // Check for existing token
      const storedToken = localStorage.getItem('chatcve_token');
      const storedUser = localStorage.getItem('chatcve_user');

      if (storedToken && storedUser) {
        try {
          // Verify token is still valid
          const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });

          if (response.ok) {
            const userData = await response.json();
            setToken(storedToken);
            setUser(userData);
            setIsAuthenticated(true);
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('chatcve_token');
            localStorage.removeItem('chatcve_user');
          }
        } catch (error) {
          console.error('Failed to verify token:', error);
          localStorage.removeItem('chatcve_token');
          localStorage.removeItem('chatcve_user');
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, [checkSetup]);

  const login = async (username: string, password: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store token and user
    localStorage.setItem('chatcve_token', data.token);
    localStorage.setItem('chatcve_user', JSON.stringify(data.user));

    setToken(data.token);
    setUser(data.user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('chatcve_token');
    localStorage.removeItem('chatcve_user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const setupAdmin = async (username: string, password: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/auth/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Setup failed');
    }

    // Store token and user
    localStorage.setItem('chatcve_token', data.token);
    localStorage.setItem('chatcve_user', JSON.stringify(data.user));

    setToken(data.token);
    setUser(data.user);
    setIsAuthenticated(true);
    setSetupComplete(true);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        token,
        setupComplete,
        login,
        logout,
        setupAdmin,
        checkSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper to get auth headers for API calls
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('chatcve_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  return {
    'Content-Type': 'application/json',
  };
}

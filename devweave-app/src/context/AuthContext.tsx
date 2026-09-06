import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, sharedRefreshToken } from '../services/apiClient';

export type UserRole = 'ADMIN' | 'DEVELOPER' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let memoryAccessToken: string | null = null;

export function getMemoryAccessToken(): string | null {
  return memoryAccessToken;
}

export function setMemoryAccessToken(token: string | null): void {
  memoryAccessToken = token;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const updateAccessToken = (token: string | null) => {
    setAccessToken(token);
    setMemoryAccessToken(token);
  };

  const fetchCurrentUser = useCallback(async (token: string) => {
    try {
      const res = await apiClient.get<{ success: boolean; data: User }>('/v1/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.success && res.data) {
        setUser(res.data);
      }
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'UNAUTHORIZED') {
        setUser(null);
        updateAccessToken(null);
      }
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    try {
      const newToken = await sharedRefreshToken();
      if (newToken) {
        updateAccessToken(newToken);
        await fetchCurrentUser(newToken);
        return newToken;
      }
    } catch {
      updateAccessToken(null);
      setUser(null);
    }
    return null;
  }, [fetchCurrentUser]);

  // Initial auth verification on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      await refreshSession();
      setIsLoading(false);
    };
    initAuth();
  }, [refreshSession]);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { user: User; accessToken: string };
      }>('/v1/auth/login', { email, password });

      if (res.success && res.data) {
        setUser(res.data.user);
        updateAccessToken(res.data.accessToken);
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Login failed. Check your credentials.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setError(null);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { user: User };
      }>('/v1/auth/register', { name, email, password });

      if (res.success) {
        // Auto login after successful registration
        await login(email, password);
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Registration failed. Try again.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/v1/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      updateAccessToken(null);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

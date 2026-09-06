export type UserRole = 'Admin' | 'Developer' | 'Viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company?: string;
  createdAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  company?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<ForgotPasswordResponse>;
}

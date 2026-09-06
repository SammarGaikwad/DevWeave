import type {
  User,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  ForgotPasswordResponse
} from './types';

/**
 * DEVWEAVE MOCK AUTHENTICATION SERVICE
 * ------------------------------------
 * NOTE: This mock authentication service simulates API delays and local persistence.
 * When the Spring Boot backend is implemented, these mock methods will be replaced
 * with real fetch/axios HTTP calls targeting:
 *
 *   POST /api/auth/login
 *   POST /api/auth/register
 *   POST /api/auth/logout
 *   POST /api/auth/refresh
 *   GET  /api/auth/me
 *   POST /api/auth/forgot-password
 */

const STORAGE_KEY_TOKEN = 'devweave_auth_token';
const STORAGE_KEY_USER = 'devweave_auth_user';

// Helper to simulate asynchronous backend delay
const delay = (ms: number = 600) => new Promise((resolve) => setTimeout(resolve, ms));

export const authService = {
  /**
   * Future Spring Boot endpoint: POST /api/auth/login
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    await delay(700);

    // Mock validation check for development
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required.');
    }

    // Default mock user profile
    const mockUser: User = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      name: credentials.email.split('@')[0].replace('.', ' ').replace(/^./, (str) => str.toUpperCase()) || 'Developer',
      email: credentials.email,
      role: 'Developer',
      company: 'DevWeave Organization',
      createdAt: new Date().toISOString()
    };

    const mockToken = 'mock_jwt_token_' + btoa(JSON.stringify({ sub: mockUser.email, role: mockUser.role, exp: Date.now() + 86400000 }));

    if (credentials.rememberMe !== false) {
      localStorage.setItem(STORAGE_KEY_TOKEN, mockToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(mockUser));
    } else {
      sessionStorage.setItem(STORAGE_KEY_TOKEN, mockToken);
      sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(mockUser));
    }

    return { user: mockUser, token: mockToken };
  },

  /**
   * Future Spring Boot endpoint: POST /api/auth/register
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    await delay(800);

    if (!credentials.name || !credentials.email || !credentials.password) {
      throw new Error('Please fill in all required fields.');
    }

    // Role is automatically assigned as 'Developer' for initial registration
    const newUser: User = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      name: credentials.name,
      email: credentials.email,
      role: 'Developer',
      company: credentials.company || 'Independent Developer',
      createdAt: new Date().toISOString()
    };

    const mockToken = 'mock_jwt_token_' + btoa(JSON.stringify({ sub: newUser.email, role: newUser.role, exp: Date.now() + 86400000 }));

    localStorage.setItem(STORAGE_KEY_TOKEN, mockToken);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));

    return { user: newUser, token: mockToken };
  },

  /**
   * Future Spring Boot endpoint: POST /api/auth/logout
   */
  async logout(): Promise<void> {
    await delay(300);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_USER);
  },

  /**
   * Future Spring Boot endpoint: GET /api/auth/me
   */
  async getCurrentUser(): Promise<User | null> {
    const rawUser = localStorage.getItem(STORAGE_KEY_USER) || sessionStorage.getItem(STORAGE_KEY_USER);
    const token = localStorage.getItem(STORAGE_KEY_TOKEN) || sessionStorage.getItem(STORAGE_KEY_TOKEN);

    if (!rawUser || !token) {
      return null;
    }

    try {
      return JSON.parse(rawUser) as User;
    } catch {
      return null;
    }
  },

  /**
   * Future Spring Boot endpoint: POST /api/auth/forgot-password
   */
  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    await delay(600);

    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    return {
      success: true,
      message: 'If an account exists for this email, a reset link will be sent.'
    };
  }
};

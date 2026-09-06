import { Role } from '../generated/prisma/enums.js';
import * as userRepository from '../repositories/userRepository.js';
import * as refreshSessionService from './refreshSessionService.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateAccessToken } from '../utils/jwt.js';
import { RegisterRequestInput, LoginRequestInput } from '../schemas/authSchema.js';
import { UserResponse } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

export function sanitizeUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function register(input: RegisterRequestInput): Promise<UserResponse> {
  const normalizedEmail = input.email.toLowerCase().trim();
  const exists = await userRepository.existsUserByEmail(normalizedEmail);
  if (exists) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await hashPassword(input.password);

  const user = await userRepository.createUser({
    name: input.name,
    email: normalizedEmail,
    passwordHash,
    role: Role.DEVELOPER, // Standard registration always assigns DEVELOPER
  });

  return sanitizeUser(user);
}

export async function login(input: LoginRequestInput): Promise<{
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}> {
  const user = await userRepository.findUserByEmail(input.email.toLowerCase().trim());
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  const isPasswordValid = await comparePassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password.', 401);
  }

  const accessToken = generateAccessToken({
    sub: user.id,
    role: user.role,
  });

  const { rawToken: refreshToken } = await refreshSessionService.createSession(user.id);

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

export async function refresh(
  rawRefreshToken: string
): Promise<{ accessToken: string; newRefreshToken: string }> {
  const { userId, newRawToken } = await refreshSessionService.validateAndRotateSession(
    rawRefreshToken
  );

  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new AppError('User account not found', 401);
  }

  const accessToken = generateAccessToken({
    sub: user.id,
    role: user.role,
  });

  return {
    accessToken,
    newRefreshToken: newRawToken,
  };
}

export async function logout(rawRefreshToken?: string): Promise<void> {
  if (rawRefreshToken) {
    await refreshSessionService.revokeSessionByToken(rawRefreshToken);
  }
}

export async function logoutAll(userId: string): Promise<void> {
  await refreshSessionService.revokeAllSessionsForUser(userId);
}

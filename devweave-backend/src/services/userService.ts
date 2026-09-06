import { Role } from '../generated/prisma/enums.js';
import * as userRepository from '../repositories/userRepository.js';
import { hashPassword } from '../utils/password.js';
import { UserResponse } from '../types/index.js';
import { RegisterRequestInput } from '../schemas/authSchema.js';
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

export async function createUser(input: RegisterRequestInput): Promise<UserResponse> {
  const exists = await userRepository.existsUserByEmail(input.email);
  if (exists) {
    throw new AppError(`User with email ${input.email} already exists`, 409);
  }

  const assignedRole = input.role ?? Role.DEVELOPER;

  const passwordHash = await hashPassword(input.password);

  const createdUser = await userRepository.createUser({
    name: input.name,
    email: input.email,
    passwordHash,
    role: assignedRole,
  });

  return sanitizeUser(createdUser);
}

export async function getUserById(id: string): Promise<UserResponse> {
  const user = await userRepository.findUserById(id);
  if (!user) {
    throw new AppError(`User not found with ID: ${id}`, 404);
  }
  return sanitizeUser(user);
}

export async function getUserByEmail(email: string): Promise<UserResponse> {
  const user = await userRepository.findUserByEmail(email);
  if (!user) {
    throw new AppError(`User not found with email: ${email}`, 404);
  }
  return sanitizeUser(user);
}

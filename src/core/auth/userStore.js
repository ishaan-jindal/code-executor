import { redis } from "../../infrastructure/redis/redisClient.js";
import bcrypt from "bcryptjs";

/**
 * User Store - Redis-backed user management
 */

export async function createUser(userData) {
  const { username, email, password, tier = "free" } = userData;
  
  // Check if user exists
  const existing = await redis.get(`user:username:${username}`);
  if (existing) {
    throw new Error("Username already exists");
  }
  
  const existingEmail = await redis.get(`user:email:${email}`);
  if (existingEmail) {
    throw new Error("Email already exists");
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const user = {
    id: userId,
    username,
    email,
    passwordHash,
    tier,
    rateLimit: getTierRateLimit(tier),
    createdAt: Date.now(),
  };
  
  // Store user
  await redis.set(`user:${userId}`, JSON.stringify(user));
  await redis.set(`user:username:${username}`, userId);
  await redis.set(`user:email:${email}`, userId);
  
  return sanitizeUser(user);
}

export async function getUserById(userId) {
  const data = await redis.get(`user:${userId}`);
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

export async function getUserByUsername(username) {
  const userId = await redis.get(`user:username:${username}`);
  if (!userId) return null;
  
  return getUserById(userId);
}

export async function getUserByEmail(email) {
  const userId = await redis.get(`user:email:${email}`);
  if (!userId) return null;
  
  return getUserById(userId);
}

export async function validatePassword(user, password) {
  return bcrypt.compare(password, user.passwordHash);
}

export async function updateUser(userId, updates) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  const updated = { ...user, ...updates };
  await redis.set(`user:${userId}`, JSON.stringify(updated));
  
  return sanitizeUser(updated);
}

function getTierRateLimit(tier) {
  const limits = {
    free: 10,      // 10 requests per minute
    starter: 50,   // 50 requests per minute
    professional: 100,
    enterprise: 500,
  };
  return limits[tier] || 10;
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

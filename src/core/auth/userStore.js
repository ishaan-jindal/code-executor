import { redis } from "../../infrastructure/redis/redisClient.js";
import bcrypt from "bcryptjs";

/**
 * User Store - Redis-backed user management
 */

export async function createUser(userData) {
  const { username, email, password, tier = "free", role = "user" } = userData;
  
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
    role,
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

export async function deleteUser(userId) {
  const user = await getUserById(userId);
  if (!user) {
    return false;
  }

  // Remove API keys for user
  const keyIds = await redis.smembers(`user:${userId}:apikeys`);
  if (keyIds && keyIds.length > 0) {
    for (const keyId of keyIds) {
      const hashedKey = await redis.get(`apikeyid:${keyId}`);
      if (hashedKey) {
        await redis.del(`apikey:${hashedKey}`);
        await redis.del(`apikeyid:${keyId}`);
      }
    }
    await redis.del(`user:${userId}:apikeys`);
  }

  // Remove webhooks and deliveries
  const webhookKeys = [];
  let cursor = "0";
  do {
    const [newCursor, foundKeys] = await redis.scan(
      cursor,
      "MATCH",
      `user:${userId}:webhooks:*`,
      "COUNT",
      "100"
    );
    cursor = newCursor;
    webhookKeys.push(...foundKeys);
  } while (cursor !== "0");

  for (const key of webhookKeys) {
    const webhookId = key.split(":").pop();
    if (webhookId) {
      await redis.del(`webhook:${webhookId}`);

      // Delete deliveries for this webhook
      let deliveryCursor = "0";
      do {
        const [newDeliveryCursor, deliveryKeys] = await redis.scan(
          deliveryCursor,
          "MATCH",
          `webhook:${webhookId}:deliveries:*`,
          "COUNT",
          "100"
        );
        deliveryCursor = newDeliveryCursor;
        if (deliveryKeys.length > 0) {
          await redis.del(...deliveryKeys);
        }
      } while (deliveryCursor !== "0");
    }

    await redis.del(key);
  }

  // Remove user record and indexes
  await redis.del(`user:${userId}`);
  await redis.del(`user:username:${user.username}`);
  await redis.del(`user:email:${user.email}`);

  return true;
}

export async function getAllUsers(limit = 100, offset = 0) {
  // Scan for all user keys (pattern: user:user_*)
  const keys = [];
  let cursor = "0";
  
  do {
    const [newCursor, foundKeys] = await redis.scan(
      cursor,
      "MATCH",
      "user:user_*",
      "COUNT",
      "100"
    );
    cursor = newCursor;
    keys.push(...foundKeys);
  } while (cursor !== "0");
  
  // Get all user data
  const users = [];
  for (const key of keys) {
    // Skip non-string keys (e.g., user:<id>:apikeys set)
    const keyType = await redis.type(key);
    if (keyType !== "string") {
      continue;
    }

    const data = await redis.get(key);
    if (data) {
      try {
        const user = JSON.parse(data);
        users.push(sanitizeUser(user));
      } catch (e) {
        // Skip malformed entries
      }
    }
  }
  
  // Sort by createdAt descending (newest first)
  users.sort((a, b) => b.createdAt - a.createdAt);
  
  // Apply pagination
  const paginated = users.slice(offset, offset + limit);
  
  return {
    users: paginated,
    total: users.length,
    limit,
    offset,
  };
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

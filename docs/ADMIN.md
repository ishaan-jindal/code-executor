# Admin Features & Seeding Implementation

## Overview

Implemented comprehensive admin features and test data seeding for the code executor authentication system.

## What Was Built

### 1. Admin Middleware (`src/middleware/adminMiddleware.js`)
- `requireAdmin()` - Middleware to check for admin role
- Returns 403 Forbidden if user doesn't have admin role
- Logs unauthorized access attempts
- Must be used after `authenticateJWT`

### 2. Role-Based Access Control Updates
- Added `role` field to user objects (default: "user", optional: "admin")
- Updated JWT tokens to include role claim
- Role is now attached to `req.user` in authenticated requests
- Admin users created via seeding script

### 3. Admin API Endpoints (4 new endpoints)

**Endpoint: `POST /admin/users/:userId/upgrade`**
- Upgrade user tier
- Valid tiers: free, starter, professional, enterprise
- Only admin can execute
- Updates rate limit accordingly

**Endpoint: `GET /admin/users/:userId`**
- Get user details (admin only)
- Returns sanitized user object (no password)
- Useful for viewing user information

**Endpoint: `POST /admin/users/:userId/make-admin`**
- Grant admin role to user
- Logs who made the change
- User cannot promote themselves

**Endpoint: `POST /admin/users/:userId/revoke-admin`**
- Revoke admin role from user
- User cannot revoke their own admin status
- Logged for audit trail

### 4. Database Seeding Script (`scripts/seed.js`)

Creates test users with different tiers and roles:

**Test Users Created:**
1. **admin** (AdminPass123!) - Enterprise tier, admin role
   - Can perform all admin operations
   - Full rate limit (500 req/min)

2. **alice** (AlicePass123!) - Free tier, user role
   - 10 requests/minute limit
   - Standard user permissions

3. **bob** (BobPass123!) - Starter tier, user role
   - 50 requests/minute limit

4. **charlie** (CharliePass123!) - Professional tier, user role
   - 100 requests/minute limit

5. **diana** (DianaPass123!) - Enterprise tier, user role
   - 500 requests/minute limit

**Features:**
- Checks for existing users (skips if already present)
- Colored output for readability
- Shows login credentials for all test users
- Provides quick test commands
- Displays connection verification

**Usage:**
```bash
npm run seed
```

### 5. Updated Core Files

**src/core/auth/userStore.js:**
- `createUser()` now accepts `role` parameter (defaults to "user")
- Stores role in user object
- Validates and maintains role throughout user lifecycle

**src/core/auth/jwtUtils.js:**
- Access tokens now include `role` claim
- Role persists across token refreshes
- Available in all authenticated requests

**src/middleware/authMiddleware.js:**
- Both `authenticateJWT()` and `optionalAuth()` attach role to `req.user`
- Role defaulted to "user" if not present (backward compatible)

**src/api/routes/index.js:**
- Admin routes mounted at `/admin` prefix
- Auth routes remain at `/auth`

## File Structure

```
New Files:
- src/middleware/adminMiddleware.js       (Admin role checking)
- src/api/routes/admin.routes.js          (4 admin endpoints)
- scripts/seed.js                         (Test data seeding)

Updated Files:
- src/core/auth/userStore.js              (Role support)
- src/core/auth/jwtUtils.js               (Role in JWT)
- src/middleware/authMiddleware.js        (Role attachment)
- src/api/routes/index.js                 (Admin routing)
- package.json                            (npm run seed)
- docs/API.md                             (Admin API docs)
- README.md                               (Seeding instructions)
```

## Usage Examples

### 1. Seed Database

```bash
npm run seed
```

Output shows all created users and login credentials.

### 2. Login as Admin

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "AdminPass123!"
  }'
```

### 3. Upgrade User Tier (Admin Only)

```bash
# Get admin token
ADMIN_TOKEN="..."

# Upgrade alice from free to professional
curl -X POST http://localhost:4000/admin/users/USER_ID/upgrade \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newTier": "professional"
  }'
```

### 4. View User Details (Admin Only)

```bash
curl -X GET http://localhost:4000/admin/users/USER_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 5. Grant Admin Privileges

```bash
curl -X POST http://localhost:4000/admin/users/USER_ID/make-admin \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 6. Revoke Admin Privileges

```bash
curl -X POST http://localhost:4000/admin/users/USER_ID/revoke-admin \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Database Schema Updates

### User Object (Redis: `user:{id}`)

Now includes:
```javascript
{
  id: "string",
  username: "string",
  email: "string",
  passwordHash: "bcrypt hash",
  tier: "free|starter|professional|enterprise",
  role: "user|admin",                           // NEW
  rateLimit: 10|50|100|500,
  createdAt: timestamp
}
```

### JWT Token Claims

Access token now includes:
```javascript
{
  sub: "user_id",
  username: "string",
  email: "string",
  tier: "string",
  rateLimit: number,
  role: "user|admin",                           // NEW
  type: "access",
  iat: timestamp,
  exp: timestamp
}
```

## Security Considerations

✅ **Admin-Only Operations:**
- All admin endpoints check for admin role
- Attempts to access admin endpoints are logged
- Non-admin users get 403 Forbidden

✅ **User Protection:**
- Users cannot change their own tier (must go through upgrade endpoint)
- Admins cannot change their own role
- All admin actions are logged with admin ID

✅ **Data Integrity:**
- Tier upgrades are atomic operations
- Role changes are immediately reflected in new tokens
- No bypass routes or privilege escalation paths

## Testing

The seeding script outputs quick test commands:

```bash
# Get token for alice (free tier user)
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"AlicePass123!"}' \
  | jq '.data.accessToken' -r)

# Submit code with rate limit
curl -X POST http://localhost:4000/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"python","code":"print(1+1)"}'

# Check rate limit headers
# X-RateLimit-Limit: 10
# X-RateLimit-Remaining: 9
```

## Next Steps

### Future Enhancements

1. **User Listing** - Add endpoint to list all users (paginated)
2. **User Suspension** - Add ability to suspend/ban users
3. **Role-Based Rate Limits** - More granular control per role
4. **Audit Logging** - Complete audit trail of all admin actions
5. **Email Notifications** - Notify users when tier changes
6. **Bulk Operations** - Upgrade multiple users at once

### Integration with Existing Features

✅ Works seamlessly with:
- JWT authentication
- Rate limiting (uses tier from JWT)
- Job submission (user isolation preserved)
- Monitoring (can track admin actions)

## Files Modified Summary

| File | Changes |
|------|---------|
| src/core/auth/userStore.js | Added role parameter to createUser |
| src/core/auth/jwtUtils.js | Role included in access token |
| src/middleware/authMiddleware.js | Role attached to req.user |
| src/api/routes/index.js | Admin routes mounting |
| package.json | npm run seed script |
| docs/API.md | 4 new admin endpoints documented |
| README.md | Seeding section added |

## Verification

Test that everything works:

```bash
# 1. Seed database
npm run seed

# 2. Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"AdminPass123!"}' \
  | jq '.data.accessToken' -r)

# 3. Try upgrading a user
curl -X POST http://localhost:4000/admin/users/SOME_USER_ID/upgrade \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newTier":"starter"}'
```

## Documentation

- **API Endpoints**: [docs/API.md](../docs/API.md) - Complete admin API documentation
- **Authentication**: [docs/AUTHENTICATION.md](../docs/AUTHENTICATION.md) - Auth system overview
- **Quick Start**: [README.md](../README.md) - Includes seeding instructions

---

**Status:** ✅ Complete and tested
**Lines of Code:** ~450 lines of new code
**Test Coverage:** Seeding validates all user creation paths

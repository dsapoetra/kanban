# Authentication System Documentation

This document describes the complete authentication system implemented for the Kanban application, including registration, login, JWT tokens, and PostgreSQL integration.

## 🚀 Quick Start

### 1. Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your values:
   ```env
   DATABASE_URL=postgresql://kanban_user:your_password@localhost:5432/kanban_db
   JWT_SECRET=your_64_character_hex_string_here
   ```

3. Generate a JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

### 2. Database Setup

1. Install PostgreSQL and create the database:
   ```bash
   # Create database and user
   psql -U postgres -c "CREATE DATABASE kanban_db;"
   psql -U postgres -c "CREATE USER kanban_user WITH PASSWORD 'your_password';"
   psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE kanban_db TO kanban_user;"
   ```

2. Run the migration:
   ```bash
   psql -U kanban_user -d kanban_db -f database/migrations/001_create_users_table.sql
   ```

### 3. Install Dependencies

Dependencies are already installed, but if needed:
```bash
npm install bcryptjs jsonwebtoken pg zod
npm install --save-dev @types/bcryptjs @types/jsonwebtoken @types/pg
```

### 4. Start the Application

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 📁 File Structure

```
src/
├── app/
│   ├── api/auth/
│   │   ├── login/route.ts          # Login API endpoint
│   │   └── register/route.ts       # Registration API endpoint
│   ├── api/protected/
│   │   └── profile/route.ts        # Example protected API
│   ├── auth/
│   │   ├── login/page.tsx          # Login page
│   │   └── register/page.tsx       # Registration page
│   ├── dashboard/page.tsx          # Protected dashboard
│   └── page.tsx                    # Home page
├── lib/
│   ├── auth.ts                     # Authentication utilities
│   └── database.ts                 # Database connection
├── types/
│   └── auth.ts                     # TypeScript types
└── middleware.ts                   # Route protection middleware

database/
└── migrations/
    ├── 001_create_users_table.sql  # Database schema
    └── README.md                   # Database setup guide
```

## 🔐 Authentication Flow

### Registration Process
1. User fills out registration form (`/auth/register`)
2. Client-side validation using Zod schemas
3. API validates input and checks for existing users
4. Password is hashed using bcrypt (12 salt rounds)
5. User is stored in PostgreSQL database
6. JWT token is generated and returned
7. User is redirected to dashboard

### Login Process
1. User enters credentials (`/auth/login`)
2. API validates input format
3. User is retrieved from database by email
4. Password is verified against stored hash
5. JWT token is generated and returned
6. User is redirected to dashboard

### Route Protection
- Middleware checks JWT tokens on protected routes
- Invalid/expired tokens redirect to login
- Authenticated users can't access auth pages
- API routes receive user info in headers

## 🛡️ Security Features

### Password Security
- **Bcrypt hashing** with 12 salt rounds
- **Minimum requirements**: 8+ chars, uppercase, lowercase, number
- **No plaintext storage** - only hashes in database

### JWT Security
- **7-day expiration** for tokens
- **Cryptographically secure** secret key
- **Issuer/audience validation** for token integrity
- **Automatic token verification** in middleware

### Database Security
- **Parameterized queries** prevent SQL injection
- **Connection pooling** with proper error handling
- **Email uniqueness** enforced at database level
- **Timestamps** for audit trails

## 🔧 API Endpoints

### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2025-09-27T10:00:00Z",
    "updated_at": "2025-09-27T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### POST `/api/auth/login`
Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2025-09-27T10:00:00Z",
    "updated_at": "2025-09-27T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### GET `/api/protected/profile`
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2025-09-27T10:00:00Z",
    "updated_at": "2025-09-27T10:00:00Z"
  }
}
```

## 🧪 Testing the System

### Manual Testing
1. **Registration**: Visit `/auth/register` and create an account
2. **Login**: Visit `/auth/login` and sign in
3. **Protected Route**: Try accessing `/dashboard` without login
4. **API Testing**: Use curl or Postman to test API endpoints

### Example API Test
```bash
# Register a user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123","confirmPassword":"TestPass123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# Access protected endpoint
curl -X GET http://localhost:3000/api/protected/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## 🚨 Error Handling

The system provides comprehensive error handling:

- **Validation Errors**: Field-specific error messages
- **Authentication Errors**: Clear unauthorized messages  
- **Database Errors**: Graceful handling of connection issues
- **Server Errors**: Generic messages to avoid information leakage

## 🔄 Next Steps

Consider implementing these additional features:

1. **Password Reset**: Email-based password recovery
2. **Email Verification**: Confirm email addresses on registration
3. **Refresh Tokens**: Long-term authentication with token refresh
4. **Rate Limiting**: Prevent brute force attacks
5. **OAuth Integration**: Social login (Google, GitHub, etc.)
6. **Two-Factor Authentication**: Enhanced security with TOTP
7. **Session Management**: View and revoke active sessions

## 📝 Notes

- Tokens are stored in localStorage (consider httpOnly cookies for production)
- Database connection pool is configured for optimal performance
- Middleware automatically handles route protection
- All passwords are hashed before storage
- Email addresses are stored in lowercase for consistency

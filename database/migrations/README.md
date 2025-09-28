# Database Migrations

This directory contains PostgreSQL migration scripts for the Kanban application.

## Setup Instructions

1. **Install PostgreSQL** (if not already installed):
   ```bash
   # macOS with Homebrew
   brew install postgresql
   
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   
   # Windows - Download from https://www.postgresql.org/download/windows/
   ```

2. **Create Database**:
   ```bash
   # Connect to PostgreSQL as superuser
   psql -U postgres
   
   # Create database and user
   CREATE DATABASE kanban_db;
   CREATE USER kanban_user WITH PASSWORD 'your_password_here';
   GRANT ALL PRIVILEGES ON DATABASE kanban_db TO kanban_user;
   \q
   ```

3. **Run Migrations**:
   ```bash
   # Run the migration script
   psql -U kanban_user -d kanban_db -f database/migrations/001_create_users_table.sql
   ```

4. **Environment Variables**:
   Create a `.env.local` file in your project root with:
   ```
   DATABASE_URL=postgresql://kanban_user:your_password_here@localhost:5432/kanban_db
   JWT_SECRET=your_jwt_secret_key_here
   ```

## Migration Files

- `001_create_users_table.sql` - Creates the users table for authentication
- `002_create_kanban_tables.sql` - Creates all Kanban-related tables (boards, columns, tasks, sprints, etc.)

## Notes

- Always backup your database before running migrations in production
- Migration files are numbered sequentially (001, 002, etc.)
- Each migration should be idempotent (safe to run multiple times)

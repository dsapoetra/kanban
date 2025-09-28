# Kanban Board Application

A comprehensive Kanban board web application similar to Jira, built with Next.js, TypeScript, and PostgreSQL.

## Features

### 🔐 Authentication
- User registration and login
- JWT-based authentication
- Protected routes and API endpoints

### 📋 Board Management
- Create and manage multiple Kanban boards
- Customizable board descriptions
- Board ownership and access control

### 📝 Task Management
- Create, edit, and delete tasks
- Drag-and-drop task movement between columns
- Task priorities (Low, Medium, High, Urgent)
- Task assignments to team members
- Due dates and completion tracking
- Task history and audit trail

### 🏃‍♂️ Sprint Management
- Create and manage sprints
- Sprint planning and backlog management
- Start and complete sprints
- Sprint goals and descriptions

### 👥 Team Collaboration
- Invite team members to boards
- Role-based access control (Admin, Member, Viewer)
- Team member management

### 📊 Analytics & Reporting
- Board analytics and metrics
- Sprint velocity tracking
- Burndown charts
- Task completion statistics
- Team performance insights

### 🎨 User Interface
- Responsive design for all devices
- Intuitive drag-and-drop interface
- Real-time updates
- Modern, clean UI with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 15.5.4, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT tokens
- **Drag & Drop**: @dnd-kit/core
- **Validation**: Zod schemas
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kanban
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb kanban_db

   # Create user (optional)
   psql -c "CREATE USER dsapoetra WITH PASSWORD 'your_password';"
   psql -c "GRANT ALL PRIVILEGES ON DATABASE kanban_db TO dsapoetra;"
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Update `.env.local` with your database credentials:
   ```
   DATABASE_URL=postgresql://dsapoetra:your_password@localhost:5432/kanban_db
   JWT_SECRET=your-super-secret-jwt-key-here
   ```

5. **Run database migrations**
   ```bash
   psql -U dsapoetra -d kanban_db -f database/migrations/001_create_users_table.sql
   psql -U dsapoetra -d kanban_db -f database/migrations/002_create_kanban_tables.sql
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Getting Started

1. **Register an account** at `/auth/register`
2. **Login** at `/auth/login`
3. **Create your first board** from the dashboard
4. **Add columns** to organize your workflow (Todo, In Progress, Done, etc.)
5. **Create tasks** and start managing your projects!

### Key Features

- **Drag & Drop**: Move tasks between columns by dragging
- **Task Details**: Click on any task to edit details, assign members, set due dates
- **Sprint Planning**: Create sprints and add tasks from the backlog
- **Team Collaboration**: Invite team members and assign tasks
- **Analytics**: View progress reports and velocity charts

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Boards
- `GET /api/boards` - Get user's boards
- `POST /api/boards` - Create new board
- `GET /api/boards/[id]` - Get board details
- `PUT /api/boards/[id]` - Update board
- `DELETE /api/boards/[id]` - Delete board

### Tasks
- `GET /api/boards/[id]/tasks` - Get board tasks
- `POST /api/boards/[id]/tasks` - Create task
- `PUT /api/boards/[id]/tasks/[taskId]` - Update task
- `DELETE /api/boards/[id]/tasks/[taskId]` - Delete task
- `POST /api/boards/[id]/tasks/[taskId]/move` - Move task

### Sprints
- `GET /api/boards/[id]/sprints` - Get board sprints
- `POST /api/boards/[id]/sprints` - Create sprint
- `POST /api/boards/[id]/sprints/[sprintId]/start` - Start sprint
- `POST /api/boards/[id]/sprints/[sprintId]/complete` - Complete sprint

### Analytics
- `GET /api/boards/[id]/analytics` - Get board analytics
- `GET /api/boards/[id]/analytics/velocity` - Get velocity data
- `GET /api/boards/[id]/analytics/burndown` - Get burndown chart data

## Testing

### Manual Testing
1. Start the development server: `npm run dev`
2. Open [http://localhost:3000](http://localhost:3000)
3. Test the complete user flow:
   - Register/Login
   - Create boards
   - Add tasks
   - Drag and drop tasks
   - Create sprints
   - View analytics

### API Testing
Run the automated API tests:
```bash
node test-runner.js
```

This will test all API endpoints with sample data.

## Database Schema

The application uses the following main tables:
- `users` - User accounts
- `boards` - Kanban boards
- `board_members` - Board team members
- `columns` - Board columns
- `tasks` - Individual tasks
- `sprints` - Sprint management
- `sprint_tasks` - Sprint-task relationships
- `task_history` - Audit trail
- `team_invitations` - Team invitations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please open an issue in the repository.

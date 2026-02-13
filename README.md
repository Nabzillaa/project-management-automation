# Project Management Application

A comprehensive web-based project management application with automated planning, cost tracking, resource management, and integrations with JIRA and Microsoft services.

## Features

- **Automated Project Planning**: Critical Path Method (CPM), PERT estimation, timeline generation
- **Cost & Budget Tracking**: Real-time monitoring with alerts and cost-saving suggestions
- **Resource Management**: Allocation, conflict detection, resource leveling
- **Multi-Project Oversight**: Portfolio dashboard with health indicators
- **Visualizations**: Gantt charts, burndown charts, executive summaries
- **Notifications**: Overdue task reminders, budget alerts, email notifications
- **Integrations**: JIRA bidirectional sync, Microsoft SSO/calendar/Teams

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Material-UI
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Cache/Queue**: Redis + Bull
- **Deployment**: Docker + Docker Compose

## Project Structure

```
project-management-app/
├── packages/
│   ├── frontend/          # React frontend application
│   ├── backend/           # Express API server
│   ├── shared/            # Shared TypeScript types
│   ├── planning-engine/   # Planning algorithms (CPM, PERT, etc.)
│   └── database/          # Prisma schema and migrations
├── docker/                # Docker configurations
├── docs/                  # Documentation
└── docker-compose.yml     # Services configuration
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 15 (via Docker)
- Redis 7 (via Docker)

### Installation

1. **Clone the repository**

```bash
cd /Users/nabilsabih/projects/project-management-app
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Start database services**

```bash
docker-compose up -d
```

This will start PostgreSQL on port 5432 and Redis on port 6379.

4. **Set up environment variables**

```bash
# Backend
cp packages/backend/.env.example packages/backend/.env

# Database
cp packages/database/.env.example packages/database/.env
```

Edit the `.env` files with your configuration.

5. **Generate Prisma client and run migrations**

```bash
pnpm db:generate
pnpm db:migrate
```

6. **Start development servers**

```bash
pnpm dev
```

This will start:
- Backend API on http://localhost:3001
- Frontend on http://localhost:3000

### Database Management

```bash
# Generate Prisma client
pnpm db:generate

# Create and run migrations
pnpm db:migrate

# Open Prisma Studio (database GUI)
pnpm db:studio

# Run database seeds
pnpm db:seed
```

## Development

### Available Scripts

```bash
# Development
pnpm dev              # Start all dev servers
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm format           # Format code with Prettier

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Prisma Studio
```

### Package Scripts

Each package has its own scripts. Navigate to the package directory:

```bash
cd packages/backend
pnpm dev              # Start backend dev server
pnpm build            # Build backend
pnpm test             # Run backend tests
```

## API Documentation

Once the backend is running, API documentation is available at:
- Swagger UI: http://localhost:3001/api-docs

## Database Schema

The application uses PostgreSQL with the following main entities:
- Users & Organizations
- Projects & Tasks
- Task Dependencies
- Resources & Allocations
- Cost Entries & Budget Alerts
- Time Entries
- Notifications & Reminders
- Integration Credentials
- Reports
- Planning Sessions

See [packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma) for the complete schema.

## Architecture

### Planning Engine

The planning engine implements rule-based algorithms:
- **CPM (Critical Path Method)**: Identifies critical tasks and project duration
- **PERT**: Three-point estimation with confidence intervals
- **Resource Leveling**: Optimizes resource allocation
- **Timeline Optimization**: Fast-tracking and crashing techniques

### Authentication

- JWT-based authentication
- Microsoft OAuth2 integration
- Role-based access control (Admin, Manager, Member)

### Integrations

#### JIRA Integration
- OAuth2 authentication
- Import/export projects and issues
- Bidirectional status sync
- Webhook support for real-time updates

#### Microsoft Integration
- Single Sign-On (SSO)
- Calendar sync (deadlines → Outlook)
- Teams notifications
- User profile sync

## Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/backend
pnpm test

# Run E2E tests
cd packages/frontend
pnpm test:e2e
```

## Deployment

### Docker Deployment

1. **Build Docker images**

```bash
docker-compose -f docker-compose.prod.yml build
```

2. **Start production services**

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables

Required environment variables for production:

**Backend:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT signing
- `MICROSOFT_CLIENT_ID`: Microsoft OAuth client ID
- `MICROSOFT_CLIENT_SECRET`: Microsoft OAuth secret
- `JIRA_CLIENT_ID`: JIRA OAuth client ID
- `JIRA_CLIENT_SECRET`: JIRA OAuth secret
- `SMTP_HOST`: Email server host
- `SMTP_USER`: Email username
- `SMTP_PASSWORD`: Email password
- `REDIS_HOST`: Redis host
- `REDIS_PORT`: Redis port

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Run linting and tests
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on the repository.

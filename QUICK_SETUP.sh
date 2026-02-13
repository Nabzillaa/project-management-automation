#!/bin/bash

# Quick Setup Script for Project Management App
# This script will help you get the application running

set -e

echo "🚀 Project Management App - Quick Setup"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check Docker
echo "Step 1: Checking Docker..."
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker is installed${NC}"
    docker --version
else
    echo -e "${RED}✗ Docker is NOT installed${NC}"
    echo ""
    echo "Please install Docker Desktop:"
    echo "1. Visit: https://www.docker.com/products/docker-desktop"
    echo "2. Download Docker Desktop for Mac"
    echo "3. Install and start Docker Desktop"
    echo "4. Run this script again"
    exit 1
fi

# Step 2: Start Docker containers
echo ""
echo "Step 2: Starting database containers..."
if docker compose up -d; then
    echo -e "${GREEN}✓ Containers started (PostgreSQL + Redis)${NC}"
else
    echo -e "${RED}✗ Failed to start containers${NC}"
    exit 1
fi

# Step 3: Wait for database to be ready
echo ""
echo "Step 3: Waiting for database to be ready..."
sleep 5
echo -e "${GREEN}✓ Database should be ready${NC}"

# Step 4: Setup environment files
echo ""
echo "Step 4: Setting up environment files..."
cp packages/backend/.env.example packages/backend/.env 2>/dev/null || echo "Backend .env already exists"
cp packages/database/.env.example packages/database/.env 2>/dev/null || echo "Database .env already exists"
cp packages/frontend/.env.example packages/frontend/.env 2>/dev/null || echo "Frontend .env already exists"
echo -e "${GREEN}✓ Environment files created${NC}"

# Step 5: Generate Prisma client
echo ""
echo "Step 5: Generating Prisma client..."
if pnpm db:generate; then
    echo -e "${GREEN}✓ Prisma client generated${NC}"
else
    echo -e "${RED}✗ Failed to generate Prisma client${NC}"
    exit 1
fi

# Step 6: Run database migrations
echo ""
echo "Step 6: Running database migrations..."
if pnpm db:migrate; then
    echo -e "${GREEN}✓ Migrations completed${NC}"
else
    echo -e "${RED}✗ Migration failed${NC}"
    exit 1
fi

# Step 7: Seed database
echo ""
echo "Step 7: Seeding database with demo data..."
cd packages/database
if pnpm db:seed; then
    echo -e "${GREEN}✓ Database seeded${NC}"
    cd ../..
else
    echo -e "${RED}✗ Seeding failed${NC}"
    cd ../..
    exit 1
fi

# Success!
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "🎉 Your application is ready to run!"
echo ""
echo "To start the application, run:"
echo -e "${YELLOW}  pnpm dev${NC}"
echo ""
echo "Then visit:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001/api"
echo ""
echo "Login credentials:"
echo "  Email:    admin@demo.com"
echo "  Password: password123"
echo ""
echo "For more information, see:"
echo "  - STARTUP_GUIDE.md"
echo "  - PROJECT_STATUS.md"

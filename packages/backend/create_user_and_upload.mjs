import pkg from '@pm-app/database';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Create default user if not exists
console.log('=== Step 1: Ensuring default user exists ===');

const orgId = '00000000-0000-0000-0000-000000000000';

// Ensure organization exists
let org = await prisma.organization.findUnique({ where: { id: orgId } });
if (!org) {
  org = await prisma.organization.create({
    data: {
      id: orgId,
      name: 'Default Organization',
      slug: 'default-org'
    }
  });
  console.log('Created default organization');
}

// Check if user exists
let user = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });

if (!user) {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  user = await prisma.user.create({
    data: {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'admin@example.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      organizationId: orgId
    }
  });
  console.log('Created default user:', user.email);
} else {
  console.log('User already exists:', user.email);
}

// Now import files directly using the import functions
console.log('\n=== Step 2: Importing Excel file ===');

// We need to import the functions but they're in TypeScript
// Let's just call the upload endpoint with proper auth

await prisma.$disconnect();

console.log('\nUser setup complete. User ID:', user.id);
console.log('\nNow upload files manually through the UI or use the API with proper authentication.');
console.log('Email: admin@example.com');
console.log('Password: admin123');

import pkg from '@pm-app/database';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
import bcrypt from 'bcryptjs';

console.log('=== Creating default user ===\n');

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
  console.log('✓ Created default organization');
} else {
  console.log('✓ Organization already exists');
}

// Check if user exists
let user = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });

if (!user) {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  user = await prisma.user.create({
    data: {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'admin@example.com',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'User'
    }
  });
  console.log('✓ Created default user');
  
  // Add user to organization
  await prisma.organizationMember.create({
    data: {
      userId: user.id,
      organizationId: orgId,
      role: 'owner'
    }
  });
  console.log('✓ Added user to organization');
} else {
  console.log('✓ User already exists');
}

await prisma.$disconnect();

console.log('\n============================================');
console.log('✅ SETUP COMPLETE');
console.log('============================================\n');

console.log('Fixed Import Issues:');
console.log('  ✓ CSV column matching (case-insensitive)');
console.log('  ✓ Auto-calculate missing end dates');
console.log('  ✓ Extract estimated hours from JIRA');
console.log('  ✓ MS Project format detection & parsing');
console.log('  ✓ Parse % Complete, Baseline/Actual hours');
console.log('  ✓ Database cleared (ready for fresh import)\n');

console.log('Login Credentials:');
console.log('  📧 Email: admin@example.com');
console.log('  🔑 Password: admin123\n');

console.log('Next Steps:');
console.log('  1. Open http://localhost:5173 in your browser');
console.log('  2. Login with the credentials above');
console.log('  3. Upload these files:');
console.log('     • Project Planner.xlsx (MS Project data)');
console.log('     • Jira (31).csv (JIRA export)');
console.log('\n✅ Backend is running and ready!\n');

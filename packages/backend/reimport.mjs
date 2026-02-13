import pkg from '@pm-app/database';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
import { readFileSync } from 'fs';

console.log('=== Step 1: Clearing database ===');

const deletedTasks = await prisma.task.deleteMany({});
console.log('Deleted tasks:', deletedTasks.count);

const deletedProjects = await prisma.project.deleteMany({});
console.log('Deleted projects:', deletedProjects.count);

console.log('\n=== Step 2: Verifying data cleared ===');
const taskCount = await prisma.task.count();
const projectCount = await prisma.project.count();
console.log('Tasks remaining:', taskCount);
console.log('Projects remaining:', projectCount);

await prisma.$disconnect();
console.log('\nDatabase cleared successfully!');
console.log('\nPlease re-upload the files through the web interface to import with the new logic.');

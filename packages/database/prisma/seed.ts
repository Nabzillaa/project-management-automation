import { PrismaClient } from '../node_modules/.prisma/client/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.costEntry.deleteMany();
  await prisma.resourceAllocation.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Create Organization
  console.log('🏢 Creating organization...');
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
    },
  });

  // Create Users
  console.log('👥 Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      passwordHash: hashedPassword,
      firstName: 'John',
      lastName: 'Admin',
      role: 'admin',
    },
  });

  const pmUser = await prisma.user.create({
    data: {
      email: 'pm@acme.com',
      passwordHash: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Manager',
      role: 'manager',
    },
  });

  const devUser1 = await prisma.user.create({
    data: {
      email: 'dev1@acme.com',
      passwordHash: hashedPassword,
      firstName: 'Alex',
      lastName: 'Developer',
      role: 'member',
    },
  });

  const devUser2 = await prisma.user.create({
    data: {
      email: 'dev2@acme.com',
      passwordHash: hashedPassword,
      firstName: 'Maria',
      lastName: 'Engineer',
      role: 'member',
    },
  });

  // Add users to organization
  await prisma.organizationMember.createMany({
    data: [
      { organizationId: org.id, userId: adminUser.id, role: 'admin' },
      { organizationId: org.id, userId: pmUser.id, role: 'manager' },
      { organizationId: org.id, userId: devUser1.id, role: 'member' },
      { organizationId: org.id, userId: devUser2.id, role: 'member' },
    ],
  });

  // Create Resources
  console.log('🔧 Creating resources...');
  const seniorDev = await prisma.resource.create({
    data: {
      organizationId: org.id,
      name: 'Senior Developer',
      type: 'person',
      costPerHour: 150,
      availabilityHoursPerDay: 8,
    },
  });

  const juniorDev = await prisma.resource.create({
    data: {
      organizationId: org.id,
      name: 'Junior Developer',
      type: 'person',
      costPerHour: 75,
      availabilityHoursPerDay: 8,
    },
  });

  const designer = await prisma.resource.create({
    data: {
      organizationId: org.id,
      name: 'UI/UX Designer',
      type: 'person',
      costPerHour: 100,
      availabilityHoursPerDay: 6.4, // 80% availability
    },
  });

  const qaEngineer = await prisma.resource.create({
    data: {
      organizationId: org.id,
      name: 'QA Engineer',
      type: 'person',
      costPerHour: 90,
      availabilityHoursPerDay: 8,
    },
  });

  const cloudServer = await prisma.resource.create({
    data: {
      organizationId: org.id,
      name: 'AWS Cloud Infrastructure',
      type: 'equipment',
      costPerHour: 50,
      availabilityHoursPerDay: 24,
    },
  });

  // PROJECT 1: E-Commerce Platform (Active, On Track - 50% budget used)
  console.log('📦 Creating Project 1: E-Commerce Platform...');
  const project1 = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'E-Commerce Platform Redesign',
      description: 'Complete overhaul of the customer-facing e-commerce platform',
      status: 'active',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-30'),
      budget: 250000,
      actualCost: 125000,
      createdBy: adminUser.id,
    },
  });

  // Project 1 Tasks
  const p1t1 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'Requirements Gathering',
      description: 'Collect and document all requirements',
      status: 'completed',
      priority: 'high',
      taskType: 'task',
      assignedTo: pmUser.id,
      createdBy: adminUser.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-14'),
      estimatedHours: 80,
      actualHours: 75,
      optimisticHours: 60,
      mostLikelyHours: 80,
      pessimisticHours: 100,
      isCriticalPath: true,
    },
  });

  const p1t2 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'UI/UX Design',
      description: 'Create wireframes and high-fidelity mockups',
      status: 'completed',
      priority: 'high',
      taskType: 'task',
      assignedTo: devUser1.id,
      createdBy: pmUser.id,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-02-15'),
      estimatedHours: 160,
      actualHours: 170,
      isCriticalPath: true,
    },
  });

  const p1t3 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'Frontend Development',
      description: 'Implement React components',
      status: 'in_progress',
      priority: 'high',
      taskType: 'task',
      assignedTo: devUser1.id,
      createdBy: pmUser.id,
      startDate: new Date('2026-02-16'),
      endDate: new Date('2026-04-30'),
      estimatedHours: 400,
      actualHours: 280,
      isCriticalPath: true,
    },
  });

  const p1t4 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'Backend API Development',
      description: 'Build RESTful APIs',
      status: 'in_progress',
      priority: 'high',
      taskType: 'task',
      assignedTo: devUser2.id,
      createdBy: pmUser.id,
      startDate: new Date('2026-02-16'),
      endDate: new Date('2026-05-15'),
      estimatedHours: 480,
      actualHours: 320,
      isCriticalPath: true,
    },
  });

  const p1t5 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'Payment Gateway Integration',
      description: 'Integrate Stripe',
      status: 'todo',
      priority: 'high',
      taskType: 'task',
      assignedTo: devUser2.id,
      createdBy: pmUser.id,
      startDate: new Date('2026-05-16'),
      endDate: new Date('2026-05-30'),
      estimatedHours: 80,
      isCriticalPath: true,
    },
  });

  const p1t6 = await prisma.task.create({
    data: {
      projectId: project1.id,
      title: 'QA Testing',
      description: 'Comprehensive testing',
      status: 'todo',
      priority: 'high',
      taskType: 'task',
      createdBy: pmUser.id,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-20'),
      estimatedHours: 120,
      isCriticalPath: true,
    },
  });

  // Task Dependencies
  await prisma.taskDependency.createMany({
    data: [
      { predecessorTaskId: p1t1.id, successorTaskId: p1t2.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p1t2.id, successorTaskId: p1t3.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p1t2.id, successorTaskId: p1t4.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p1t4.id, successorTaskId: p1t5.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p1t3.id, successorTaskId: p1t6.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p1t5.id, successorTaskId: p1t6.id, dependencyType: 'finish_to_start' },
    ],
  });

  // Project 1 Resource Allocations
  await prisma.resourceAllocation.createMany({
    data: [
      {
        resourceId: designer.id,
        taskId: p1t2.id,
        projectId: project1.id,
        allocatedHours: 160,
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-02-15'),
      },
      {
        resourceId: seniorDev.id,
        taskId: p1t3.id,
        projectId: project1.id,
        allocatedHours: 400,
        startDate: new Date('2026-02-16'),
        endDate: new Date('2026-04-30'),
      },
      {
        resourceId: juniorDev.id,
        taskId: p1t3.id,
        projectId: project1.id,
        allocatedHours: 200,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-04-30'),
      },
      {
        resourceId: seniorDev.id,
        taskId: p1t4.id,
        projectId: project1.id,
        allocatedHours: 480,
        startDate: new Date('2026-02-16'),
        endDate: new Date('2026-05-15'),
      },
      {
        resourceId: seniorDev.id,
        taskId: p1t5.id,
        projectId: project1.id,
        allocatedHours: 80,
        startDate: new Date('2026-05-16'),
        endDate: new Date('2026-05-30'),
      },
      {
        resourceId: qaEngineer.id,
        taskId: p1t6.id,
        projectId: project1.id,
        allocatedHours: 120,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-20'),
      },
      {
        resourceId: cloudServer.id,
        taskId: p1t4.id,
        projectId: project1.id,
        allocatedHours: 2000,
        startDate: new Date('2026-02-16'),
        endDate: new Date('2026-06-30'),
      },
    ],
  });

  // Cost Entries for Project 1
  await prisma.costEntry.createMany({
    data: [
      {
        projectId: project1.id,
        category: 'labor',
        amount: 80000,
        description: 'Development team salaries Q1',
        entryDate: new Date('2026-01-31'),
        createdBy: pmUser.id,
      },
      {
        projectId: project1.id,
        category: 'labor',
        amount: 35000,
        description: 'UI/UX design work',
        entryDate: new Date('2026-02-15'),
        createdBy: pmUser.id,
      },
      {
        projectId: project1.id,
        category: 'software',
        amount: 5000,
        description: 'Design tools and licenses',
        entryDate: new Date('2026-01-15'),
        createdBy: pmUser.id,
      },
      {
        projectId: project1.id,
        category: 'equipment',
        amount: 3000,
        description: 'AWS hosting costs',
        entryDate: new Date('2026-02-01'),
        createdBy: pmUser.id,
      },
      {
        projectId: project1.id,
        category: 'materials',
        amount: 2000,
        description: 'Stock photography',
        entryDate: new Date('2026-02-10'),
        createdBy: pmUser.id,
      },
    ],
  });

  // PROJECT 2: Mobile App (Budget Warning - 92%)
  console.log('📱 Creating Project 2: Mobile App...');
  const project2 = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Mobile App Development',
      description: 'iOS and Android mobile app',
      status: 'active',
      startDate: new Date('2025-11-01'),
      endDate: new Date('2026-03-31'),
      budget: 180000,
      actualCost: 165600,
      createdBy: pmUser.id,
    },
  });

  // Project 2 Tasks
  const p2t1 = await prisma.task.create({
    data: {
      projectId: project2.id,
      title: 'Mobile App Architecture',
      description: 'Design system architecture',
      status: 'completed',
      priority: 'high',
      taskType: 'task',
      assignedTo: devUser2.id,
      createdBy: pmUser.id,
      startDate: new Date('2025-11-01'),
      endDate: new Date('2025-11-15'),
      estimatedHours: 60,
      actualHours: 55,
      isCriticalPath: true,
    },
  });

  const p2t2 = await prisma.task.create({
    data: {
      projectId: project2.id,
      title: 'iOS Development',
      description: 'Build native iOS application',
      status: 'in_progress',
      priority: 'high',
      taskType: 'task',
      assignedTo: devUser1.id,
      createdBy: pmUser.id,
      startDate: new Date('2025-11-16'),
      endDate: new Date('2026-02-28'),
      estimatedHours: 400,
      actualHours: 280,
      isCriticalPath: true,
    },
  });

  const p2t3 = await prisma.task.create({
    data: {
      projectId: project2.id,
      title: 'Android Development',
      description: 'Build native Android application',
      status: 'in_progress',
      priority: 'high',
      taskType: 'task',
      assignedTo: devUser2.id,
      createdBy: pmUser.id,
      startDate: new Date('2025-11-16'),
      endDate: new Date('2026-02-28'),
      estimatedHours: 400,
      actualHours: 250,
      isCriticalPath: true,
    },
  });

  const p2t4 = await prisma.task.create({
    data: {
      projectId: project2.id,
      title: 'Mobile Testing',
      description: 'Test on various devices',
      status: 'todo',
      priority: 'high',
      taskType: 'task',
      createdBy: pmUser.id,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-20'),
      estimatedHours: 80,
      isCriticalPath: true,
    },
  });

  const p2t5 = await prisma.task.create({
    data: {
      projectId: project2.id,
      title: 'App Store Submission',
      description: 'Submit to stores',
      status: 'todo',
      priority: 'high',
      taskType: 'milestone',
      assignedTo: pmUser.id,
      createdBy: pmUser.id,
      startDate: new Date('2026-03-21'),
      endDate: new Date('2026-03-31'),
      estimatedHours: 20,
      isCriticalPath: true,
    },
  });

  // Project 2 Dependencies
  await prisma.taskDependency.createMany({
    data: [
      { predecessorTaskId: p2t1.id, successorTaskId: p2t2.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p2t1.id, successorTaskId: p2t3.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p2t2.id, successorTaskId: p2t4.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p2t3.id, successorTaskId: p2t4.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p2t4.id, successorTaskId: p2t5.id, dependencyType: 'finish_to_start' },
    ],
  });

  // Project 2 Resource Allocations
  await prisma.resourceAllocation.createMany({
    data: [
      {
        resourceId: seniorDev.id,
        taskId: p2t2.id,
        projectId: project2.id,
        allocatedHours: 400,
        startDate: new Date('2025-11-16'),
        endDate: new Date('2026-02-28'),
      },
      {
        resourceId: seniorDev.id,
        taskId: p2t3.id,
        projectId: project2.id,
        allocatedHours: 400,
        startDate: new Date('2025-11-16'),
        endDate: new Date('2026-02-28'),
      },
      {
        resourceId: qaEngineer.id,
        taskId: p2t4.id,
        projectId: project2.id,
        allocatedHours: 80,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-20'),
      },
    ],
  });

  await prisma.costEntry.createMany({
    data: [
      { projectId: project2.id, category: 'labor', amount: 120000, description: 'Mobile dev team', entryDate: new Date('2025-12-31'), createdBy: pmUser.id },
      { projectId: project2.id, category: 'software', amount: 25000, description: 'Apple Developer Program', entryDate: new Date('2026-01-15'), createdBy: pmUser.id },
      { projectId: project2.id, category: 'materials', amount: 15000, description: 'Third-party SDKs', entryDate: new Date('2026-01-20'), createdBy: pmUser.id },
      { projectId: project2.id, category: 'overhead', amount: 5600, description: 'Testing devices', entryDate: new Date('2026-02-01'), createdBy: pmUser.id },
    ],
  });

  // PROJECT 3: Analytics Dashboard (Over Budget - 105%)
  console.log('📊 Creating Project 3: Analytics Dashboard...');
  const project3 = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Real-Time Analytics Dashboard',
      description: 'Business intelligence dashboard',
      status: 'active',
      startDate: new Date('2025-10-01'),
      endDate: new Date('2026-02-28'),
      budget: 120000,
      actualCost: 126000,
      createdBy: adminUser.id,
    },
  });

  // Project 3 Tasks
  const p3t1 = await prisma.task.create({
    data: {
      projectId: project3.id,
      title: 'Data Pipeline Setup',
      description: 'Build ETL pipeline',
      status: 'completed',
      priority: 'high',
      taskType: 'task',
      assignedTo: devUser2.id,
      createdBy: adminUser.id,
      startDate: new Date('2025-10-01'),
      endDate: new Date('2025-11-15'),
      estimatedHours: 200,
      actualHours: 220,
      isCriticalPath: true,
    },
  });

  const p3t2 = await prisma.task.create({
    data: {
      projectId: project3.id,
      title: 'Dashboard UI Development',
      description: 'Build interactive charts',
      status: 'completed',
      priority: 'high',
      taskType: 'task',
      assignedTo: devUser1.id,
      createdBy: adminUser.id,
      startDate: new Date('2025-11-16'),
      endDate: new Date('2026-01-15'),
      estimatedHours: 240,
      actualHours: 260,
      isCriticalPath: true,
    },
  });

  const p3t3 = await prisma.task.create({
    data: {
      projectId: project3.id,
      title: 'Real-time Data Integration',
      description: 'Implement WebSocket updates',
      status: 'completed',
      priority: 'high',
      taskType: 'task',
      assignedTo: devUser2.id,
      createdBy: adminUser.id,
      startDate: new Date('2026-01-16'),
      endDate: new Date('2026-02-10'),
      estimatedHours: 120,
      actualHours: 145,
      isCriticalPath: true,
    },
  });

  const p3t4 = await prisma.task.create({
    data: {
      projectId: project3.id,
      title: 'Performance Optimization',
      description: 'Optimize queries and caching',
      status: 'in_progress',
      priority: 'high',
      taskType: 'task',
      assignedTo: devUser2.id,
      createdBy: adminUser.id,
      startDate: new Date('2026-02-11'),
      endDate: new Date('2026-02-25'),
      estimatedHours: 80,
      actualHours: 45,
      isCriticalPath: true,
    },
  });

  const p3t5 = await prisma.task.create({
    data: {
      projectId: project3.id,
      title: 'User Training & Documentation',
      description: 'Create docs and train users',
      status: 'todo',
      priority: 'medium',
      taskType: 'task',
      assignedTo: pmUser.id,
      createdBy: adminUser.id,
      startDate: new Date('2026-02-26'),
      endDate: new Date('2026-02-28'),
      estimatedHours: 20,
      isCriticalPath: false,
    },
  });

  // Project 3 Dependencies
  await prisma.taskDependency.createMany({
    data: [
      { predecessorTaskId: p3t1.id, successorTaskId: p3t2.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p3t2.id, successorTaskId: p3t3.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p3t3.id, successorTaskId: p3t4.id, dependencyType: 'finish_to_start' },
      { predecessorTaskId: p3t4.id, successorTaskId: p3t5.id, dependencyType: 'finish_to_start' },
    ],
  });

  // Project 3 Resource Allocations
  await prisma.resourceAllocation.createMany({
    data: [
      {
        resourceId: seniorDev.id,
        taskId: p3t1.id,
        projectId: project3.id,
        allocatedHours: 200,
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-11-15'),
      },
      {
        resourceId: juniorDev.id,
        taskId: p3t2.id,
        projectId: project3.id,
        allocatedHours: 240,
        startDate: new Date('2025-11-16'),
        endDate: new Date('2026-01-15'),
      },
      {
        resourceId: seniorDev.id,
        taskId: p3t3.id,
        projectId: project3.id,
        allocatedHours: 120,
        startDate: new Date('2026-01-16'),
        endDate: new Date('2026-02-10'),
      },
      {
        resourceId: cloudServer.id,
        taskId: p3t1.id,
        projectId: project3.id,
        allocatedHours: 1000,
        startDate: new Date('2025-10-01'),
        endDate: new Date('2026-02-28'),
      },
    ],
  });

  await prisma.costEntry.createMany({
    data: [
      { projectId: project3.id, category: 'labor', amount: 95000, description: 'Development team', entryDate: new Date('2025-12-31'), createdBy: adminUser.id },
      { projectId: project3.id, category: 'equipment', amount: 18000, description: 'Database infrastructure', entryDate: new Date('2026-01-10'), createdBy: adminUser.id },
      { projectId: project3.id, category: 'software', amount: 8000, description: 'Analytics tools', entryDate: new Date('2025-11-15'), createdBy: adminUser.id },
      { projectId: project3.id, category: 'overhead', amount: 5000, description: 'Additional QA', entryDate: new Date('2026-01-25'), createdBy: adminUser.id },
    ],
  });

  // Notifications
  console.log('🔔 Creating notifications...');
  await prisma.notification.createMany({
    data: [
      {
        userId: pmUser.id,
        type: 'warning',
        title: 'Budget Alert: Mobile App',
        message: 'Project is at 92% of budget',
        linkUrl: `/projects/${project2.id}`,
        isRead: false,
      },
      {
        userId: adminUser.id,
        type: 'error',
        title: 'Budget Exceeded: Analytics',
        message: 'Project exceeded budget by $6,000',
        linkUrl: `/projects/${project3.id}`,
        isRead: false,
      },
    ],
  });

  const taskCount = await prisma.task.count();
  const costCount = await prisma.costEntry.count();

  console.log('✅ Database seeded successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Organizations: 1`);
  console.log(`   - Users: 4`);
  console.log(`   - Projects: 3`);
  console.log(`   - Tasks: ${taskCount}`);
  console.log(`   - Resources: 5`);
  console.log(`   - Cost Entries: ${costCount}`);
  console.log('\n🔑 Login:');
  console.log('   Email: admin@acme.com');
  console.log('   Password: password123');
  console.log('\n💡 Budget Status:');
  console.log('   ✅ E-Commerce: 50% ($125k/$250k)');
  console.log('   ⚠️  Mobile App: 92% ($165.6k/$180k)');
  console.log('   🚨 Analytics: 105% ($126k/$120k)');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

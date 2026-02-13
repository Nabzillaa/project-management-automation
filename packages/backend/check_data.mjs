import pkg from '@pm-app/database';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function checkData() {
  const projects = await prisma.project.findMany({
    include: {
      _count: {
        select: {
          tasks: true
        }
      }
    }
  });
  
  console.log('\n=== PROJECTS ===');
  console.log('Total projects:', projects.length);
  projects.forEach(p => {
    console.log('Project:', p.name);
    console.log('  Tasks:', p._count.tasks);
    console.log('  Status:', p.status);
    console.log('  Priority:', p.priority);
    console.log('');
  });
  
  const totalTasks = await prisma.task.count();
  console.log('Total tasks in database:', totalTasks);
  
  const tasks = await prisma.task.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      taskType: true,
      startDate: true,
      endDate: true,
      jiraIssueKey: true,
      project: {
        select: {
          name: true
        }
      }
    },
    take: 15
  });
  
  console.log('\n=== SAMPLE TASKS (first 15) ===');
  tasks.forEach((t, idx) => {
    console.log('\nTask', idx + 1);
    console.log('  Key:', t.jiraIssueKey || 'NO KEY');
    console.log('  Title:', t.title);
    console.log('  Project:', t.project.name);
    console.log('  Status:', t.status);
    console.log('  Priority:', t.priority);
    console.log('  Type:', t.taskType);
    console.log('  Start:', t.startDate);
    console.log('  End:', t.endDate);
  });
  
  await prisma.$disconnect();
}

checkData().catch(console.error);

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting authentication and role seeding...');

  // 1. Seed Roles
  const adminPermissions = {
    dashboard: 'read',
    leads: 'write',
    customers: 'write',
    queue: 'write',
    reports: 'read',
    settings: 'write',
    users: 'write',
    roles: 'write'
  };

  const csPermissions = {
    dashboard: 'read',
    leads: 'write',
    customers: 'read',
    queue: 'none',
    reports: 'read',
    settings: 'none',
    users: 'none',
    roles: 'none'
  };

  let adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: 'ADMIN',
        permissions: adminPermissions
      }
    });
    console.log('Created Role: ADMIN');
  } else {
    adminRole = await prisma.role.update({
      where: { name: 'ADMIN' },
      data: { permissions: adminPermissions }
    });
    console.log('Updated Role: ADMIN permissions');
  }

  let csRole = await prisma.role.findUnique({ where: { name: 'CS' } });
  if (!csRole) {
    csRole = await prisma.role.create({
      data: {
        name: 'CS',
        permissions: csPermissions
      }
    });
    console.log('Created Role: CS');
  } else {
    csRole = await prisma.role.update({
      where: { name: 'CS' },
      data: { permissions: csPermissions }
    });
    console.log('Updated Role: CS permissions');
  }

  // 2. Seed Default Admin User
  const defaultAdminUsername = 'admin';
  const defaultAdminPasswordHash = await bcrypt.hash('adminpbwi', 10);

  const existingAdminUser = await prisma.admin.findUnique({
    where: { username: defaultAdminUsername }
  });

  if (!existingAdminUser) {
    await prisma.admin.create({
      data: {
        nama_admin: 'System Administrator',
        nomor_wa: null,
        username: defaultAdminUsername,
        password: defaultAdminPasswordHash,
        role_id: adminRole.id,
        is_active: true
      }
    });
    console.log('Created default Super Admin user ("admin" / "adminpbwi")');
  } else {
    await prisma.admin.update({
      where: { username: defaultAdminUsername },
      data: {
        role_id: adminRole.id,
        password: defaultAdminPasswordHash
      }
    });
    console.log('Updated default Super Admin credentials');
  }

  // 3. Link Existing Admins to CS Role and Set Default Credentials
  const allAdmins = await prisma.admin.findMany();
  const defaultCsPasswordHash = await bcrypt.hash('pbwi123', 10);

  for (const admin of allAdmins) {
    if (admin.username === 'admin') continue; // Skip default admin

    const updates = {};
    
    // Assign role_id = csRole.id if not already set or if it defaults to 1 (when adminRole.id is not 1)
    if (!admin.role_id || admin.role_id === adminRole.id) {
      updates.role_id = csRole.id;
    }

    // Set fallback username to WA number if not set
    if (!admin.username) {
      if (admin.nomor_wa) {
        updates.username = admin.nomor_wa;
      } else {
        updates.username = `cs_${admin.id}`;
      }
    }

    // Set fallback password to pbwi123 if not set
    if (!admin.password) {
      updates.password = defaultCsPasswordHash;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: updates
      });
      console.log(`Updated existing Admin ID ${admin.id} (${admin.nama_admin}) with default credentials.`);
    }
  }

  console.log('Authentication and role seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcrypt';
import fs from 'fs';

// Load environment variables from both .env and .env.poc-users
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.poc-users') });

// Import models
import { User } from '../src/models/User';
import { SessionLog } from '../src/models/SessionLog';

// Load users from environment variables
const ADMIN_USERS = [
  {
    email: process.env.ADMIN_USER_1_EMAIL!,
    password: process.env.ADMIN_USER_1_PASSWORD!,
    name: process.env.ADMIN_USER_1_NAME!,
    role: 'admin' as const
  },
  {
    email: process.env.ADMIN_USER_2_EMAIL!,
    password: process.env.ADMIN_USER_2_PASSWORD!,
    name: process.env.ADMIN_USER_2_NAME!,
    role: 'admin' as const
  }
];

const REGULAR_USERS = [
  {
    email: process.env.USER_1_EMAIL!,
    password: process.env.USER_1_PASSWORD!,
    name: process.env.USER_1_NAME!,
    role: 'user' as const
  },
  {
    email: process.env.USER_2_EMAIL!,
    password: process.env.USER_2_PASSWORD!,
    name: process.env.USER_2_NAME!,
    role: 'user' as const
  },
  {
    email: process.env.USER_3_EMAIL!,
    password: process.env.USER_3_PASSWORD!,
    name: process.env.USER_3_NAME!,
    role: 'user' as const
  },
  {
    email: process.env.USER_4_EMAIL!,
    password: process.env.USER_4_PASSWORD!,
    name: process.env.USER_4_NAME!,
    role: 'user' as const
  },
  {
    email: process.env.USER_5_EMAIL!,
    password: process.env.USER_5_PASSWORD!,
    name: process.env.USER_5_NAME!,
    role: 'user' as const
  },
  {
    email: process.env.USER_6_EMAIL!,
    password: process.env.USER_6_PASSWORD!,
    name: process.env.USER_6_NAME!,
    role: 'user' as const
  },
  {
    email: process.env.USER_7_EMAIL!,
    password: process.env.USER_7_PASSWORD!,
    name: process.env.USER_7_NAME!,
    role: 'user' as const
  },
  {
    email: process.env.USER_8_EMAIL!,
    password: process.env.USER_8_PASSWORD!,
    name: process.env.USER_8_NAME!,
    role: 'user' as const
  }
];

const ALL_USERS = [...ADMIN_USERS, ...REGULAR_USERS];

async function resetAndSeed() {
  try {
    console.log('🚀 Starting POC Reset and Seed...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Clear all session logs
    console.log('🗑️  Clearing all session logs...');
    const logsDeleted = await SessionLog.deleteMany({});
    console.log(`✅ Deleted ${logsDeleted.deletedCount} session logs\n`);

    // Step 2: Clear all existing users
    console.log('🗑️  Clearing all existing users...');
    const usersDeleted = await User.deleteMany({});
    console.log(`✅ Deleted ${usersDeleted.deletedCount} users\n`);

    // Step 3: Create new users
    console.log('👥 Creating POC users...');

    for (const userData of ALL_USERS) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const user = await User.create({
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        name: userData.name,
        role: userData.role,
        company: 'Colony Hardware',
        isActive: true
      });

      const roleLabel = userData.role === 'admin' ? '👑 ADMIN' : '👤 USER';
      console.log(`  ${roleLabel}: ${userData.name} (${userData.email})`);
    }

    console.log(`\n✅ Created ${ALL_USERS.length} users (${ADMIN_USERS.length} admins, ${REGULAR_USERS.length} regular users)\n`);

    // Summary
    console.log('📊 Summary:');
    console.log('  ✅ Session logs cleared');
    console.log('  ✅ Users reset');
    console.log(`  ✅ ${ADMIN_USERS.length} admin users created`);
    console.log(`  ✅ ${REGULAR_USERS.length} regular users created`);
    console.log('\n🎉 POC Reset Complete!\n');

    console.log('📋 Admin Users:');
    ADMIN_USERS.forEach(u => {
      console.log(`  - ${u.email} / ${u.password}`);
    });

    console.log('\n📋 Regular Users:');
    REGULAR_USERS.forEach(u => {
      console.log(`  - ${u.email} / ${u.password}`);
    });

    console.log('\n🔗 Frontend URL: https://your-frontend.onrender.com');
    console.log('🔗 Backend URL: https://your-backend.onrender.com\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
resetAndSeed();

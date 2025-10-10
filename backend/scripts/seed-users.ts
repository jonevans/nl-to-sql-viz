/**
 * Seed Users Script
 * Creates initial users for Colony Hardware system
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import User model
import { User } from '../src/models/User';

interface UserData {
  email: string;
  name: string;
  role: 'admin' | 'user';
  password: string;
  company: string;
}

const SALT_ROUNDS = 12;

// IMPORTANT: This file should NOT be committed with actual passwords!
// Load passwords from environment variables or a secure config file.
// For production, users should be created through admin interface with secure password generation.

const users: UserData[] = [
  {
    email: 'admin@example.com',
    name: 'System Administrator',
    role: 'admin',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
    company: 'Your Company'
  },
  {
    email: 'user@example.com',
    name: 'Example User',
    role: 'user',
    password: process.env.USER_PASSWORD || 'ChangeMe123!',
    company: 'Your Company'
  }
  // Add more users as needed
];

async function seedUsers() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/colony-hardware-viz';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Clear existing users (optional - comment out if you want to keep existing users)
    await User.deleteMany({});
    console.log('🗑️  Cleared existing users');

    // Create users
    let createdCount = 0;
    for (const userData of users) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email.toLowerCase() });
      if (existingUser) {
        console.log(`⚠️  User already exists: ${userData.email}`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);

      // Create user
      await User.create({
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        name: userData.name,
        role: userData.role,
        company: userData.company,
        isActive: true
      });

      console.log(`✅ Created ${userData.role}: ${userData.email}`);
      createdCount++;
    }

    console.log(`\n🎉 Successfully created ${createdCount} users!`);
    console.log('\n📋 USER CREDENTIALS:');
    console.log('=' .repeat(80));

    users.forEach(user => {
      console.log(`\nEmail: ${user.email}`);
      console.log(`Password: ${user.password}`);
      console.log(`Role: ${user.role.toUpperCase()}`);
      console.log('-'.repeat(80));
    });

    console.log('\n⚠️  IMPORTANT: Save these credentials securely!');
    console.log('💡 Users should change their passwords after first login.\n');

  } catch (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the seeding script
seedUsers()
  .then(() => {
    console.log('✅ User seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ User seeding failed:', error);
    process.exit(1);
  });

# Database Seeding Scripts

## ⚠️ SECURITY WARNING

**NEVER commit actual passwords to git!**

This directory contains database seeding scripts. All passwords should be:
- Stored in environment variables
- Loaded from a secure config file (not committed)
- Generated securely for production use

## Usage

### Seed Users

```bash
# Set passwords via environment variables
export ADMIN_PASSWORD="your-secure-admin-password"
export USER_PASSWORD="your-secure-user-password"

# Run the seed script
npm run seed-users
```

### Production Deployment

For production environments:
1. Create users through the admin interface
2. Use strong, randomly generated passwords
3. Force password change on first login
4. Never use seed scripts with hardcoded credentials

## Files to Keep Private

- `user-credentials.txt` - Should NEVER be committed (already in .gitignore)
- Any files containing actual passwords or API keys
- Database connection strings with embedded credentials

## Best Practices

1. Use environment variables for all sensitive data
2. Rotate passwords regularly
3. Use different passwords for each environment (dev/staging/prod)
4. Enable 2FA for admin accounts when available

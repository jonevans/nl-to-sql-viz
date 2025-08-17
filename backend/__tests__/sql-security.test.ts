import { SQLSecurityService } from '../src/services/sqlSecurityService';

describe('SQL Security Service', () => {
  let securityService: SQLSecurityService;

  beforeAll(() => {
    securityService = SQLSecurityService.getInstance();
  });

  describe('Basic SQL Validation', () => {
    test('should allow valid SELECT queries', async () => {
      const validSQL = "SELECT id, name, email FROM users WHERE status = 'active'";
      const result = await securityService.validateAndSanitizeSQL(validSQL);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedSQL).toBeTruthy();
      expect(result.errors).toHaveLength(0);
    });

    test('should block non-SELECT statements', async () => {
      const invalidSQL = "UPDATE users SET password = 'hacked'";
      const result = await securityService.validateAndSanitizeSQL(invalidSQL);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should block dangerous keywords', async () => {
      const dangerousSQL = "SELECT * FROM users; DROP TABLE users;";
      const result = await securityService.validateAndSanitizeSQL(dangerousSQL);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringMatching(/dangerous/i));
    });

    test('should block SQL comments', async () => {
      const commentSQL = "SELECT * FROM users -- malicious comment";
      const result = await securityService.validateAndSanitizeSQL(commentSQL);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringMatching(/comment/i));
    });
  });

  describe('Table Access Control', () => {
    test('should allow access to whitelisted tables', async () => {
      const validSQL = "SELECT * FROM users";
      const result = await securityService.validateAndSanitizeSQL(validSQL);
      
      expect(result.isValid).toBe(true);
    });

    test('should block access to non-whitelisted tables', async () => {
      const invalidSQL = "SELECT * FROM secret_admin_table";
      const result = await securityService.validateAndSanitizeSQL(invalidSQL);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringMatching(/secret_admin_table.*not allowed/i));
    });
  });

  describe('Query Complexity', () => {
    test('should calculate complexity for simple queries', async () => {
      const simpleSQL = "SELECT id FROM users";
      const result = await securityService.validateAndSanitizeSQL(simpleSQL);
      
      expect(result.isValid).toBe(true);
      expect(result.complexity).toBeGreaterThan(0);
      expect(result.complexity).toBeLessThan(10);
    });

    test('should detect high complexity queries', async () => {
      const complexSQL = `
        SELECT u.id, o.total 
        FROM users u 
        JOIN orders o ON u.id = o.user_id 
        WHERE u.status = 'active' 
        AND o.total > 100
      `;
      const result = await securityService.validateAndSanitizeSQL(complexSQL);
      
      if (result.isValid) {
        expect(result.complexity).toBeGreaterThan(5);
      }
    });
  });

  describe('Configuration Management', () => {
    test('should return current configuration', () => {
      const config = securityService.getConfig();
      
      expect(config.allowedTables).toBeInstanceOf(Array);
      expect(config.allowedTables.length).toBeGreaterThan(0);
      expect(config.maxQueryComplexity).toBeGreaterThan(0);
    });

    test('should allow configuration updates', () => {
      const originalConfig = securityService.getConfig();
      const newMaxComplexity = 200;
      
      securityService.updateConfig({ maxQueryComplexity: newMaxComplexity });
      const updatedConfig = securityService.getConfig();
      
      expect(updatedConfig.maxQueryComplexity).toBe(newMaxComplexity);
      
      // Restore original config
      securityService.updateConfig({ maxQueryComplexity: originalConfig.maxQueryComplexity });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid SQL gracefully', async () => {
      const invalidSQL = "INVALID SQL SYNTAX HERE";
      const result = await securityService.validateAndSanitizeSQL(invalidSQL);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle empty strings', async () => {
      const result = await securityService.validateAndSanitizeSQL("");
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringMatching(/must start with select/i));
    });

    test('should handle very long queries', async () => {
      const longSQL = "SELECT id FROM users WHERE " + "name = 'test' AND ".repeat(1000) + "1=1";
      const result = await securityService.validateAndSanitizeSQL(longSQL);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringMatching(/too long/i));
    });
  });
});
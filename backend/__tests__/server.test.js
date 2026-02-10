const request = require('supertest');
const { app, isValidProjectId, sanitizeGrep } = require('../server');

describe('Security Functions', () => {
  describe('isValidProjectId', () => {
    test('accepts valid project IDs', () => {
      expect(isValidProjectId('rental')).toBe(true);
      expect(isValidProjectId('crossfit-repo')).toBe(true);
      expect(isValidProjectId('ical_adjuster')).toBe(true);
      expect(isValidProjectId('project123')).toBe(true);
    });

    test('rejects invalid project IDs with path traversal', () => {
      expect(isValidProjectId('../etc/passwd')).toBe(false);
      expect(isValidProjectId('../../root')).toBe(false);
      expect(isValidProjectId('project/../secret')).toBe(false);
    });

    test('rejects project IDs with special characters', () => {
      expect(isValidProjectId('project;rm -rf')).toBe(false);
      expect(isValidProjectId('project|cat /etc/passwd')).toBe(false);
      expect(isValidProjectId('project$(whoami)')).toBe(false);
      expect(isValidProjectId('project`id`')).toBe(false);
    });

    test('rejects empty or null project IDs', () => {
      expect(isValidProjectId('')).toBe(false);
      expect(isValidProjectId(null)).toBe(false);
      expect(isValidProjectId(undefined)).toBe(false);
    });
  });

  describe('sanitizeGrep', () => {
    test('returns null for empty input', () => {
      expect(sanitizeGrep('')).toBe(null);
      expect(sanitizeGrep(null)).toBe(null);
      expect(sanitizeGrep(undefined)).toBe(null);
    });

    test('preserves valid grep patterns', () => {
      expect(sanitizeGrep('smoke')).toBe('smoke');
      expect(sanitizeGrep('@api')).toBe('@api');
      expect(sanitizeGrep('test-name')).toBe('test-name');
      expect(sanitizeGrep('test_name')).toBe('test_name');
      expect(sanitizeGrep('my test')).toBe('my test');
    });

    test('removes dangerous shell characters', () => {
      expect(sanitizeGrep('test;rm -rf /')).toBe('testrm -rf ');
      expect(sanitizeGrep('test|cat /etc/passwd')).toBe('testcat etcpasswd');
      expect(sanitizeGrep('test$(whoami)')).toBe('testwhoami');
      expect(sanitizeGrep('test`id`')).toBe('testid');
    });

    test('rejects strings that are too long', () => {
      const longString = 'a'.repeat(101);
      expect(sanitizeGrep(longString)).toBe(null);
    });

    test('accepts strings up to 100 characters', () => {
      const maxString = 'a'.repeat(100);
      expect(sanitizeGrep(maxString)).toBe(maxString);
    });
  });
});

describe('API Endpoints', () => {
  describe('GET /health', () => {
    test('returns healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'healthy',
        service: 'test-dashboard'
      });
    });
  });

  describe('GET /api/projects', () => {
    test('returns array of projects', async () => {
      const response = await request(app).get('/api/projects');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/results/:projectId', () => {
    test('rejects invalid project ID with special chars', async () => {
      const response = await request(app).get('/api/results/project%3Brm%20-rf');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid project ID');
    });

    test('returns 404 for non-existent project', async () => {
      const response = await request(app).get('/api/results/nonexistent-project-xyz');
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });
  });

  describe('POST /api/run/:projectId', () => {
    test('rejects invalid project ID with special chars', async () => {
      const response = await request(app)
        .post('/api/run/project%24%28whoami%29')
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid project ID');
    });

    test('returns 404 for non-existent project', async () => {
      const response = await request(app)
        .post('/api/run/nonexistent-project-xyz')
        .send({});
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });
  });

  describe('GET /api/history/:projectId', () => {
    test('rejects invalid project ID with special chars', async () => {
      const response = await request(app).get('/api/history/project%7Ccat');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid project ID');
    });

    test('returns 404 for non-existent project', async () => {
      const response = await request(app).get('/api/history/nonexistent-project-xyz');
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });
  });
});

describe('Security Headers', () => {
  test('does not expose X-Powered-By header', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

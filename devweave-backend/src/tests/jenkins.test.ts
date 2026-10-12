import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateAccessToken } from '../utils/jwt.js';
import { Role } from '../generated/prisma/client.js';
import {
  ensureJenkinsJob,
  stripInvalidXmlChars,
  escapeXmlText,
  escapeXml,
  buildJenkinsJobXml,
} from '../services/jenkinsService.js';
import { generateJenkinsfile } from '../services/pipelineTemplateRegistry.js';

describe('Jenkins CI/CD Integration API Tests', () => {
  const dummyUserId = '00000000-0000-0000-0000-000000000001';
  const testToken = generateAccessToken({ sub: dummyUserId, role: Role.DEVELOPER });

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('POST /api/v1/jenkins/build', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).post('/api/v1/jenkins/build');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Authentication required');
    });

    it('should trigger Jenkins build successfully when authenticated', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/crumbIssuer/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ crumbRequestField: 'Jenkins-Crumb', crumb: 'test-crumb-value' }),
          } as Response;
        }
        if (url.includes('/build')) {
          return {
            ok: true,
            status: 201,
            statusText: 'Created',
            headers: new Headers({
              location: 'http://98.70.58.149:8080/queue/item/42/',
            }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const res = await request(app)
        .post('/api/v1/jenkins/build')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.queueItemId).toBe(42);
      expect(res.body.data.queueItemUrl).toBe('http://98.70.58.149:8080/queue/item/42/');
      expect(res.body.data.buildUrl).toContain('DevWeave-CI-CD');
    });

    it('should return 502 Bad Gateway if Jenkins server fails to trigger build', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as Response;
      });

      const res = await request(app)
        .post('/api/v1/jenkins/build')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Failed to trigger Jenkins build');
    });
  });

  describe('GET /api/v1/jenkins/build/:id', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/jenkins/build/9');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-numeric build ID with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/jenkins/build/invalid-id')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid build ID');
    });

    it('should reject negative build ID with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/jenkins/build/-5')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid build ID');
    });

    it('should return build status details for valid build ID', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/9/api/json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              number: 9,
              url: 'http://98.70.58.149:8080/job/DevWeave-CI-CD/9/',
              timestamp: 1727100000000,
              duration: 42000,
              result: 'SUCCESS',
              building: false,
            }),
          } as Response;
        }
        if (url.includes('/wfapi/describe')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              stages: [
                { id: '1', name: 'Checkout', status: 'SUCCESS', durationMillis: 2000 },
                { id: '2', name: 'Install dependencies', status: 'SUCCESS', durationMillis: 15000 },
                { id: '3', name: 'Frontend build', status: 'SUCCESS', durationMillis: 15000 },
                { id: '4', name: 'Backend build', status: 'SUCCESS', durationMillis: 10000 },
              ],
            }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      });

      const res = await request(app)
        .get('/api/v1/jenkins/build/9')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.number).toBe(9);
      expect(res.body.data.status).toBe('SUCCESS');
      expect(res.body.data.result).toBe('SUCCESS');
      expect(res.body.data.stages.length).toBe(4);
    });

    it('should handle non-existent build ID with 404 Not Found', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/99999/api/json')) {
          return {
            ok: false,
            status: 404,
            statusText: 'Not Found',
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const res = await request(app)
        .get('/api/v1/jenkins/build/99999')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Jenkins build #99999 not found');
    });

    it('should handle building state correctly as status BUILDING', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/10/api/json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              number: 10,
              url: 'http://98.70.58.149:8080/job/DevWeave-CI-CD/10/',
              timestamp: 1727100000000,
              duration: 5000,
              result: null,
              building: true,
            }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      });

      const res = await request(app)
        .get('/api/v1/jenkins/build/10')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('BUILDING');
      expect(res.body.data.result).toBeNull();
    });
  });

  // XML Sanitization & Control Character Removal Tests
  describe('Jenkins Job XML Sanitization & Security', () => {
    describe('stripInvalidXmlChars', () => {
      it('should remove U+009F (Application Program Command) character', () => {
        const input = 'echo "Starting build \u009F test"';
        const result = stripInvalidXmlChars(input);
        expect(result).toBe('echo "Starting build  test"');
        expect(result).not.toContain('\u009F');
      });

      it('should remove disallowed C1 control characters', () => {
        // \u007F (DEL), \u0080, \u0084, \u0085 (NEL), \u009E, \u009F
        const input = 'a\u007Fb\u0080c\u0084d\u0085e\u009Ef\u009Fg';
        const result = stripInvalidXmlChars(input);
        expect(result).toBe('abcdefg');
      });

      it('should remove disallowed C0 control characters but preserve tabs, newlines, and carriage returns', () => {
        // Disallowed: \u0000 (NUL), \u0001 (SOH), \u0007 (BEL), \u0008 (BS), \u000B (VT), \u000C (FF), \u001F
        // Allowed: \t (\u0009), \n (\u000A), \r (\u000D)
        const input = 'stage("Test") {\n\t\u0000\u0007\u0008sh "run"\r\n\u000B\u000C\u001F}';
        const result = stripInvalidXmlChars(input);
        expect(result).toBe('stage("Test") {\n\tsh "run"\r\n}');
      });

      it('should preserve valid non-ASCII Unicode and emojis', () => {
        const input = 'echo "Café Münster 日本語 привет 🚀 🎉 © ®"';
        const result = stripInvalidXmlChars(input);
        expect(result).toBe(input);
      });

      it('should handle empty or nullish strings safely', () => {
        expect(stripInvalidXmlChars('')).toBe('');
        expect(stripInvalidXmlChars(null as any)).toBe('');
        expect(stripInvalidXmlChars(undefined as any)).toBe('');
      });
    });

    describe('escapeXmlText and escapeXml', () => {
      it('should alias escapeXml to escapeXmlText for backwards compatibility', () => {
        expect(escapeXml).toBe(escapeXmlText);
        expect(escapeXml('test & script < 1 > 0')).toBe('test &amp; script &lt; 1 &gt; 0');
      });

      it('should escape &, <, and > in the correct order', () => {
        const input = 'if (count < 10 && total > 100)';
        const result = escapeXmlText(input);
        expect(result).toBe('if (count &lt; 10 &amp;&amp; total &gt; 100)');
      });

      it('should not double-escape existing valid XML entities', () => {
        const input = 'already &amp; escaped &lt;tag&gt; and &quot;quotes&apos; and &#60; or &#x3C;';
        const result = escapeXmlText(input);
        expect(result).toBe('already &amp; escaped &lt;tag&gt; and &quot;quotes&apos; and &#60; or &#x3C;');
      });

      it('should escape unescaped ampersands while preserving valid entities in the same text', () => {
        const input = 'foo & bar &amp; baz && qux &lt; 42';
        const result = escapeXmlText(input);
        expect(result).toBe('foo &amp; bar &amp; baz &amp;&amp; qux &lt; 42');
      });

      it('should strip U+009F and invalid characters during XML text escaping', () => {
        const input = 'stage("Step \u009F") { sh "echo 1 < 2 && 5 > 3" }';
        const result = escapeXmlText(input);
        expect(result).not.toContain('\u009F');
        expect(result).toBe('stage("Step ") { sh "echo 1 &lt; 2 &amp;&amp; 5 &gt; 3" }');
      });

      it('should preserve multiline formatting, newlines, tabs, and quotes', () => {
        const script = `pipeline {\n\tagent any\n\tstages {\n\t\tstage('Build') {\n\t\t\tsteps {\n\t\t\t\tsh 'npm run "build"'\n\t\t\t}\n\t\t}\n\t}\n}`;
        const result = escapeXmlText(script);
        expect(result).toBe(script);
        expect(result).toContain('\n\tagent any\n');
        expect(result).toContain('sh \'npm run "build"\'');
      });
    });

    describe('buildJenkinsJobXml', () => {
      it('should generate valid XML flow-definition structure', () => {
        const script = 'pipeline { agent any }';
        const xml = buildJenkinsJobXml(script, 'Custom Description');

        expect(xml).toContain('<?xml version="1.1" encoding="UTF-8"?>');
        expect(xml).toContain('<flow-definition');
        expect(xml).toContain('<description>Custom Description</description>');
        expect(xml).toContain('<script>pipeline { agent any }</script>');
        expect(xml).toContain('</flow-definition>');
      });

      it('should remove U+009F from both script and description', () => {
        const script = 'echo "Hello \u009F World"';
        const description = 'Desc with \u009F control char';
        const xml = buildJenkinsJobXml(script, description);

        expect(xml).not.toContain('\u009F');
        expect(xml).toContain('<description>Desc with  control char</description>');
        expect(xml).toContain('<script>echo "Hello  World"</script>');
      });
    });

    describe('ensureJenkinsJob with generated pipeline scripts', () => {
      it('should sanitize generated pipeline script containing U+009F when creating a new Jenkins job', async () => {
        // Generate a real Jenkinsfile from predefined template
        const cleanScript = generateJenkinsfile({
          templateId: 'nodejs-backend-ci',
          repositoryCloneUrl: 'https://github.com/my-org/backend-app.git',
          branch: 'main',
          config: { buildCommand: 'npm run build' },
        });

        // Inject U+009F into the script (simulating stray control characters from user input or environment)
        const scriptWith9f = cleanScript.replace(
          'echo \'Compiling backend application...\'',
          'echo \'Compiling \u009F backend application...\''
        );
        expect(scriptWith9f).toContain('\u009F');

        let capturedXmlPayload = '';
        let capturedContentType = '';

        global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
          if (url.includes('/crumbIssuer/')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ crumbRequestField: 'Jenkins-Crumb', crumb: 'test-crumb' }),
            } as Response;
          }
          if (url.includes('/api/json')) {
            // Job does not exist yet -> 404
            return { ok: false, status: 404 } as Response;
          }
          if (url.includes('/createItem')) {
            capturedXmlPayload = (init?.body as string) || '';
            const headers = init?.headers as Record<string, string>;
            capturedContentType = headers?.['Content-Type'] || '';
            return { ok: true, status: 200 } as Response;
          }
          return { ok: true, status: 200, json: async () => ({}) } as Response;
        });

        await ensureJenkinsJob('devweave-test-job-9f', scriptWith9f);

        // Verify the XML payload sent to Jenkins
        expect(capturedXmlPayload).toBeDefined();
        expect(capturedXmlPayload).toContain('<?xml version="1.1" encoding="UTF-8"?>');
        expect(capturedXmlPayload).toContain('<flow-definition');

        // U+009F must be completely absent from the sent XML document
        expect(capturedXmlPayload).not.toContain('\u009F');
        expect(capturedXmlPayload).toContain('echo \'Compiling  backend application...\'');

        // Verify charset header was sent
        expect(capturedContentType).toContain('charset=utf-8');

        // Verify newlines in pipeline were preserved
        expect(capturedXmlPayload).toContain('\n    agent any\n');
      });

      it('should sanitize generated pipeline script containing U+009F when updating an existing Jenkins job', async () => {
        const cleanScript = generateJenkinsfile({
          templateId: 'react-frontend-ci',
          repositoryCloneUrl: 'https://github.com/my-org/frontend-app.git',
          branch: 'main',
        });

        const scriptWith9f = `// Header \u009F\n` + cleanScript;
        expect(scriptWith9f).toContain('\u009F');

        let capturedUpdateXml = '';

        global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
          if (url.includes('/crumbIssuer/')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ crumbRequestField: 'Jenkins-Crumb', crumb: 'test-crumb' }),
            } as Response;
          }
          if (url.includes('/api/json')) {
            // Job already exists -> 200
            return { ok: true, status: 200, json: async () => ({}) } as Response;
          }
          if (url.includes('/config.xml')) {
            capturedUpdateXml = (init?.body as string) || '';
            return { ok: true, status: 200 } as Response;
          }
          return { ok: true, status: 200, json: async () => ({}) } as Response;
        });

        await ensureJenkinsJob('devweave-existing-job', scriptWith9f);

        expect(capturedUpdateXml).not.toContain('\u009F');
        expect(capturedUpdateXml).toContain('// Header \n');
      });
    });
  });
});
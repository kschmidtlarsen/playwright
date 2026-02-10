const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3030;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Project configurations - uses /var/www/ paths on Pi cluster
const PROJECTS = {
  'crossfit-generator': {
    name: 'CrossFit Generator',
    path: '/var/www/crossfit_generator/backend',
    baseUrl: 'http://192.168.0.120:3000',
    port: 3000
  },
  'rental': {
    name: 'Rental Platform',
    path: '/var/www/rental/backend',
    baseUrl: 'http://192.168.0.120:3002',
    port: 3002
  },
  'ical-adjuster': {
    name: 'iCal Adjuster',
    path: '/var/www/ical-adjuster/backend',
    baseUrl: 'http://192.168.0.120:3020',
    port: 3020
  }
};

// Results storage directory
const RESULTS_DIR = path.join(__dirname, 'results');

// Ensure results directory exists
async function ensureResultsDir() {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true });
  } catch (err) {
    // Directory exists
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'test-dashboard' });
});

// Get list of projects
app.get('/api/projects', (req, res) => {
  const projects = Object.entries(PROJECTS).map(([id, config]) => ({
    id,
    ...config
  }));
  res.json(projects);
});

// Get test results for a project
app.get('/api/results/:projectId', async (req, res) => {
  const { projectId } = req.params;

  if (!PROJECTS[projectId]) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const resultsFile = path.join(RESULTS_DIR, `${projectId}.json`);
    const data = await fs.readFile(resultsFile, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.json({ runs: [], lastRun: null });
  }
});

// Get all results summary
app.get('/api/results', async (req, res) => {
  await ensureResultsDir();

  const summary = {};

  for (const [projectId, config] of Object.entries(PROJECTS)) {
    try {
      const resultsFile = path.join(RESULTS_DIR, `${projectId}.json`);
      const data = await fs.readFile(resultsFile, 'utf-8');
      const parsed = JSON.parse(data);
      summary[projectId] = {
        name: config.name,
        lastRun: parsed.lastRun,
        passed: parsed.lastRun?.stats?.passed || 0,
        failed: parsed.lastRun?.stats?.failed || 0,
        skipped: parsed.lastRun?.stats?.skipped || 0,
        total: parsed.lastRun?.stats?.total || 0,
        status: parsed.lastRun?.stats?.failed > 0 ? 'failed' : 'passed'
      };
    } catch (err) {
      summary[projectId] = {
        name: config.name,
        lastRun: null,
        passed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        status: 'unknown'
      };
    }
  }

  res.json(summary);
});

// Run tests for a project
app.post('/api/run/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { grep } = req.body; // Optional filter

  if (!PROJECTS[projectId]) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const config = PROJECTS[projectId];

  // Start running tests in background
  res.json({ message: 'Tests started', projectId });

  try {
    await runTestsForProject(projectId, config, grep);
  } catch (err) {
    console.error(`Error running tests for ${projectId}:`, err);
  }
});

// Run tests for all projects
app.post('/api/run-all', async (req, res) => {
  const { grep } = req.body;

  res.json({ message: 'Running tests for all projects' });

  for (const [projectId, config] of Object.entries(PROJECTS)) {
    try {
      await runTestsForProject(projectId, config, grep);
    } catch (err) {
      console.error(`Error running tests for ${projectId}:`, err);
    }
  }
});

// Function to run tests and save results
async function runTestsForProject(projectId, config, grep) {
  await ensureResultsDir();

  return new Promise((resolve, reject) => {
    const args = [
      'playwright', 'test',
      '--reporter=json',
      '--output', path.join(RESULTS_DIR, `${projectId}-artifacts`)
    ];

    if (grep) {
      args.push('--grep', grep);
    }

    const env = {
      ...process.env,
      E2E_BASE_URL: config.baseUrl
    };

    console.log(`Running tests for ${projectId}...`);

    const child = spawn('npx', args, {
      cwd: config.path,
      env,
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', async (code) => {
      try {
        // Parse JSON output
        let results;
        try {
          results = JSON.parse(stdout);
        } catch (parseErr) {
          // If JSON parsing fails, create a minimal result
          results = {
            config: {},
            suites: [],
            errors: [stderr || 'Failed to parse test output']
          };
        }

        // Calculate stats
        const stats = {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: results.stats?.duration || 0
        };

        // Count results from suites
        function countResults(suites) {
          for (const suite of suites || []) {
            for (const spec of suite.specs || []) {
              for (const test of spec.tests || []) {
                stats.total++;
                const status = test.results?.[0]?.status || 'unknown';
                if (status === 'passed' || status === 'expected') {
                  stats.passed++;
                } else if (status === 'failed' || status === 'unexpected') {
                  stats.failed++;
                } else if (status === 'skipped') {
                  stats.skipped++;
                }
              }
            }
            countResults(suite.suites);
          }
        }
        countResults(results.suites);

        // Create run record
        const run = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          stats,
          grep: grep || null,
          exitCode: code,
          suites: results.suites || [],
          errors: results.errors || []
        };

        // Load existing results
        let existingData = { runs: [] };
        try {
          const existingFile = await fs.readFile(path.join(RESULTS_DIR, `${projectId}.json`), 'utf-8');
          existingData = JSON.parse(existingFile);
        } catch (err) {
          // File doesn't exist yet
        }

        // Add new run (keep last 20 runs)
        existingData.runs.unshift(run);
        existingData.runs = existingData.runs.slice(0, 20);
        existingData.lastRun = run;

        // Save results
        await fs.writeFile(
          path.join(RESULTS_DIR, `${projectId}.json`),
          JSON.stringify(existingData, null, 2)
        );

        console.log(`Tests completed for ${projectId}: ${stats.passed}/${stats.total} passed`);
        resolve(run);
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Get test run history for a project
app.get('/api/history/:projectId', async (req, res) => {
  const { projectId } = req.params;

  if (!PROJECTS[projectId]) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const resultsFile = path.join(RESULTS_DIR, `${projectId}.json`);
    const data = await fs.readFile(resultsFile, 'utf-8');
    const parsed = JSON.parse(data);
    res.json(parsed.runs || []);
  } catch (err) {
    res.json([]);
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Test Dashboard running on http://localhost:${PORT}`);
  ensureResultsDir();
});

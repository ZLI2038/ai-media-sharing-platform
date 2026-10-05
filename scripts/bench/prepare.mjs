// Build an isolated snapshot without copying credentials or local application data.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const parent = path.join(root, '.bench');
const app = path.join(parent, 'app');
const excluded = new Set(['.git', '.bench', 'node_modules', 'dist', '.wrangler', '.next', '.vinext', '.DS_Store']);
const hashes = {};
await fs.mkdir(parent, { recursive: true });
await fs.rm(app, { recursive: true, force: true });
async function copy(dir, relative = '') {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name) || (entry.name.startsWith('.env') && entry.name !== '.env.example') || entry.isSymbolicLink()) continue;
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) await copy(path.join(dir, entry.name), name);
    else if (entry.isFile()) {
      const data = await fs.readFile(path.join(dir, entry.name));
      await fs.mkdir(path.dirname(path.join(app, name)), { recursive: true });
      await fs.writeFile(path.join(app, name), data);
      hashes[name] = crypto.createHash('sha256').update(data).digest('hex');
    }
  }
}
await copy(root);
await fs.symlink(path.join(root, 'node_modules'), path.join(app, 'node_modules'), 'dir');
await fs.writeFile(path.join(app, '.env.local'), 'TOKEN_SECRET=resume-benchmark-isolated-test-secret-20260908\nOPENAI_API_KEY=sk-resume-test-sentinel-not-a-real-key-20260908\n');
let commit = 'working-tree';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
await fs.writeFile(path.join(parent, 'source-manifest.json'), JSON.stringify({ commit, files: hashes }, null, 2));
const env = { ...process.env, PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH, WRANGLER_SEND_METRICS: 'false' };
const build = spawnSync(process.execPath, ['node_modules/vinext/dist/cli.js', 'build'], { cwd: app, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
await fs.writeFile(path.join(parent, 'build.log'), (build.stdout || '') + (build.stderr || ''));
if (build.status !== 0) throw new Error('Build failed; see .bench/build.log');
console.log('Built isolated snapshot in .bench/app');

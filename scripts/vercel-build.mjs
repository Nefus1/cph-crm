import { spawnSync } from 'node:child_process';
function run(script) {
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Preview deployments must never migrate a shared production database.
if (process.env.VERCEL_ENV === 'production') run('db:migrate');
run('build');

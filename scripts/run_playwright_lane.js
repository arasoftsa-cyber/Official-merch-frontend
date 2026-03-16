const { spawnSync } = require('child_process');

const [, , profile, ...forwardedArgs] = process.argv;

if (!profile) {
  console.error('Usage: node scripts/run_playwright_lane.js <profile> [...playwright args]');
  process.exit(1);
}

const env = {
  ...process.env,
  PLAYWRIGHT_PROFILE: process.env.PLAYWRIGHT_PROFILE || profile,
};

const result = spawnSync(
  'npx',
  ['playwright', 'test', '--config=playwright.config.ts', ...forwardedArgs],
  {
    stdio: 'inherit',
    shell: true,
    env,
  }
);

process.exit(result.status ?? 1);

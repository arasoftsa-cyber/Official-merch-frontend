const { spawnSync } = require('child_process');
const path = require('path');

const hostedGatePattern = [
  'partner admin access matrix enforces portal and role boundaries',
  'admin drops page loads without raw HTML route errors',
  'admin drops page sanitizes unexpected HTML error payloads',
  'fan sees only active products across listing/search/storefront/detail',
  'buyer can browse the storefront, open a product, add it to cart, and reach the cart summary',
].join('|');

const forwardedArgs = process.argv.slice(2);
const defaultArgs = [
  'test',
  '--config=playwright.config.ts',
  '--project=local-integration',
  '--reporter=line',
  '--workers=1',
  'tests/auth/auth.contracts.spec.ts',
  'tests/admin/admin.drops.contract.spec.ts',
  'tests/onboarding/onboarding.public-visibility.spec.ts',
  'tests/commerce/buyer.catalog-and-checkout.spec.ts',
  '-g',
  hostedGatePattern,
];

const playwrightCliPath = path.resolve(__dirname, '..', 'node_modules', 'playwright', 'cli.js');
const result = spawnSync(process.execPath, [playwrightCliPath, ...defaultArgs, ...forwardedArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_PROFILE: process.env.PLAYWRIGHT_PROFILE || 'local',
  },
});

process.exit(result.status ?? 1);

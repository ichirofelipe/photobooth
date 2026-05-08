import { loadLocalEnv } from './load-env.js';
import { generateActivationKey, isValidLicenseFeature } from './activation-constants.js';

loadLocalEnv();

const DEFAULT_SERVER = process.env.ACTIVATION_SERVER_URL || 'http://localhost:3001';

function parseArgs(argv) {
  const args = {
    count: 1,
    server: DEFAULT_SERVER,
    adminSecret: process.env.ADMIN_SECRET || '',
    feature: '',
    key: '',
    duration: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--feature':
      case '-f':
        args.feature = argv[++i] || '';
        break;
      case '--key':
      case '-k':
        args.key = argv[++i] || '';
        break;
      case '--duration':
      case '-d':
        args.duration = argv[++i] || '';
        break;
      case '--count':
      case '-c':
        args.count = Number(argv[++i] || '1');
        break;
      case '--server':
      case '-s':
        args.server = argv[++i] || DEFAULT_SERVER;
        break;
      case '--admin-secret':
        args.adminSecret = argv[++i] || '';
        break;
      default:
        if (!args.feature && isValidLicenseFeature(arg)) {
          args.feature = arg;
        }
        break;
    }
  }

  return args;
}

function usage() {
  console.log(
    'Usage: npm run activation:create-license -- --feature <base_app|qr_download|template_editor|premium_bundle> [--duration <5m|30d|90d|180d|365d>] [--count 1] [--key YOUR-KEY]'
  );
  console.log('Premium features require --duration. The duration starts on first activation.');
  console.log('Base app keys must not include --duration.');
  console.log(
    'Env: auto-loads server/activation-server.env and root .env, or use --admin-secret / --server.'
  );
}

async function createLicense({ server, adminSecret, key, feature, duration }) {
  const response = await fetch(`${server.replace(/\/$/, '')}/admin/create-license`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': adminSecret,
    },
    body: JSON.stringify({ key, feature, duration }),
  });

  const json = await response.json();
  if (!response.ok) {
    if (feature === 'premium_bundle' && json.error === 'Invalid feature.') {
      const health = await fetch(`${server.replace(/\/$/, '')}/health`)
        .then((res) => res.json())
        .catch(() => null);
      const supported = Array.isArray(health?.licenseFeatures)
        ? health.licenseFeatures.join(', ')
        : 'unknown';
      throw new Error(
        `Server rejected premium_bundle. Restart the updated activation server and try again. Server-supported license features: ${supported}.`
      );
    }

    throw new Error(json.error || `Server error ${response.status}`);
  }

  return json;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!isValidLicenseFeature(args.feature) || !Number.isInteger(args.count) || args.count < 1) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (!args.adminSecret) {
    console.error('Missing ADMIN_SECRET. Provide it in the environment or with --admin-secret.');
    process.exitCode = 1;
    return;
  }

  const created = [];
  for (let i = 0; i < args.count; i += 1) {
    const key = args.key && args.count === 1 ? args.key : generateActivationKey(args.feature);
    const result = await createLicense({
      server: args.server,
      adminSecret: args.adminSecret,
      key,
      feature: args.feature,
      duration: args.duration,
    });
    created.push(result.key);
  }

  console.log(`Created ${created.length} ${args.feature} license${created.length > 1 ? 's' : ''}:`);
  for (const key of created) {
    console.log(`- ${key}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

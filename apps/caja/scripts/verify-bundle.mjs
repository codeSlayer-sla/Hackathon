import { verifyBundle, hasErrors, formatVerifyBundleResult } from '@qvac/sdk/commands';
import { join } from 'node:path';

const projectRoot = process.cwd();
const generated = join(projectRoot, 'qvac', 'worker.bundle.js');
const hosts = ['android-arm64', 'ios-arm64'];

try {
  const result = await verifyBundle({
    projectRoot,
    addonsSource: generated,
    hosts,
    configPath: join(projectRoot, 'qvac.config.json'),
  });
  if (hasErrors(result)) {
    console.error('❌ verifyBundle errors:\n', formatVerifyBundleResult(result));
    process.exit(1);
  }
  console.log('✅ verifyBundle PASS for hosts:', hosts.join(', '));
} catch (e) {
  console.error('❌ verifyBundle threw:', e && e.stack ? e.stack : e);
  process.exit(1);
}
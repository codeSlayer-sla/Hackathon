/**
 * Run as a standalone ESM script by app.plugin.js (CJS) via execSync.
 * Generates the QVAC mobile worker bundle from qvac.config.json.
 * Mirrors apps/technician-app/qvac-bundle.mjs (proven QVAC Expo build).
 */
import { bundleSdk, verifyBundle, hasErrors, formatVerifyBundleResult } from '@qvac/sdk/commands';
import { existsSync, copyFileSync } from 'fs';
import { join } from 'path';

const projectRoot = process.argv[2] ?? process.cwd();

const sdkDir = join(projectRoot, 'node_modules', '@qvac', 'sdk');

const configPath = ['qvac.config.json', 'qvac.config.js', 'qvac.config.ts']
  .map((f) => join(projectRoot, f))
  .find(existsSync) ?? null;

const MOBILE_HOSTS = ['android-arm64', 'ios-arm64'];
const DEFERRED = ['expo-file-system', 'react-native-bare-kit', `@qvac/sdk/worker.mobile.bundle`];

console.log('🕚 QVAC: Generating mobile worker bundle…');
if (configPath) console.log(`   Config: ${configPath}`);

await bundleSdk({
  projectRoot,
  sdkPath: sdkDir,
  ...(configPath ? { configPath } : {}),
  hosts: MOBILE_HOSTS,
  defer: DEFERRED,
  quiet: false,
});

const generated = join(projectRoot, 'qvac', 'worker.bundle.js');
const output = join(sdkDir, 'dist', 'worker.mobile.bundle.js');

const result = await verifyBundle({
  projectRoot,
  addonsSource: generated,
  hosts: MOBILE_HOSTS,
  ...(configPath ? { configPath } : {}),
});

if (hasErrors(result)) {
  console.error('❌ QVAC bundle verification failed:\n', formatVerifyBundleResult(result));
  process.exit(1);
}

copyFileSync(generated, output);
console.log('🫡 QVAC: Mobile bundle ready →', output);
/**
 * CJS wrapper for the QVAC SDK Expo config plugin.
 *
 * The QVAC SDK ships as pure ESM which Expo's config-plugin resolver can't
 * require() directly. This file re-implements the same transformations in CJS,
 * calling the ESM bundler step via a child process so Expo's synchronous
 * plugin runner never has to await anything.
 */
const {
  withPlugins,
  withGradleProperties,
  withAppBuildGradle,
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── 1. Mobile bundle ─────────────────────────────────────────────────────────
// Strategy: if qvac/worker.bundle.js is already committed (pre-generated
// locally with `node qvac-bundle.mjs .`), just copy it to the SDK dist dir.
// Otherwise fall back to calling the ESM bundler via a child process.
// This lets EAS cloud builds (Node 20) skip bare-pack entirely.
function withMobileBundle(config) {
  function buildBundle(config) {
    const projectRoot = config.modRequest.projectRoot;

    // Locate SDK dist dir (hard-path avoids ESM export-map restrictions)
    const sdkPkgDir = path.join(projectRoot, 'node_modules', '@qvac', 'sdk');
    const outputPath = path.join(sdkPkgDir, 'dist', 'worker.mobile.bundle.js');
    const prebuilt   = path.join(projectRoot, 'qvac', 'worker.bundle.js');

    if (fs.existsSync(prebuilt)) {
      // Fast path: use pre-generated bundle committed to the repo
      console.log('🫡 QVAC: Using pre-generated worker bundle →', outputPath);
      fs.copyFileSync(prebuilt, outputPath);
      return config;
    }

    // Slow path: generate via ESM child process (requires Node >=22)
    const bundleScript = path.join(__dirname, 'qvac-bundle.mjs');
    try {
      execSync(`node "${bundleScript}" "${projectRoot}"`, {
        stdio: 'inherit',
        env: { ...process.env },
      });
    } catch (e) {
      throw new Error(`QVAC mobile bundle failed: ${e.message}`);
    }
    return config;
  }
  config = withDangerousMod(config, ['android', buildBundle]);
  return config;
}

// ── 2. Architecture: arm64-v8a only ─────────────────────────────────────────
function withAndroidArchitecture(config) {
  config = withGradleProperties(config, (cfg) => {
    const idx = cfg.modResults.findIndex(
      (i) => i.type === 'property' && i.key === 'reactNativeArchitectures'
    );
    const entry = { type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a' };
    if (idx >= 0) cfg.modResults.splice(idx, 1, entry);
    else cfg.modResults.push(entry);
    return cfg;
  });
  config = withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    const ndkBlock = '\n        ndk {\n            abiFilters "arm64-v8a"\n        }';
    if (!g.includes('ndk {')) {
      const re = /(buildConfigField\s+"String",\s+"REACT_NATIVE_RELEASE_LEVEL"[^\n]*\n)/;
      g = re.test(g) ? g.replace(re, `$1${ndkBlock}\n`) : g;
    } else {
      g = g.replace(/ndk\s*\{[^}]*\}/s, `ndk {\n            abiFilters "arm64-v8a"\n        }`);
    }
    cfg.modResults.contents = g;
    return cfg;
  });
  return config;
}

// ── 3. NDK version ───────────────────────────────────────────────────────────
function withAndroidNdkVersion(config) {
  return withDangerousMod(config, ['android', (cfg) => {
    const buildGradlePath = path.join(cfg.modRequest.platformProjectRoot, 'build.gradle');
    if (fs.existsSync(buildGradlePath)) {
      let g = fs.readFileSync(buildGradlePath, 'utf8');
      const NDK = '29.0.14206865';
      if (g.includes('ndkVersion')) {
        g = g.replace(/ndkVersion\s*=\s*["'][^"']+["']/g, `ndkVersion = "${NDK}"`);
      } else {
        g = g.replace(/(buildscript\s*\{)/, `$1\n  ext {\n    ndkVersion = "${NDK}"\n  }`);
      }
      fs.writeFileSync(buildGradlePath, g);
    }
    return cfg;
  }]);
}

// ── 4. OpenCL support ────────────────────────────────────────────────────────
function withOpenCL(config) {
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      if (!app['uses-native-library']) app['uses-native-library'] = [];
      const already = app['uses-native-library'].find((l) => l.$?.['android:name'] === 'libOpenCL.so');
      if (!already) app['uses-native-library'].push({ $: { 'android:name': 'libOpenCL.so' } });
    }
    return cfg;
  });
  config = withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (!g.includes('excludes += "/lib/**/libOpenCL.so"')) {
      const packagingBlock = `
    packagingOptions {
        jniLibs {
            def enableLegacyPackaging = findProperty('expo.useLegacyPackaging') ?: 'false'
            useLegacyPackaging enableLegacyPackaging.toBoolean()
            excludes += "/lib/**/libOpenCL.so"
        }
    }
`;
      g = g.replace(/(android\s*{[\s\S]*?)(^})/m, (_, before, close) => before + packagingBlock + close);
    }
    cfg.modResults.contents = g;
    return cfg;
  });
  return config;
}

// ── Main plugin ──────────────────────────────────────────────────────────────
function withQvacSDK(config) {
  return withPlugins(config, [
    withMobileBundle,
    [
      'expo-build-properties',
      { android: { minSdkVersion: 29, ndkVersion: '29.0.14206865' } },
    ],
    withAndroidNdkVersion,
    withAndroidArchitecture,
    withOpenCL,
  ]);
}

module.exports = withQvacSDK;

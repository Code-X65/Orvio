const { defineConfig, globalIgnores } = require('eslint/config');

// The native resolver binding requires the MSVC runtime on Windows. The WASI
// fallback keeps linting portable on clean Windows development machines.
if (process.platform === 'win32') {
  process.env.NAPI_RS_FORCE_WASI = '1';
}

const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  globalIgnores(['dist/**']),
]);

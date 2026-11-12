import path from 'node:path';

// Exercise the real app Babel configuration: component mocks cannot detect a
// Worklets Core function compiled with Expo/Reanimated's incompatible metadata.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const babel = require('@babel/core') as {
  transformFileSync(file: string, options: object): { code: string };
  loadPartialConfig(options: object): unknown;
  transformSync(source: string, options: object): { code: string };
};
const root = path.resolve(__dirname, '../..');
const options = {
  cwd: root,
  configFile: path.join(root, 'babel.config.js'),
  caller: { name: 'metro', platform: 'android', supportsStaticESM: true },
};

it('compiles the actual Jitsi config loader for the Worklets Core ABI', () => {
  const entry = require.resolve('@jitsi/react-native-sdk');
  const file = path.join(path.dirname(entry), 'react/features/base/lib-jitsi-meet/functions.native.ts');
  const { code } = babel.transformFileSync(file, options);
  expect(code).toContain('createRunAsync');
  expect(code).toContain('__closure');
  expect(code).toContain('__initData');
  expect(code).toContain('__workletHash');
  expect(code).not.toContain('__pluginVersion');
});

it('retains the Expo Worklets transform outside the independent Jitsi SDK', () => {
  const { code } = babel.transformSync(
    "export const task = () => { 'worklet'; return 1; };",
    { ...options, filename: __filename },
  );
  expect(code).toContain('__pluginVersion');
  expect(code).toContain('__workletHash');
});

it('loads Babel configuration without a filename for the Metro cache key', () => {
  expect(() => babel.loadPartialConfig({ cwd: root, configFile: options.configFile })).not.toThrow();
});

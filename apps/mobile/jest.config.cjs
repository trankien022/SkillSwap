/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.json', jsx: 'react-jsx' },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@skillswap/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // Cap the worker pool. Jest defaults to (cores - 1) per project, and
  // `pnpm test` runs four jest projects plus vitest, so the default pool
  // oversubscribes the machine several times over and pins every core.
  maxWorkers: '50%',
};

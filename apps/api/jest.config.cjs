/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/test/'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@skillswap/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Cap the worker pool. Jest defaults to (cores - 1) per project, and
  // `pnpm test` runs four jest projects plus vitest, so the default pool
  // oversubscribes the machine several times over and pins every core.
  // Half the cores keeps the suite fast without taking the whole box.
  maxWorkers: '50%',
};

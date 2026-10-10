/** Integration/E2E jest project — runs against the docker stack (real Postgres + RabbitMQ). */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@skillswap/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // The whole suite shares one server + database, so run serially.
  maxWorkers: 1,
  testTimeout: 60000,
};

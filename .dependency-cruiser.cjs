/**
 * Fitness functions for ARCHITECTURE.md §4/§6.
 *
 * Layout contract (§5): each module under apps/api/src/modules/<m>/ has a public
 * api/ package and an internal/ tree (domain, application{port/in,port/out,query},
 * adapter/in/web, adapter/out/persistence, migrations). shared/ is technical only;
 * bootstrap/ is the composition root.
 */
const modules = [
  'admin-operation',
  'student-verification',
  'skill-verification',
  'account-profile',
  'live-class',
  'wallet-ledger',
  'schedule',
];

const mod = (m, rest = '') => `^apps/api/src/modules/${m}/${rest}`;

/** Domain and application live under internal/ and stay framework-free (ADR-009). */
const hexagonal = '/internal[\\\\/](domain|application)[\\\\/]';

/**
 * npm targets are matched on their *resolved* path, which under pnpm looks like
 * `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/entry.js` — so match the
 * package segment between path separators, not the bare package name.
 */
const npmFrameworkPath =
  '[\\\\/](typeorm|amqplib|express|pino|jsonwebtoken|dotenv|reflect-metadata|rxjs|class-validator|zod|pg|uuid)([\\\\/]|$)'
  + '|[\\\\/]@nestjs[\\\\/][a-z0-9][a-z0-9-]*([\\\\/]|$)';

const moduleRules = modules.flatMap((m) => [
  {
    name: `module-isolation-${m}`,
    severity: 'error',
    comment: `Code outside ${m} may only import ${m}/api, never its internals (ADR-005/ADR-011).`,
    // Integration tests under apps/api/test may reach internals (they boot the
    // real app and nudge schedulers); production code may not.
    from: { pathNot: `^(apps/api/test/|${mod(m)})` },
    to: { path: mod(m, 'internal/') },
  },
  {
    name: `${m}-domain-is-pure`,
    severity: 'error',
    comment: `domain/ may not depend on application, adapters or the api facade (${m}).`,
    from: { path: mod(m, 'internal/domain/') },
    to: { path: mod(m, '(internal/(application|adapter)/|api/)') },
  },
  {
    name: `${m}-domain-stays-in-module`,
    severity: 'error',
    comment: `domain/ must not reach other modules, not even through their api facade (${m}).`,
    from: { path: mod(m, 'internal/domain/') },
    to: { path: '^apps/api/src/modules/(?!' + m + '/)' },
  },
  {
    name: `${m}-application-no-adapters`,
    severity: 'error',
    comment: `application/ may depend on ports only, never on adapters (${m}).`,
    from: { path: mod(m, 'internal/application/') },
    to: { path: mod(m, 'internal/adapter/') },
  },
  {
    name: `${m}-api-no-own-adapters`,
    severity: 'error',
    comment: `The public api/ package must not leak implementation details (${m}).`,
    from: { path: mod(m, 'api/') },
    to: { path: mod(m, 'internal/adapter/') },
  },
  {
    name: `${m}-web-adapter-no-persistence`,
    severity: 'error',
    comment: `adapter/in/web reaches persistence only through application ports (${m}).`,
    from: { path: mod(m, 'internal/adapter/in/') },
    to: { path: mod(m, 'internal/adapter/out/') },
  },
  {
    name: `${m}-persistence-no-web`,
    severity: 'error',
    comment: `adapter/out must not know about inbound HTTP (${m}).`,
    from: { path: mod(m, 'internal/adapter/out/') },
    to: { path: mod(m, 'internal/adapter/in/') },
  },
  {
    name: `${m}-queries-no-domain`,
    severity: 'error',
    comment: `Query handlers are CQRS read paths and must not load aggregates (ADR-012, ${m}).`,
    from: { path: mod(m, 'internal/application/query/') },
    to: { path: mod(m, 'internal/domain/') },
  },
  {
    name: `${m}-migrations-standalone`,
    severity: 'error',
    comment: `Migrations must run without domain/application code (${m}).`,
    from: { path: mod(m, '.*migrations/') },
    to: { path: mod(m, 'internal/(domain|application)/') },
  },
]);

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make refactoring dangerous and break topological builds.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'must-resolve',
      severity: 'error',
      comment: 'Every import must resolve (path, tsconfig paths, or package).',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-undeclared-npm-deps',
      severity: 'error',
      comment: 'Only dependencies declared in the package.json may be imported (ADR-005).',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg'] },
    },
    {
      name: 'no-deprecated',
      severity: 'warn',
      comment: 'Importing deprecated packages invites future breakage.',
      from: {},
      to: { dependencyTypes: ['deprecated'] },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Files nobody imports are candidates for deletion.',
      from: {
        orphan: true,
        pathNot: [
          '\\.(d\\.ts|spec\\.ts|test\\.ts)$',
          'src/index\\.ts$',
          '\\.module\\.ts$',
          'src/bootstrap/',
          'src/modules/.+/api/',
          'migrations/',
          '\\.config\\.(cjs|mjs|mts|js|ts)$',
        ],
      },
      to: {},
    },
    {
      name: 'amqplib-only-in-shared-messaging',
      severity: 'error',
      comment: 'ADR-013: publishers/consumers reach the broker only through shared/messaging (outbox relay).',
      from: { pathNot: '^apps/api/src/shared/messaging/' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-peer', 'npm-optional'],
        path: '[\\\\/]amqplib[\\\\/]',
      },
    },
    ...['api', 'gateway', 'web', 'mobile'].map((a) => ({
      name: `isolated-app-${a}`,
      severity: 'error',
      comment: `apps/${a} must not import code from another app (one deployable per app).`,
      from: { path: `^apps/${a}/` },
      to: { path: `^apps/(?!${a}/)` },
    })),
    {
      name: 'contracts-is-leaf',
      severity: 'error',
      comment: 'packages/contracts must not depend on app code.',
      from: { path: '^packages/' },
      to: { path: '^apps' },
    },
    {
      name: 'shared-is-module-agnostic',
      severity: 'error',
      comment: 'shared/ is technical glue: it must never depend on feature modules.',
      from: { path: '^apps/api/src/shared/' },
      to: { path: '^apps/api/src/modules/' },
    },
    {
      name: 'domain-application-no-frameworks',
      severity: 'error',
      comment: 'domain and application must not import framework, ORM, HTTP or messaging packages (ADR-009).',
      from: { path: hexagonal },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-peer', 'npm-optional'],
        path: npmFrameworkPath,
      },
    },
    {
      name: 'domain-application-stay-inside-module',
      severity: 'error',
      comment: 'domain/application never depend on shared, bootstrap, contracts or other packages (ADR-009).',
      from: { path: hexagonal },
      to: { path: '^(packages/|apps/api/src/(shared|bootstrap)/|apps/(?!api))' },
    },
    {
      name: 'no-spec-in-prod',
      severity: 'error',
      comment: 'Test files must not be reachable from production entry points.',
      from: {
        path: '^apps/.+/src/(?!.*\\.(spec|test)\\.)',
        pathNot: ['\\.(spec|test)\\.[tj]sx?$', 'tests/', '__tests__/'],
      },
      to: { path: ['\\.(spec|test)\\.[tj]sx?$', '/(tests|__tests__)/'] },
    },
    ...moduleRules,
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        'dist',
        '\\.next',
        'coverage',
        '^(?!node_modules).*\\.d\\.ts$',
        'docs/',
        'scripts/',
        'tests/',
      ],
    },
    tsConfig: { fileName: 'tsconfig.base.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json'],
    },
  },
};

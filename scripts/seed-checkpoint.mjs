import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { scryptSync } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Additive checkpoint fixtures. Never reset, delete, or overwrite existing balances.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: join(root, '.env') });
const password = process.env.CHECKPOINT_DEMO_PASSWORD || 'Demo1234!';
const { ApiConfig } = await import(
  pathToFileURL(join(root, 'apps/api/dist/shared/config/api-config.js'))
);
const sources = {};
const config = new ApiConfig();
const domain = 'checkpoint.skillswap.local';
const identities = [
  ['learner', 'Minh — Người học', 'user', 500, 'approved'],
  ['teacher', 'An — Giáo viên Python', 'user', 0, 'approved'],
  ['poor', 'Bình — Ví thiếu credit', 'user', 20, 'approved'],
  ['upload', 'Chi — Chờ xác minh', 'user', 0, null],
  ['rejected', 'Dũng — Hồ sơ bị từ chối', 'user', 0, 'rejected'],
  ['admin', 'Quản trị checkpoint', 'admin', null, null],
  ['verifier', 'Người duyệt kỹ năng', 'verifier', null, null],
];
const uuid = (index) => `13102026-0000-4000-8000-${String(index).padStart(12, '0')}`;
const accounts = {};
const classes = [];
try {
  for (const module of [
    'account-profile',
    'student-verification',
    'skill-verification',
    'live-class',
    'wallet-ledger',
  ]) {
    const file = join(
      root,
      `apps/api/dist/modules/${module}/internal/adapter/out/persistence/data-source.js`,
    );
    if (!existsSync(file)) throw new Error('Build API before seeding checkpoint fixtures');
    const { createModuleDataSource } = await import(pathToFileURL(file));
    sources[module] = createModuleDataSource(config);
    await sources[module].initialize();
  }
  const account = sources['account-profile'];
  const student = sources['student-verification'];
  const skill = sources['skill-verification'];
  const live = sources['live-class'];
  const wallet = sources['wallet-ledger'];
  for (const [index, [name, displayName, role, credits, status]] of identities.entries()) {
    const email = `${name}@${domain}`;
    await account.query(
      `INSERT INTO account_profile.accounts (id,email,display_name,role,status)
      VALUES ($1,$2,$3,$4,'active') ON CONFLICT DO NOTHING`,
      [uuid(index + 1), email, displayName, role],
    );
    const [row] = await account.query(
      'SELECT id,role FROM account_profile.accounts WHERE email=$1',
      [email],
    );
    if (!row || row.id !== uuid(index + 1) || row.role !== role)
      throw new Error(`Fixture identity collision: ${email}`);
    accounts[name] = { id: row.id, email };
    const salt = `checkpoint-20261013-${name}`;
    await account.query(
      `INSERT INTO account_profile.account_credentials (account_id,algorithm,salt,hash,key_length,updated_at)
      VALUES ($1,'scrypt',$2,$3,64,now()) ON CONFLICT DO NOTHING`,
      [row.id, salt, scryptSync(password, salt, 64).toString('base64')],
    );
    if (credits !== null) {
      await wallet.transaction(async (tx) => {
        const inserted = await tx.query(
          `INSERT INTO wallet_ledger.wallets (owner_id,available_credits,pending_credits,updated_at)
          VALUES ($1,$2,0,now()) ON CONFLICT DO NOTHING RETURNING owner_id`,
          [row.id, credits],
        );
        if (inserted.length && credits > 0) {
          await tx.query(
            `INSERT INTO wallet_ledger.ledger_entries (owner_id,entry_type,direction,amount_credits,reference_id,teacher_id,trace_id)
            VALUES ($1,'top_up','credit',$2,$3,$1,$3)`,
            [row.id, credits, `checkpoint-initial-${name}`],
          );
        }
      });
    }
    if (status) {
      const verificationId = uuid(100 + index);
      const reason = status === 'rejected' ? 'Ảnh thẻ sinh viên không rõ; vui lòng tải lại.' : null;
      await student.query(
        `INSERT INTO student_verification.student_verifications
        (id,account_id,school_name,major,document_ref,status,reviewer_id,reason,decided_at)
        VALUES ($1,$2,'Đại học FPT','Kỹ thuật phần mềm',$3,$4,$5,$6,now()) ON CONFLICT DO NOTHING`,
        [verificationId, row.id, `checkpoint-fixture/${name}.pdf`, status, uuid(6), reason],
      );
      await account.query(
        `INSERT INTO account_profile.account_verification_status
        (account_id,status,reason,verification_id,occurred_at,updated_at) VALUES ($1,$2,$3,$4,now(),now()) ON CONFLICT DO NOTHING`,
        [row.id, status, reason, verificationId],
      );
      await skill.query(
        `INSERT INTO skill_verification.verified_students (account_id,status,occurred_at,updated_at)
        VALUES ($1,$2,now(),now()) ON CONFLICT DO NOTHING`,
        [row.id, status],
      );
      await live.query(
        `INSERT INTO live_class.teacher_verified (account_id,verified,occurred_at,updated_at)
        VALUES ($1,$2,now(),now()) ON CONFLICT DO NOTHING`,
        [row.id, status === 'approved'],
      );
    }
  }
  let [python] = await skill.query(
    "SELECT id FROM skill_verification.skills WHERE name='Python' AND category='Programming'",
  );
  if (!python)
    [python] = await skill.query(
      "INSERT INTO skill_verification.skills (name,category) VALUES ('Python','Programming') RETURNING id",
    );
  await skill.query(
    `INSERT INTO skill_verification.verifiers (account_id,status) VALUES ($1,'active') ON CONFLICT DO NOTHING`,
    [accounts.verifier.id],
  );
  await skill.query(
    `INSERT INTO skill_verification.verifier_expertise (account_id,skill_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [accounts.verifier.id, python.id],
  );
  await skill.query(
    `INSERT INTO skill_verification.profile_skills (account_id,skill_id,approved_level)
    VALUES ($1,$2,'advanced') ON CONFLICT DO NOTHING`,
    [accounts.teacher.id, python.id],
  );
  await live.query(
    `INSERT INTO live_class.teacher_skill_approval (account_id,skill_id,approved_level,occurred_at,updated_at)
    VALUES ($1,$2,'advanced',now(),now()) ON CONFLICT DO NOTHING`,
    [accounts.teacher.id, python.id],
  );
  const specs = [
    ['booking', 'CHECKPOINT · Python cơ bản — đặt lớp trực tiếp', 100, 72],
    ['push1', 'CHECKPOINT · Python vòng lặp — push hủy lớp lần 1', 100, 96],
    ['push2', 'CHECKPOINT · Python hàm — push hủy lớp lần 2', 100, 120],
    ['edit', 'CHECKPOINT · Python nâng cao — sửa giá và hủy lớp', 80, 144],
    ['expensive', 'CHECKPOINT · Python thực hành — thử thiếu credit', 100, 168],
  ];
  for (const [index, [name, description, price, hours]] of specs.entries()) {
    const id = uuid(200 + index);
    await live.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO live_class.classes (id,teacher_id,state,starts_at,duration_minutes,price_credits,capacity,description)
        VALUES ($1,$2,'published',$3,60,$4,8,$5) ON CONFLICT DO NOTHING`,
        [id, accounts.teacher.id, new Date(Date.now() + hours * 3600000), price, description],
      );
      await tx.query(
        'INSERT INTO live_class.class_skills (class_id,skill_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [id, python.id],
      );
    });
    classes.push({ name, id, description });
  }
  const manifestPath = join(root, '.secrets/checkpoint-demo.json');
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify({ accounts, classes, password }, null, 2), {
    mode: 0o600,
  });
  console.log(
    `Checkpoint fixtures ready: ${identities.length} accounts, ${classes.length} classes. Manifest: .secrets/checkpoint-demo.json`,
  );
} finally {
  for (const source of Object.values(sources)) if (source.isInitialized) await source.destroy();
}

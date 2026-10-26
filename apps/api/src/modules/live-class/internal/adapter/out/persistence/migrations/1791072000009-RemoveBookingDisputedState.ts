import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * FR-015 / ADR-037 decision 6: remove `disputed` from the booking vocabulary.
 *
 * No dispute workflow exists in the MVP (OQ-015 note), so no transition ever produced this state.
 * It nevertheless sat in three places in the schema — the `state` CHECK, the double-booking index's
 * `WHERE` clause, and (before this migration) the domain tuple — which is why removing it is a
 * migration and not a documentation edit.
 *
 * **The guard is the point.** The domain reasoning says no row can hold the value, but a migration
 * that assumes that is one bad deploy away from failing on the CHECK rewrite in a way that is hard
 * to read. This asserts it first, with a message naming the offence.
 */
export class RemoveBookingDisputedState1791072000009 implements MigrationInterface {
  name = 'RemoveBookingDisputedState1791072000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const disputed = (await queryRunner.query(
      `SELECT COUNT(*)::int AS total FROM ${table('bookings')} WHERE "state" = 'disputed'`,
    )) as { total: number }[];
    if ((disputed[0]?.total ?? 0) > 0) {
      throw new Error(
        'Cannot remove the `disputed` booking state: rows still hold it. ' +
          'No transition in this codebase produced it, so this means an external writer. ' +
          'Resolve those rows before migrating (ADR-037 decision 6).',
      );
    }

    await queryRunner.query(
      `ALTER TABLE ${table('bookings')} DROP CONSTRAINT IF EXISTS "bookings_state_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('bookings')} ADD CONSTRAINT "bookings_state_check"
         CHECK ("state" IN ('pending', 'confirmed', 'completed', 'cancelled'))`,
    );

    // `CREATE INDEX IF NOT EXISTS` would leave the old definition in place, so drop then recreate.
    // `DROP INDEX` qualifies the *index* with its schema, never the table it belongs to.
    await queryRunner.query(`DROP INDEX IF EXISTS "${SCHEMA}"."uq_bookings_active_learner_class"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_bookings_active_learner_class" ON ${table('bookings')}
         ("class_id", "learner_id")
       WHERE "state" IN ('pending', 'confirmed', 'completed')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('bookings')} DROP CONSTRAINT IF EXISTS "bookings_state_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('bookings')} ADD CONSTRAINT "bookings_state_check"
         CHECK ("state" IN ('pending', 'confirmed', 'completed', 'cancelled', 'disputed'))`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "${SCHEMA}"."uq_bookings_active_learner_class"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_bookings_active_learner_class" ON ${table('bookings')}
         ("class_id", "learner_id")
       WHERE "state" IN ('pending', 'confirmed', 'completed', 'disputed')`,
    );
  }
}

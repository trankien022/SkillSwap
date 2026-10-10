import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/** FR-011 (ADR-020): audit trail for room-access incidents (NFR-006/NFR-009). */
export class CreateRoomAccessIncidents1791072000003 implements MigrationInterface {
  name = 'CreateRoomAccessIncidents1791072000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${table('room_access_incidents')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "booking_id" text NOT NULL,
      "class_id" text,
      "requester_id" text NOT NULL,
      "reason" text NOT NULL,
      "trace_id" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_room_access_incidents_booking" ON ${table('room_access_incidents')} ("booking_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${table('room_access_incidents')}`);
  }
}

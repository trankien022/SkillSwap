import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

function table(name: string): string {
  return `"${SCHEMA}"."${name}"`;
}

/**
 * A class gets a name a Teacher writes (B1).
 *
 * Every client used to invent one: the web card showed the *skill* name (so two IELTS classes
 * rendered identically), the web detail page put the whole description inside an `<h1>`, and the
 * mobile detail page showed the literal string "Class Details". Search could not find a class by
 * name either, because `q` only matched `description`. None of that is fixable in a client: the
 * name is a fact about the class, so it belongs to the class.
 *
 * The backfill reads `description`, **not** the skill name. The skill catalogue lives in another
 * schema and ADR-014 forbids the join, so deriving a title from it would be a cross-schema read
 * performed once at migration time and then frozen as if it were data. The description is in this
 * schema and is already the best free-text stand-in for a name. The seed writes real titles, so
 * this backfill only ever touches old developer databases.
 *
 * The check is on `btrim(title)`, matching the domain's 1-120 rule: a title of three spaces is not
 * a title, and storage should refuse it even if a future writer forgets to validate.
 *
 * No index on `title`. `q` becomes `(title ILIKE … OR description ILIKE …)` and both sides are
 * leading-wildcard patterns, which a btree cannot serve; an `ILIKE` index would need the trigram
 * extension and the marketplace page is a keyset scan bounded by `starts_at` anyway. Adding an
 * index that no plan can use would be decoration.
 */
export class AddClassTitle1791072000011 implements MigrationInterface {
  name = 'AddClassTitle1791072000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ${table('classes')} ADD COLUMN IF NOT EXISTS "title" text`);
    await queryRunner.query(
      `UPDATE ${table('classes')} SET "title" = left(btrim("description"), 120) WHERE "title" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('classes')} ALTER COLUMN "title" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE ${table('classes')} ADD CONSTRAINT "ck_classes_title" CHECK (length(btrim("title")) BETWEEN 1 AND 120)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${table('classes')} DROP CONSTRAINT IF EXISTS "ck_classes_title"`,
    );
    await queryRunner.query(`ALTER TABLE ${table('classes')} DROP COLUMN IF EXISTS "title"`);
  }
}

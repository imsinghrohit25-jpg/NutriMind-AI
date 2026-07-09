import { describe, it, expect } from 'vitest';
import { lintMigrationContent } from '../lint-migrations.js';

describe('lintMigrationContent', () => {
  it('flags DROP TABLE', () => {
    const violations = lintMigrationContent('x.sql', 'DROP TABLE public.foo;');
    expect(violations).toHaveLength(1);
    expect(violations[0]!.rule).toBe('DROP TABLE');
  });

  it('flags DROP COLUMN', () => {
    const violations = lintMigrationContent('x.sql', 'ALTER TABLE foo DROP COLUMN bar;');
    expect(violations[0]!.rule).toBe('DROP COLUMN');
  });

  it('flags RENAME COLUMN and RENAME TO', () => {
    const v1 = lintMigrationContent('x.sql', 'ALTER TABLE foo RENAME COLUMN a TO b;');
    expect(v1[0]!.rule).toBe('RENAME COLUMN');
    const v2 = lintMigrationContent('x.sql', 'ALTER TABLE foo RENAME TO bar;');
    expect(v2[0]!.rule).toBe('RENAME TABLE/TO');
  });

  it('flags TRUNCATE and ALTER COLUMN ... TYPE', () => {
    expect(lintMigrationContent('x.sql', 'TRUNCATE foo;')[0]!.rule).toBe('TRUNCATE');
    expect(lintMigrationContent('x.sql', 'ALTER TABLE foo ALTER COLUMN bar TYPE text;')[0]!.rule)
      .toBe('ALTER COLUMN ... TYPE');
  });

  it('flags SET NOT NULL on an existing column', () => {
    const violations = lintMigrationContent('x.sql', 'ALTER TABLE foo ALTER COLUMN bar SET NOT NULL;');
    expect(violations[0]!.rule).toBe('SET NOT NULL (existing column)');
  });

  it('flags ADD COLUMN ... NOT NULL with no DEFAULT', () => {
    const violations = lintMigrationContent('x.sql', 'ALTER TABLE foo ADD COLUMN bar text NOT NULL;');
    expect(violations.some((v) => v.rule === 'ADD COLUMN ... NOT NULL (no DEFAULT)')).toBe(true);
  });

  it('does NOT flag ADD COLUMN ... NOT NULL DEFAULT ... (safe, backfilled)', () => {
    const violations = lintMigrationContent('x.sql', "ALTER TABLE foo ADD COLUMN bar boolean NOT NULL DEFAULT false;");
    expect(violations).toHaveLength(0);
  });

  it('does not flag a plain additive CREATE TABLE / ADD COLUMN (nullable)', () => {
    const sql = `
      CREATE TABLE public.foo (id uuid PRIMARY KEY);
      ALTER TABLE public.foo ADD COLUMN bar text;
    `;
    expect(lintMigrationContent('x.sql', sql)).toHaveLength(0);
  });

  it('ignores rule keywords that only appear inside a line comment', () => {
    const sql = '-- this migration does NOT do a DROP TABLE, see docs\nCREATE TABLE foo (id uuid);';
    expect(lintMigrationContent('x.sql', sql)).toHaveLength(0);
  });

  it('ignores rule keywords inside a block comment', () => {
    const sql = '/* historical note: an old draft used DROP TABLE here */\nCREATE TABLE foo (id uuid);';
    expect(lintMigrationContent('x.sql', sql)).toHaveLength(0);
  });

  it('allows a genuinely destructive migration when explicitly marked contract-phase', () => {
    const sql = '-- contract-phase: dropping the old shadow column after 2 full releases of dual-write\nALTER TABLE foo DROP COLUMN legacy_bar;';
    expect(lintMigrationContent('x.sql', sql)).toHaveLength(0);
  });

  it('reports accurate line numbers for multi-line files', () => {
    const sql = 'CREATE TABLE foo (id uuid);\n\nALTER TABLE foo DROP COLUMN bar;\n';
    const violations = lintMigrationContent('x.sql', sql);
    expect(violations[0]!.line).toBe(3);
  });
});

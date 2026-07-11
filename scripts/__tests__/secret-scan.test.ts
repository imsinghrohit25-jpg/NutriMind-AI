// Proves scripts/secret-scan.sh actually catches a planted secret (Gemini integration, Gate 0 §4:
// "verify the repo's existing secret-scan/lint step catches a planted fake key in a test"). Runs
// the real script — not a re-implementation of its regexes — against a disposable, isolated git
// repo so a planted fake key never touches the real repo's history.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT_PATH = join(__dirname, '..', 'secret-scan.sh');

let repoDir: string;

function run(): { status: number; output: string } {
  try {
    const output = execFileSync('bash', [SCRIPT_PATH], { cwd: repoDir, encoding: 'utf8' });
    return { status: 0, output };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { status: e.status, output: e.stdout + e.stderr };
  }
}

function commitFile(relPath: string, content: string): void {
  const fullPath = join(repoDir, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content);
  execFileSync('git', ['add', relPath], { cwd: repoDir });
  execFileSync('git', ['-c', 'user.email=test@test.com', '-c', 'user.name=test', 'commit', '-m', 'x'], {
    cwd: repoDir,
  });
}

beforeEach(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'secret-scan-test-'));
  execFileSync('git', ['init', '-q'], { cwd: repoDir });
});

afterEach(() => {
  rmSync(repoDir, { recursive: true, force: true });
});

describe('secret-scan.sh (real script, isolated repo — proves the guard works)', () => {
  it('passes cleanly on a repo with no secrets', () => {
    commitFile('src/index.ts', 'export const x = 1;\n');
    const result = run();
    expect(result.status).toBe(0);
    expect(result.output).toContain('PASSED');
  });

  it('FAILS when a planted Google API key (AIza...) is committed', () => {
    commitFile('src/planted.ts', "const key = 'AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe';\n");
    const result = run();
    expect(result.status).toBe(1);
    expect(result.output).toContain('FAILED');
    expect(result.output).toContain('AIza');
  });

  it('FAILS when a planted Anthropic-style key (sk-ant-...) is committed', () => {
    commitFile('src/planted.ts', "const key = 'sk-ant-" + "a".repeat(30) + "';\n");
    const result = run();
    expect(result.status).toBe(1);
    expect(result.output).toContain('FAILED');
  });

  it('FAILS when a planted Supabase service-role key line is committed', () => {
    commitFile('src/notes.txt', 'SUPABASE_SERVICE_ROLE_KEY=eyJreally-not-empty\n');
    const result = run();
    expect(result.status).toBe(1);
    expect(result.output).toContain('FAILED');
  });

  it('does NOT flag the known-safe local Supabase CLI dev connection string (127.0.0.1 host)', () => {
    commitFile(
      'src/scripts/import-x.ts',
      "const url = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';\n",
    );
    const result = run();
    expect(result.status).toBe(0);
    expect(result.output).toContain('PASSED');
  });

  it('does NOT flag the known-safe local Supabase CLI dev connection string (localhost host)', () => {
    commitFile(
      'vitest.setup.ts',
      "process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:54322/postgres';\n",
    );
    const result = run();
    expect(result.status).toBe(0);
    expect(result.output).toContain('PASSED');
  });

  it('still FAILS on a genuinely different postgres credential (safe-list is precise, not a blanket exemption)', () => {
    commitFile(
      'src/config.ts',
      "const url = 'postgresql://admin:sup3rS3cr3tPassw0rd@prod-db.example.com:5432/app';\n",
    );
    const result = run();
    expect(result.status).toBe(1);
    expect(result.output).toContain('FAILED');
  });
});

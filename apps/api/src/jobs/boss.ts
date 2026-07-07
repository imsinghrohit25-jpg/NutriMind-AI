import PgBoss from 'pg-boss';
import { env } from '../env.js';

let instance: PgBoss | null = null;
let startPromise: Promise<void> | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (instance) return instance;

  if (!startPromise) {
    startPromise = (async () => {
      const boss = new PgBoss({
        connectionString: env.DATABASE_URL,
        schema: 'pgboss',
        archiveCompletedAfterSeconds: 60 * 60 * 24 * 7,
        deleteAfterDays: 30,
        monitorStateIntervalSeconds: 30,
        schedule: true,
      });

      boss.on('error', (err) => {
        console.error('[pg-boss] error:', err);
      });

      await boss.start();
      instance = boss;
    })();
  }

  await startPromise;
  return instance!;
}

export async function shutdownBoss(): Promise<void> {
  if (instance) {
    await instance.stop({ graceful: true, timeout: 10_000 });
    instance = null;
    startPromise = null;
  }
}

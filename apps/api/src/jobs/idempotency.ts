import crypto from 'node:crypto';

export function makeIdempotencyKey(jobName: string, input: unknown): string {
  const payload = JSON.stringify({ jobName, input });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function makeScheduledJobKey(jobName: string, periodKey: string): string {
  return `${jobName}:${periodKey}`;
}

export function weeklyReportPeriodKey(userId: string, weekStart: Date): string {
  const iso = weekStart.toISOString().slice(0, 10);
  return makeIdempotencyKey('weekly-report', { userId, weekStart: iso });
}

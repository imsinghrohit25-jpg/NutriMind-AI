// k6 load test — Copilot SSE streaming endpoint.
// Tests: guardrail fast-path (p50 < 100ms for blocked queries),
//        retrieval + LLM path (p50 < 3000ms at 20 VUs).
// Run: k6 run k6/copilot-load.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const guardrailLatency = new Trend('copilot_guardrail_latency');
const llmLatency       = new Trend('copilot_llm_latency');
const errorRate        = new Rate('copilot_errors');

export const options = {
  scenarios: {
    guardrail_fast_path: {
      executor:  'constant-vus',
      vus:       10,
      duration:  '1m',
      tags:      { scenario: 'guardrail' },
    },
    llm_path: {
      executor:  'ramping-vus',
      startVUs:  0,
      stages:    [
        { duration: '30s', target: 20 },
        { duration: '1m',  target: 20 },
        { duration: '30s', target: 0  },
      ],
      tags: { scenario: 'llm' },
    },
  },
  thresholds: {
    'copilot_guardrail_latency': ['p(50)<100', 'p(95)<300'],
    'copilot_llm_latency':       ['p(50)<3000', 'p(95)<6000'],
    copilot_errors:               ['rate<0.05'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const headers  = {
  'Content-Type': 'application/json',
  Authorization:  `Bearer ${__ENV.TEST_JWT || 'test-token'}`,
};

const SAFE_QUERY   = 'What is the recommended daily sodium intake?';
const BLOCKED_QUERY = 'What medication should I take for my hypertension?';

export function guardrail_fast_path() {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/v1/copilot/chat`,
    JSON.stringify({ query: BLOCKED_QUERY }),
    { headers },
  );
  guardrailLatency.add(Date.now() - start);

  const ok = check(res, {
    'guardrail blocks (200 or 422)': (r) => r.status === 200 || r.status === 422,
  });
  errorRate.add(!ok);
  sleep(1);
}

export function llm_path() {
  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/v1/copilot/chat`,
    JSON.stringify({ query: SAFE_QUERY }),
    { headers, timeout: '10s' },
  );
  llmLatency.add(Date.now() - start);

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
  });
  errorRate.add(!ok);
  sleep(2);
}

export default function () {
  // Default function — run both paths for simple k6 run
  guardrail_fast_path();
  llm_path();
}

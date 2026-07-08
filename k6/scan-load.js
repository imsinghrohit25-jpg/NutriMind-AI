// k6 load test — scan API endpoint.
// Target: p50 < 800ms, p95 < 2000ms at 50 concurrent users.
// Run: k6 run k6/scan-load.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const scanLatency   = new Trend('scan_latency');
const scanErrorRate = new Rate('scan_errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // ramp up
    { duration: '2m',  target: 50 },  // steady-state 50 VUs
    { duration: '30s', target: 0  },  // ramp down
  ],
  thresholds: {
    scan_latency:    ['p(50)<800', 'p(95)<2000'],
    scan_errors:     ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// Sample barcode — use a seeded product in local DB for deterministic response
const TEST_BARCODE = '8901058818829';  // Parle-G biscuits barcode (seeded)

const headers = {
  'Content-Type': 'application/json',
  Authorization:  `Bearer ${__ENV.TEST_JWT || 'test-token'}`,
};

export default function () {
  const start = Date.now();

  const res = http.get(`${BASE_URL}/api/v1/scan/${TEST_BARCODE}`, { headers });

  const duration = Date.now() - start;
  scanLatency.add(duration);

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'has healthScore': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.healthScore === 'number';
      } catch {
        return false;
      }
    },
  });

  scanErrorRate.add(!ok);
  sleep(0.5 + Math.random());  // 0.5–1.5s think time
}

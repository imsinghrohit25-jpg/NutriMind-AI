// k6 load test — barcode resolve endpoint.
// Target (Phase 12 addendum §14 acceptance gate): barcode resolve p95 < 1.5s at burst.
// Run: k6 run k6/scan-load.js
//
// Fixed this phase: this script targeted `GET /api/v1/scan/:barcode`, an endpoint that has
// never existed in this build track — the real one (routes/v1/resolve.ts) is
// `POST /v1/resolve/barcode` with a JSON `{barcode}` body and an `{ok, data: {found, product}}`
// response envelope. Never actually run successfully before this fix (would have 404'd).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const scanLatency   = new Trend('scan_latency');
const scanErrorRate = new Rate('scan_errors');
const cacheHitRate  = new Rate('scan_cache_hit');

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // ramp up
    { duration: '2m',  target: 50 },  // steady-state 50 VUs
    { duration: '30s', target: 0  },  // ramp down
  ],
  thresholds: {
    // Phase 12 addendum §14 gate: barcode p95 < 1.5s at burst.
    scan_latency:    ['p(50)<800', 'p(95)<1500'],
    scan_errors:     ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
    // Phase 12 addendum §13.1: cache hit target >= 90% on the barcode path. This VU pool
    // intentionally re-scans the SAME small barcode set (see BARCODES below) so a correctly
    // working edge/DB cache should clear this easily; a fresh-barcode-per-request test would
    // measure something else (cold-cache cost), not the cache's steady-state hit rate.
    scan_cache_hit:  ['rate>0.90'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// A small, fixed pool of real seeded barcodes — repeat traffic against a small set is what makes
// the cache-hit-rate threshold above meaningful (see scan_cache_hit's comment).
const BARCODES = [
  '8901058818829', // Parle-G biscuits (seeded)
  '8901491101564',
  '8901030895555',
  '8901063151164',
  '8901063020122',
];

const headers = {
  'Content-Type': 'application/json',
  Authorization:  `Bearer ${__ENV.TEST_JWT || 'test-token'}`,
};

export default function () {
  const barcode = BARCODES[Math.floor(Math.random() * BARCODES.length)];
  const start = Date.now();

  const res = http.post(
    `${BASE_URL}/v1/resolve/barcode`,
    JSON.stringify({ barcode }),
    // 404 (not_found) is a real, documented, non-error outcome (routes/v1/resolve.ts) — without
    // this, k6's own http_req_failed metric counts every 404 as a failure regardless of the
    // domain-level `scan_errors` check below, which was proven wrong the first time this script
    // was actually run against a real (unseeded, in this test env) barcode.
    { headers, responseCallback: http.expectedStatuses(200, 404) },
  );

  const duration = Date.now() - start;
  scanLatency.add(duration);

  const ok = check(res, {
    'status 200 or 404 (not_found is a valid, documented outcome)': (r) => r.status === 200 || r.status === 404,
    'response has ok+data envelope': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.ok === 'boolean' && body.data !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      cacheHitRate.add(body.data?.resolvedBy === 'cache');
    } catch {
      cacheHitRate.add(false);
    }
  }

  scanErrorRate.add(!ok);
  sleep(0.5 + Math.random());  // 0.5-1.5s think time
}

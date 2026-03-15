import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api';
const PROFILE_ID = 'perf-test-profile';

export const options = {
  scenarios: {
    sla_smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 20,
      maxDuration: '60s',
    },
  },
  thresholds: {
    'http_req_duration{endpoint:summary}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{endpoint:profile}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{endpoint:wallets}': ['p(95)<500'],
    'http_req_duration{endpoint:assets}': ['p(95)<800'],
    'http_req_duration{endpoint:timeline}': ['p(95)<300'],
  },
};

// Authenticate via test-login endpoint (NODE_ENV=test enables TestAuthModule)
// Returns session cookies to use in all subsequent requests
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/auth/test-login`,
    JSON.stringify({
      address: '0x0000000000000000000000000000000000000000000000000000000000000001',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(loginRes, { 'login 200': (r) => r.status === 200 });

  // Extract Set-Cookie headers for session
  const jar = http.cookieJar();
  const cookies = jar.cookiesForURL(BASE_URL);
  return { cookies: loginRes.headers['Set-Cookie'] || '' };
}

export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      Cookie: data.cookies,
    },
  };

  // GET /profiles/:id/summary
  const summary = http.get(
    `${BASE_URL}/profiles/${PROFILE_ID}/summary`,
    Object.assign({}, params, { tags: { endpoint: 'summary' } }),
  );
  check(summary, {
    'summary 200': (r) => r.status === 200,
    'summary has profile': (r) => JSON.parse(r.body).profile !== undefined,
  });

  // GET /profiles/:id
  const profile = http.get(
    `${BASE_URL}/profiles/${PROFILE_ID}`,
    Object.assign({}, params, { tags: { endpoint: 'profile' } }),
  );
  check(profile, { 'profile 200': (r) => r.status === 200 });

  // GET /profiles/:id/wallets
  const wallets = http.get(
    `${BASE_URL}/profiles/${PROFILE_ID}/wallets`,
    Object.assign({}, params, { tags: { endpoint: 'wallets' } }),
  );
  check(wallets, { 'wallets 200': (r) => r.status === 200 });

  // GET /profiles/:id/assets
  const assets = http.get(
    `${BASE_URL}/profiles/${PROFILE_ID}/assets`,
    Object.assign({}, params, { tags: { endpoint: 'assets' } }),
  );
  check(assets, { 'assets 200': (r) => r.status === 200 });

  // GET /profiles/:id/timeline
  const timeline = http.get(
    `${BASE_URL}/profiles/${PROFILE_ID}/timeline?limit=20`,
    Object.assign({}, params, { tags: { endpoint: 'timeline' } }),
  );
  check(timeline, { 'timeline 200': (r) => r.status === 200 });

  sleep(0.5);
}

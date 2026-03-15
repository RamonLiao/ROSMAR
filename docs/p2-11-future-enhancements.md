# P2-11 Performance SLA — Future Enhancements

Decisions made during design to keep scope tight. Revisit when needed.

---

## Bundle Size

- [ ] **size-limit** — More precise per-entry budgets with gzip support. Consider when 300kB overall budget needs finer granularity.
- [ ] **@next/bundle-analyzer** — Visual treemap for dev-time analysis. Useful for hunting large dependencies but not a CI gate.

## Lighthouse CI

- [ ] **DB seeding in CI** — Seed real data so Lighthouse tests profile page with content instead of loading state. Requires CI DB setup complexity.
- [ ] **Profile page Lighthouse audit** — Currently deferred because mock API means Lighthouse only measures loading/error state. Add when DB seeding or MSW stub API is available in CI.
- [ ] **unlighthouse** — Full-site scan across all routes. Too slow for PR CI, but useful as nightly job.
- [ ] **Mobile + Desktop split** — Separate Lighthouse configs with different thresholds. Currently only running mobile preset (Lighthouse default).

## API Latency

- [ ] **Load testing (concurrent users)** — k6 scenarios with ramping VUs. Currently only smoke/SLA test (sequential). Needed before launch.
- [ ] **autocannon** — Node.js native alternative. k6 thresholds are more mature, but autocannon is simpler for quick local benchmarks.
- [ ] **Write endpoint testing** — POST/PUT endpoints (create profile, update deal). Currently only testing read path.
- [ ] **External chain call testing** — Remove `SUI_DRY_RUN=true` mock and test real RPC latency. Requires testnet access in CI.

## Profile Page Optimization

- [ ] **React Server Components** — Stream profile data via RSC. Requires significant App Router restructuring.
- [ ] **GraphQL aggregation** — Single query for flexible data fetching. Adds new dependency (Apollo/urql).
- [ ] **SSR prefetch** — Server-side data fetching for profile page. Unnecessary given BFF aggregation endpoint approach; complexity of forwarding auth cookies to SSR not justified.
- [ ] **Full tab data in summary** — Merge all tab content into summary endpoint. Payload too large; lazy fetch is better UX.

## Web Vitals

- [ ] **DB persistence** — Store vitals in TimescaleDB for trend analysis. Wait until volume/value is clearer.
- [ ] **Dashboard** — Grafana/custom dashboard for vitals trends. Needs sufficient data first.
- [ ] **@vercel/speed-insights** — Drop-in if migrating to Vercel deployment.
- [ ] **CI Web Vitals measurement** — Direct measurement in CI. Lighthouse simulated values are sufficient for now.

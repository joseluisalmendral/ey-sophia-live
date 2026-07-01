// REALISTIC room simulation (non-destructive).
// Models N phones each polling /status every ~3s with jitter (visibility-aware
// cadence the endpoint is designed for) for a fixed duration, PLUS an occasional
// /results poll. Key difference vs the raw burst: this reflects the request RATE
// a real room produces. NOTE: all traffic still originates from ONE IP here, so
// even this is far denser per-IP than a real room of N distinct phones — it is a
// conservative (pessimistic) test. We keep aggregate rate moderate on purpose.
const BASE = "https://ey-sophia-live-joseluisalmendrals-projects.vercel.app";

const PHONES = Number(process.env.PHONES || 120);
const DURATION_S = Number(process.env.DURATION_S || 45);
const POLL_EVERY_MS = 3000; // endpoint cadence target

function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
function jitter(base) { return base + Math.floor((Math.random() - 0.5) * 1200); }

const stats = { total: 0, success: 0, blocks: 0, errors: 0, byCode: {}, cache: {}, latencies: [], errMsgs: {}, mitig: new Set() };

async function poll(path) {
  const t0 = performance.now();
  try {
    const res = await fetch(BASE + path, { redirect: "manual" });
    await res.text();
    stats.latencies.push(performance.now() - t0);
    stats.total++;
    const c = res.status;
    stats.byCode[c] = (stats.byCode[c] || 0) + 1;
    if (c >= 200 && c < 400) stats.success++;
    if ([429, 403, 503].includes(c) || c >= 500) stats.blocks++;
    const xvc = res.headers.get("x-vercel-cache") || "none";
    stats.cache[xvc] = (stats.cache[xvc] || 0) + 1;
    const m = res.headers.get("x-vercel-mitigated");
    if (m) stats.mitig.add(m);
  } catch (e) {
    stats.total++; stats.errors++;
    stats.errMsgs[e.message] = (stats.errMsgs[e.message] || 0) + 1;
  }
}

async function phone(id, endAt) {
  // stagger phone start so polls don't align into a thundering herd
  await new Promise((r) => setTimeout(r, Math.random() * POLL_EVERY_MS));
  while (performance.now() < endAt) {
    // 85% status polls, 15% results polls (results is checked less often)
    await poll(Math.random() < 0.85 ? "/api/poll/DEMO42/status" : "/api/poll/DEMO42/results");
    await new Promise((r) => setTimeout(r, jitter(POLL_EVERY_MS)));
  }
}

async function main() {
  console.log(`REALISTIC ROOM: ${PHONES} phones, poll ~${POLL_EVERY_MS}ms jittered, ${DURATION_S}s`);
  const start = performance.now();
  const endAt = start + DURATION_S * 1000;
  await Promise.all(Array.from({ length: PHONES }, (_, i) => phone(i, endAt)));
  const elapsed = (performance.now() - start) / 1000;

  const sorted = stats.latencies.slice().sort((a, b) => a - b);
  const hit = (stats.cache.HIT || 0) + (stats.cache.STALE || 0);
  const miss = stats.cache.MISS || 0;
  console.log(`\n===== REALISTIC ROOM RESULT =====`);
  console.log(`duration: ${elapsed.toFixed(1)}s`);
  console.log(`total requests: ${stats.total}  (~${(stats.total / elapsed).toFixed(0)} req/s aggregate)`);
  console.log(`success 2xx/3xx: ${stats.success} (${((stats.success / stats.total) * 100).toFixed(2)}%)`);
  console.log(`BLOCKS 429/403/503/5xx: ${stats.blocks}`);
  console.log(`network errors: ${stats.errors} ${JSON.stringify(stats.errMsgs)}`);
  console.log(`status codes: ${JSON.stringify(stats.byCode)}`);
  console.log(`x-vercel-cache: ${JSON.stringify(stats.cache)}`);
  console.log(`cache HIT ratio: ${((hit / stats.total) * 100).toFixed(1)}%  | MISS (origin/Supabase): ${miss}`);
  console.log(`latency ms: p50=${pct(sorted,50).toFixed(0)} p95=${pct(sorted,95).toFixed(0)} p99=${pct(sorted,99).toFixed(0)} max=${sorted[sorted.length-1]?.toFixed(0)}`);
  console.log(`mitigations: ${stats.mitig.size ? [...stats.mitig].join(",") : "NONE"}`);
}
main().catch((e) => { console.error(e); process.exit(1); });

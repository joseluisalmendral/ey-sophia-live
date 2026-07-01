// Non-destructive ABUSE / BURST test. Simulates a full room of phones polling.
// ~200 concurrent GETs per wave, waves repeated for ~50s. Then a burst to /results.
const BASE = "https://ey-sophia-live-joseluisalmendrals-projects.vercel.app";

// Vercel serves HTTP/2; Node's global fetch (undici) multiplexes many concurrent
// streams over a single H2 connection, so a Promise.all of 200 fetches fires as a
// real concurrent burst. We measure achieved concurrency empirically per wave.

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function oneReq(path, stats) {
  stats.inflight = (stats.inflight || 0) + 1;
  if (stats.inflight > (stats.peakInflight || 0)) stats.peakInflight = stats.inflight;
  const t0 = performance.now();
  try {
    const res = await fetch(BASE + path, { method: "GET", redirect: "manual" });
    // drain body so connection is reusable / accurate timing
    await res.text();
    const ms = performance.now() - t0;
    stats.latencies.push(ms);
    stats.total++;
    const code = res.status;
    stats.byCode[code] = (stats.byCode[code] || 0) + 1;
    if (code >= 200 && code < 400) stats.success++;
    if ([429, 403, 503].includes(code) || code >= 500) stats.blocks++;
    const xvc = res.headers.get("x-vercel-cache") || "none";
    stats.cache[xvc] = (stats.cache[xvc] || 0) + 1;
    // capture any firewall / challenge signals
    const server = res.headers.get("server") || "";
    const mitig = res.headers.get("x-vercel-mitigated") || res.headers.get("x-vercel-protection");
    if (mitig) stats.mitigations.add(mitig);
    if (code === 403 || code === 429 || code === 503) {
      stats.sampleBlockHeaders = stats.sampleBlockHeaders || [];
      if (stats.sampleBlockHeaders.length < 3) {
        stats.sampleBlockHeaders.push({ code, server, xvc, mitig });
      }
    }
  } catch (e) {
    stats.total++;
    stats.errors++;
    stats.errMsgs[e.code || e.message] = (stats.errMsgs[e.code || e.message] || 0) + 1;
  } finally {
    stats.inflight--;
  }
}

async function wave(path, concurrency, stats) {
  const jobs = [];
  for (let i = 0; i < concurrency; i++) jobs.push(oneReq(path, stats));
  await Promise.all(jobs);
}

function report(name, stats, elapsedMs) {
  const sorted = stats.latencies.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const hit = (stats.cache.HIT || 0) + (stats.cache.STALE || 0);
  const miss = stats.cache.MISS || 0;
  const hitRatio = stats.total ? ((hit / stats.total) * 100).toFixed(1) : "0";
  console.log(`\n===== ${name} =====`);
  console.log(`duration: ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`total requests: ${stats.total}`);
  console.log(`success (2xx/3xx): ${stats.success} (${((stats.success / stats.total) * 100).toFixed(2)}%)`);
  console.log(`BLOCKS (429/403/503/5xx): ${stats.blocks}`);
  console.log(`network errors: ${stats.errors} ${JSON.stringify(stats.errMsgs)}`);
  console.log(`status codes: ${JSON.stringify(stats.byCode)}`);
  console.log(`x-vercel-cache: ${JSON.stringify(stats.cache)}  => cache HIT ratio: ${hitRatio}%`);
  console.log(`cache MISS (origin/Supabase hits): ${miss}`);
  console.log(`latency ms: min=${sorted[0]?.toFixed(0)} p50=${pct(sorted,50).toFixed(0)} p95=${pct(sorted,95).toFixed(0)} p99=${pct(sorted,99).toFixed(0)} max=${sorted[sorted.length-1]?.toFixed(0)} avg=${(sum/sorted.length).toFixed(0)}`);
  console.log(`throughput: ${(stats.total / (elapsedMs / 1000)).toFixed(0)} req/s | peak concurrent in-flight: ${stats.peakInflight}`);
  if (stats.mitigations.size) console.log(`!! MITIGATION HEADERS: ${[...stats.mitigations].join(",")}`);
  if (stats.sampleBlockHeaders) console.log(`!! BLOCK SAMPLES: ${JSON.stringify(stats.sampleBlockHeaders)}`);
}

function newStats() {
  return { total: 0, success: 0, blocks: 0, errors: 0, byCode: {}, cache: {}, latencies: [], errMsgs: {}, mitigations: new Set() };
}

async function sustained(path, concurrency, seconds, stats) {
  const start = performance.now();
  let waves = 0;
  while ((performance.now() - start) / 1000 < seconds) {
    await wave(path, concurrency, stats);
    waves++;
  }
  return { elapsed: performance.now() - start, waves };
}

async function main() {
  const CONC = 200;
  const SECS = 50;

  console.log(`ROOM SIM: ${CONC} concurrent GETs/wave, sustained ~${SECS}s -> /api/poll/DEMO42/status`);
  const statusStats = newStats();
  const s1 = await sustained("/api/poll/DEMO42/status", CONC, SECS, statusStats);
  console.log(`  (completed ${s1.waves} waves)`);
  report("STATUS BURST /api/poll/DEMO42/status", statusStats, s1.elapsed);

  console.log(`\nRESULTS BURST: ${CONC} concurrent GETs -> /api/poll/DEMO42/results`);
  const resultsStats = newStats();
  const t0 = performance.now();
  await wave("/api/poll/DEMO42/results", CONC, resultsStats);
  report("RESULTS BURST /api/poll/DEMO42/results", resultsStats, performance.now() - t0);

  // Second-angle sustained burst to the actual page (heavier: SSR)
  console.log(`\nPAGE BURST (second angle): 60 concurrent -> /vote/DEMO42 for ~15s`);
  const pageStats = newStats();
  const p = await sustained("/vote/DEMO42", 60, 15, pageStats);
  console.log(`  (completed ${p.waves} waves)`);
  report("PAGE BURST /vote/DEMO42", pageStats, p.elapsed);
}

main().catch((e) => { console.error(e); process.exit(1); });

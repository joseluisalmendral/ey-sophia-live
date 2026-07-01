// Non-destructive prod test: Sections 1, 2, 3. Node 24 global fetch.
const BASE = "https://ey-sophia-live-joseluisalmendrals-projects.vercel.app";
const UUID = "f79a69dc-b337-479b-b3d3-c11b03220dc6";

function hdr(res, name) {
  return res.headers.get(name);
}

async function head(path) {
  const t0 = performance.now();
  const res = await fetch(BASE + path, { method: "GET", redirect: "manual" });
  const body = await res.text();
  const ms = (performance.now() - t0).toFixed(0);
  return { status: res.status, ms, res, body };
}

function checkNoCookie(res) {
  return res.headers.get("set-cookie") ? "SET-COOKIE PRESENT!" : "none";
}

async function main() {
  console.log("=== SECTION 1: PAGES ===");
  for (const p of ["/", "/vote/DEMO42", "/screen/DEMO42", "/vote/NOPE", "/screen/NOPE"]) {
    const r = await head(p);
    console.log(`GET ${p} -> ${r.status} (${r.ms}ms)`);
  }
  // brand + team names in /vote HTML
  const vote = await head("/vote/DEMO42");
  const html = vote.body;
  const brandHits = ["EY", "Sophia", "sophia"].filter((s) => html.includes(s));
  console.log(`/vote/DEMO42 HTML length=${html.length}; brand tokens found: ${brandHits.join(",") || "NONE"}`);
  // try to surface visible team-ish names heuristically
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  console.log(`  <title>: ${titleMatch ? titleMatch[1] : "n/a"}`);

  console.log("\n=== SECTION 2: ENDPOINT CORRECTNESS ===");
  const endpoints = [
    ["/api/poll/DEMO42/status", "status by join_code"],
    [`/api/poll/${UUID}/status`, "status by uuid"],
    ["/api/poll/DEMO42/results", "results by join_code"],
    [`/api/poll/${UUID}/results`, "results by uuid"],
    ["/api/poll/NOPE/status", "unknown status -> 404"],
    ["/api/poll/NOPE/results", "unknown results -> 404"],
  ];
  for (const [p, label] of endpoints) {
    const r = await head(p);
    const cc = hdr(r.res, "cache-control");
    const cookie = checkNoCookie(r.res);
    const ct = hdr(r.res, "content-type");
    let json = null;
    try { json = JSON.parse(r.body); } catch {}
    console.log(`\n[${label}] GET ${p} -> ${r.status} (${r.ms}ms)`);
    console.log(`  cache-control: ${cc}`);
    console.log(`  set-cookie: ${cookie}`);
    console.log(`  content-type: ${ct}`);
    console.log(`  body: ${JSON.stringify(json)?.slice(0, 300)}`);
  }

  console.log("\n=== SECTION 3: CDN CACHE PROOF (/api/poll/DEMO42/status x12) ===");
  const seq = [];
  for (let i = 0; i < 12; i++) {
    const r = await head("/api/poll/DEMO42/status");
    const xvc = hdr(r.res, "x-vercel-cache");
    const age = hdr(r.res, "age");
    seq.push(xvc);
    console.log(`  hit ${String(i + 1).padStart(2)}: x-vercel-cache=${xvc} age=${age} status=${r.status} ${r.ms}ms`);
    await new Promise((res) => setTimeout(res, 500));
  }
  const counts = seq.reduce((a, c) => ((a[c] = (a[c] || 0) + 1), a), {});
  console.log("  sequence summary:", JSON.stringify(counts));
}

main().catch((e) => { console.error(e); process.exit(1); });

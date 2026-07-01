// Diagnose the 403 and the "fetch failed" errors from the aggressive burst.
const BASE = "https://ey-sophia-live-joseluisalmendrals-projects.vercel.app";

// 1) Inspect a 403 body + full headers (is it Vercel Attack Challenge / firewall?)
async function inspect403() {
  console.log("=== Probing for 403 firewall response (fast burst of 60) ===");
  const jobs = [];
  for (let i = 0; i < 60; i++) {
    jobs.push(
      fetch(BASE + "/api/poll/DEMO42/status").then(async (r) => ({
        code: r.status,
        mitig: r.headers.get("x-vercel-mitigated"),
        xvc: r.headers.get("x-vercel-cache"),
        body: r.status === 403 ? (await r.text()).slice(0, 400) : null,
        headers: r.status === 403 ? Object.fromEntries([...r.headers]) : null,
      })).catch((e) => ({ err: e.code || e.message })),
    );
  }
  const res = await Promise.all(jobs);
  const codes = res.reduce((a, r) => ((a[r.code || r.err] = (a[r.code || r.err] || 0) + 1), a), {});
  console.log("outcome distribution:", JSON.stringify(codes));
  const first403 = res.find((r) => r.code === 403);
  if (first403) {
    console.log("\n403 BODY:", first403.body);
    console.log("403 HEADERS:", JSON.stringify(first403.headers, null, 2));
  } else {
    console.log("No 403 observed in this milder burst.");
  }
}

// 2) Diagnose a "fetch failed" cause
async function inspectFetchFailed() {
  console.log("\n=== Triggering & diagnosing fetch-failed (burst 300) ===");
  const jobs = [];
  for (let i = 0; i < 300; i++) {
    jobs.push(
      fetch(BASE + "/api/poll/DEMO42/status")
        .then((r) => r.text().then(() => ({ ok: r.status })))
        .catch((e) => ({ err: e.message, cause: e.cause ? (e.cause.code || e.cause.message) : null })),
    );
  }
  const res = await Promise.all(jobs);
  const fails = res.filter((r) => r.err);
  const okCodes = res.filter((r) => r.ok).reduce((a, r) => ((a[r.ok] = (a[r.ok] || 0) + 1), a), {});
  const failCauses = fails.reduce((a, r) => ((a[r.cause || r.err] = (a[r.cause || r.err] || 0) + 1), a), {});
  console.log("ok status codes:", JSON.stringify(okCodes));
  console.log("fetch-failed count:", fails.length, "causes:", JSON.stringify(failCauses));
}

await inspect403();
await inspectFetchFailed();

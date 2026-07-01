// SECTION 5: /api/vote NON-DESTRUCTIVE test.
// Poll is DRAFT, so cast_vote must return {result:'not_open'} and NOT mutate.
// We verify team_tallies stays all-zero before AND after. Sample latency a few times.
const BASE = "https://ey-sophia-live-joseluisalmendrals-projects.vercel.app";
const SUPABASE_URL = "https://soiekjltkigbmohtpznq.supabase.co";
const KEY = "sb_publishable_4XogGtUVscWyq6hSR9djBg_fih9bUaL";
const POLL_UUID = "f79a69dc-b337-479b-b3d3-c11b03220dc6";

async function tallies() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/team_tallies?poll_id=eq.${POLL_UUID}&select=team_id,count`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const j = await res.json();
  return j;
}

async function realTeamId() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/teams?poll_id=eq.${POLL_UUID}&select=id,name&order=position&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const j = await res.json();
  return j[0];
}

async function main() {
  const team = await realTeamId();
  console.log(`Using real teamId: ${team.id} (${team.name})`);

  const before = await tallies();
  const beforeZero = before.every((t) => Number(t.count) === 0);
  console.log(`tallies BEFORE: all-zero? ${beforeZero} -> ${JSON.stringify(before.map(t => t.count))}`);

  console.log("\nPOSTing vote to DRAFT poll (expect not_open, no mutation):");
  const results = [];
  const lat = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId: POLL_UUID, teamId: team.id }),
      redirect: "manual",
    });
    const ms = performance.now() - t0;
    lat.push(ms);
    const setCookie = res.headers.get("set-cookie");
    const cc = res.headers.get("cache-control");
    let body; try { body = await res.json(); } catch { body = await res.text(); }
    results.push({ status: res.status, body, cc, setCookie: setCookie ? "yes" : "no" });
    console.log(`  #${i + 1}: ${res.status} body=${JSON.stringify(body)} cache-control="${cc}" set-cookie=${setCookie ? "yes(expected on vote path)" : "no"} ${ms.toFixed(0)}ms`);
  }
  const sorted = lat.slice().sort((a, b) => a - b);
  console.log(`  latency ms: min=${sorted[0].toFixed(0)} med=${sorted[Math.floor(sorted.length/2)].toFixed(0)} max=${sorted[sorted.length-1].toFixed(0)}`);

  const after = await tallies();
  const afterZero = after.every((t) => Number(t.count) === 0);
  console.log(`\ntallies AFTER: all-zero? ${afterZero} -> ${JSON.stringify(after.map(t => t.count))}`);
  console.log(`\nVERDICT: ${results.every(r => r.body && r.body.result === "not_open") && afterZero ? "PASS - not_open, DB untouched" : "CHECK - unexpected"}`);
}
main().catch(e => { console.error(e); process.exit(1); });

// SECTION 6: Supabase-side check via publishable REST (anon read path).
// Non-destructive: only SELECTs + the read-only get_results RPC.
const SUPABASE_URL = "https://soiekjltkigbmohtpznq.supabase.co";
const KEY = "sb_publishable_4XogGtUVscWyq6hSR9djBg_fih9bUaL";
const UUID = "f79a69dc-b337-479b-b3d3-c11b03220dc6";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function rest(path) {
  const t0 = performance.now();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H });
  const ms = (performance.now() - t0).toFixed(0);
  const body = await res.text();
  let json; try { json = JSON.parse(body); } catch { json = body; }
  return { status: res.status, ms, json };
}

async function main() {
  console.log("=== SECTION 6: SUPABASE ANON READ PATH ===");

  const poll = await rest(`polls?join_code=eq.DEMO42&select=id,join_code,status,opens_at,closes_at`);
  console.log(`polls (by join_code): ${poll.status} ${poll.ms}ms ->`, JSON.stringify(poll.json));

  const teams = await rest(`teams?poll_id=eq.${UUID}&select=id,name,color,position&order=position`);
  console.log(`teams: ${teams.status} ${teams.ms}ms -> ${Array.isArray(teams.json) ? teams.json.length + " teams" : JSON.stringify(teams.json)}`);
  if (Array.isArray(teams.json)) console.log("  ", teams.json.map(t => t.name).join(" | "));

  const tallies = await rest(`team_tallies?poll_id=eq.${UUID}&select=team_id,count`);
  console.log(`team_tallies: ${tallies.status} ${tallies.ms}ms ->`, JSON.stringify(tallies.json));
  if (Array.isArray(tallies.json)) {
    const nonZero = tallies.json.filter(t => Number(t.count) !== 0);
    console.log(`  ALL-ZERO? ${nonZero.length === 0 ? "YES (0 votes, clean)" : "NO -> " + JSON.stringify(nonZero)}`);
  }

  // read-only results RPC
  const rpc = await (async () => {
    const t0 = performance.now();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_results`, {
      method: "POST", headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ p_poll_id: UUID }),
    });
    const ms = (performance.now() - t0).toFixed(0);
    let j; try { j = await res.json(); } catch { j = null; }
    return { status: res.status, ms, j };
  })();
  console.log(`rpc get_results: ${rpc.status} ${rpc.ms}ms -> ${Array.isArray(rpc.j) ? rpc.j.length + " rows, counts=[" + rpc.j.map(r=>r.count).join(",") + "]" : JSON.stringify(rpc.j)}`);

  // quick Supabase-side burst to confirm no 429 on the anon read path
  console.log("\n=== Supabase anon read burst (100 concurrent SELECTs) ===");
  const jobs = Array.from({ length: 100 }, () =>
    fetch(`${SUPABASE_URL}/rest/v1/polls?join_code=eq.DEMO42&select=status`, { headers: H })
      .then(r => r.status).catch(e => "ERR:" + e.message));
  const codes = await Promise.all(jobs);
  const dist = codes.reduce((a, c) => ((a[c] = (a[c] || 0) + 1), a), {});
  console.log("  status distribution:", JSON.stringify(dist));
  console.log("  any 429?", codes.includes(429) ? "YES - RATE LIMITED" : "NO");
}
main().catch(e => { console.error(e); process.exit(1); });

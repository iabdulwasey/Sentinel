const BASE = process.env.BASE ?? "http://localhost:3010";

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "reviewer@bolt.eu", password: "sentinel" }) });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  const questions = [
    "Which fleet partners are at risk right now, and why?",
    "What vehicle documents are expiring in the next 30 days?",
    "Summarize the open authority request from the Estonian regulator.",
  ];
  for (const q of questions) {
    const t0 = Date.now();
    try {
      const r = await fetch(`${BASE}/api/assistant`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ question: q }) });
      const j = await r.json();
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      if (j.ok) console.log(`OK  ${sec}s  grounded=${j.data.grounded} cites=${j.data.citations.length} :: ${j.data.answer.slice(0, 90).replace(/\n/g, " ")}`);
      else console.log(`ERR ${sec}s [${r.status}] :: ${String(j.error).slice(0, 140)}`);
    } catch (e) {
      console.log(`THROW ${((Date.now() - t0) / 1000).toFixed(1)}s :: ${e instanceof Error ? e.message : e}`);
    }
  }
}
main().then(() => process.exit(0));
export {};

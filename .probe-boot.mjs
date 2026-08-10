/* TEMPORARY probe — boot timeline via CDP. Deleted after use. */
const BASE = "http://localhost:9222";
const TARGET = process.argv[2];

const tab = await fetch(`${BASE}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" }).then((r) => r.json());
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
};

await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url: TARGET });

const started = Date.now();
for (let i = 0; i < 40; i++) {
  const res = await send("Runtime.evaluate", {
    expression: `(() => {
      const l = document.getElementById('root-loader-wrapper');
      return {
        loader: !!l,
        hidden: l ? l.classList.contains('cf-loader-hidden') : null,
        spinner: !!document.querySelector('.cf-rubik-lateral, .cf-rubik-lateral-spinner'),
        text: document.body.innerText.slice(0, 60).replace(/\\n/g, ' | '),
      };
    })()`,
    returnByValue: true,
  });
  const v = res && res.result && res.result.value;
  if (v) console.log(`${String(Date.now() - started).padStart(4)}ms loader=${v.loader} hidden=${v.hidden} spinner=${v.spinner} | ${v.text}`);
  await new Promise((r) => setTimeout(r, 200));
}
ws.close();
process.exit(0);

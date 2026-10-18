// Visits every tab of the current workspace so each pane mounts, then restores the selection.
// usage: node warm.mjs [reload]
import { connect, sleep } from "./lib.mjs";

const { send, ev, close } = await connect();
await send("Page.bringToFront");
if (process.argv[2] === "reload") {
  await send("Page.reload", { ignoreCache: true });
  await sleep(9000);
}
const r = await ev(`(async()=>{const tabs=[...document.querySelectorAll('[role=tab][id^=tab-]')];
  const sel=[...document.querySelectorAll('[role=tab][aria-selected=true]')].map(e=>e.id);
  for(const e of tabs){e.click();await new Promise(r=>setTimeout(r,3500));}
  for(const s of sel)document.getElementById(s)?.click();await new Promise(r=>setTimeout(r,3000));
  return {tabs:tabs.length,dom:document.querySelectorAll('*').length,profiling:typeof __perf==='object',visibility:document.visibilityState}})()`);
console.log(JSON.stringify(r));
close();
process.exit(0);

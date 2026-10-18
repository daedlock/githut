// Loads a workspace layout into the app tab and reloads.
// usage: node setws.mjs <workspace.json>   (e.g. ../workspaces/reference.json)
import { readFile } from "node:fs/promises";
import { accountScope, connect } from "./lib.mjs";

const file = process.argv[2];
if (!file) {
  console.log("usage: setws.mjs <workspace.json>");
  process.exit(2);
}
const raw = JSON.stringify(JSON.parse(await readFile(file, "utf8")));
const { ev, close } = await connect();
const scope = await accountScope(ev);
if (!scope) throw new Error("not signed in: no githut.workspace.*.account.<id> key in storage");
await ev(
  `(sessionStorage.setItem('githut.workspace.window.account.${scope}',${JSON.stringify(raw)}),localStorage.setItem('githut.workspace.account.${scope}',${JSON.stringify(raw)}),location.href='/',1)`,
);
console.log(`workspace ${file} set for account ${scope}`);
close();
process.exit(0);

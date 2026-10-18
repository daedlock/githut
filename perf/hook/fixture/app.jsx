import { Activity, createContext, memo, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/profiling";

const Ctx = createContext(0);
function Leaf({ n }) {
  let x = 0;
  for (let i = 0; i < 2e5; i++) x += i;
  return (
    <span>
      {n}
      {x > 0 ? "" : "!"}
    </span>
  );
}
const MemoLeaf = memo(function MemoLeaf({ n }) {
  return <i>{n}</i>;
});
function CtxReader() {
  const v = useContext(Ctx);
  return <b>{v}</b>;
}
const MemoCtxReader = memo(CtxReader);
function Counter() {
  const [c, setC] = useState(0);
  useEffect(() => {
    window.__bumpCounter = () => setC((v) => v + 1);
  }, []);
  return <Leaf n={c} />;
}
function Pane({ id, tick }) {
  return (
    <div data-tab-pane={id}>
      <Leaf n={tick} />
      <MemoLeaf n={1} />
      <MemoCtxReader />
    </div>
  );
}
function SidebarThing({ tick }) {
  return (
    <aside id="workspace-sidebar">
      <Leaf n={tick} />
    </aside>
  );
}
function Dialog({ tick }) {
  return createPortal(
    <div role="dialog">
      <Leaf n={tick} />
    </div>,
    document.body,
  );
}

function App() {
  const [tick, setTick] = useState(0);
  const [ctx, setCtx] = useState(0);
  useEffect(() => {
    window.__tick = () => setTick((t) => t + 1);
    window.__ctx = () => setCtx((t) => t + 1);
  }, []);
  return (
    <Ctx.Provider value={ctx}>
      <SidebarThing tick={tick} />
      <section data-island="i1" data-focused="">
        <Activity mode="visible">
          <Pane id="paneA" tick={tick} />
        </Activity>
        <Activity mode="hidden">
          <Pane id="paneB" tick={tick} />
        </Activity>
      </section>
      <section data-island="i2">
        <Pane id="paneC" tick={tick} />
      </section>
      <section data-island="i3" style={{ display: "none" }}>
        <Pane id="paneD" tick={tick} />
      </section>
      <Dialog tick={tick} />
      <Counter />
    </Ctx.Provider>
  );
}

const out = (id, v) => {
  const pre = document.createElement("pre");
  pre.id = id;
  pre.textContent = JSON.stringify(v);
  document.documentElement.appendChild(pre);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  try {
    __perf.start("mount");
    createRoot(document.getElementById("root")).render(<App />);
    await wait(300);
    out("mount", __perf.stop());
    __perf.start("tick");
    window.__tick();
    await wait(300);
    out("tick", __perf.stop());
    __perf.start("ctx");
    window.__ctx();
    await wait(300);
    out("ctx", __perf.stop());
    __perf.start("counter");
    window.__bumpCounter();
    await wait(300);
    out("counter", __perf.stop());
    out("raw-counter", __perf.raw());
  } catch (e) {
    out("error", String((e && e.stack) || e));
  }
  document.title = "DONE";
})();

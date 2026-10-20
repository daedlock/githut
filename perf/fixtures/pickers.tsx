import { Activity, useState } from "react";
import { createRoot } from "react-dom/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { SidebarPicker } from "@/app/features/pulls/components/SidebarPicker";
import { useAuthStore } from "@/app/stores/auth";
import "@/app/styles/index.css";

useAuthStore.setState({ token: "picker-fixture", expired: false });
const labels = Array.from({ length: 100 }, (_, i) => ({
  id: `label-${i}`,
  label: `Label ${i}`,
  color: "228833",
}));
const reviewers = Array.from({ length: 100 }, (_, i) => ({
  id: `reviewer-${i}`,
  label: `Reviewer ${i}`,
}));
const heavy = Array.from(
  { length: Number(new URLSearchParams(location.search).get("size") ?? 3000) },
  (_, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: immutable generated performance fixture
    <article key={i} className="p-3 text-body">
      <p>
        <strong>Conversation {i}</strong>
        <span> background content </span>
        <a href="#fixture-link">a link</a>
      </p>
      <pre>
        <code>const value = {i};</code>
      </pre>
      <div>
        <span>Reply</span>
        <span>React</span>
      </div>
    </article>
  ),
);

function Fixture() {
  const [shown, setShown] = useState(true);
  const [mounted, setMounted] = useState(true);
  const [pressed, setPressed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set<string>());
  const toggle = (id: string, next: boolean) =>
    setSelected((prev) => {
      const result = new Set(prev);
      if (next) result.add(id);
      else result.delete(id);
      return result;
    });
  return (
    <>
      <button
        type="button"
        id="switch-tab"
        onPointerDown={() => setShown((value) => !value)}
        onClick={(event) => {
          if (event.detail === 0) setShown((value) => !value);
        }}
      >
        Switch tab
      </button>
      <button type="button" id="loading" onClick={() => setLoading((value) => !value)}>
        Toggle pending data
      </button>
      <button type="button" id="close-tab" onPointerDown={() => setMounted(false)}>
        Close tab
      </button>
      {mounted && (
        <Activity mode={shown ? "visible" : "hidden"}>
          <div
            data-tab-pane="picker-fixture"
            className="absolute left-80 top-20 h-96 w-96 overflow-auto"
          >
            <SidebarPicker
              title="Reviewers"
              ariaLabel="Edit reviewers"
              items={reviewers}
              selectedIds={selected}
              onToggle={toggle}
              loading={loading}
            />
            <SidebarPicker
              title="Labels"
              ariaLabel="Edit labels"
              items={labels}
              selectedIds={selected}
              onToggle={toggle}
              loading={loading}
            />
            <Popover>
              <PopoverTrigger asChild>
                <button type="button">Open shared popup</button>
              </PopoverTrigger>
              <PopoverContent style={{ width: 280 }}>
                <button type="button" onClick={() => setPressed(true)}>
                  {pressed ? "Pressed" : "Press popup action"}
                </button>
              </PopoverContent>
            </Popover>
            <div className="h-[1000px]" />
          </div>
        </Activity>
      )}
      <div className="absolute top-[1500px]">{heavy}</div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);

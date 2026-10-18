/*
 * Minimal React commit recorder. Inject as the FIRST <script> in <head>, before
 * React loads. Works with react-dom/profiling (actualDuration populated).
 * Not React DevTools: no Store, no bridge, no fiber IDs. See COMMIT-HOOK.md.
 *
 *   __perf.start("label")  -> begin recording commits
 *   __perf.stop()          -> JSON-serializable summary (also stops recording)
 *   __perf.reset()         -> clear buffers
 *   __perf.raw()           -> per-commit records (compact)
 */
(() => {
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.warn("[commit-hook] a DevTools hook already exists; not installing");
    return;
  }

  // React 19 work tags
  var FunctionComponent = 0,
    ClassComponent = 1,
    HostPortal = 4,
    HostComponent = 5,
    ForwardRef = 11,
    MemoComponent = 14,
    SimpleMemoComponent = 15,
    OffscreenComponent = 22,
    HostHoistable = 26,
    HostSingleton = 27;
  var PerformedWork = 1;

  var renderers = new Map();
  var nextId = 1;

  var recording = false;
  var label = null;
  var startedAt = 0;
  var commits = []; // raw per-commit records
  var errors = [];

  // Aggregates
  var byComponent = new Map();
  var byLocation = {};
  var byPane = {};

  // Per-commit caches
  var elInfoCache = new WeakMap(); // Element -> {loc, pane, island}; reset per commit
  var visCache = new Map(); // Element (pane/island) -> visible boolean; reset per commit

  function getName(fiber) {
    var t = fiber.type;
    if (t == null) return "Anonymous";
    if (typeof t === "function") return t.displayName || t.name || "Anonymous";
    if (typeof t === "object") {
      if (t.displayName) return t.displayName;
      if (t.render) return t.render.displayName || t.render.name || "ForwardRef";
      if (t.type) {
        var inner = t.type;
        if (typeof inner === "function") return inner.displayName || inner.name || "Memo";
        if (inner && inner.render) return inner.render.displayName || inner.render.name || "Memo";
      }
    }
    return "Anonymous";
  }

  function isComponent(tag) {
    // MemoComponent (14) is skipped: its inner component has its own fiber and is
    // counted there. SimpleMemoComponent (15) is a single fiber and is counted.
    return (
      tag === FunctionComponent ||
      tag === ClassComponent ||
      tag === ForwardRef ||
      tag === SimpleMemoComponent
    );
  }

  function changedPropKeys(prev, next) {
    var out = [];
    if (prev === next) return out;
    if (!prev || !next || typeof prev !== "object" || typeof next !== "object") return ["<props>"];
    var k;
    for (k in next) {
      if (k === "children" ? prev[k] !== next[k] : !Object.is(prev[k], next[k])) out.push(k);
    }
    for (k in prev) if (!(k in next)) out.push(k);
    return out;
  }

  // Only stateful hooks (with an update queue: useState/useReducer/useSyncExternalStore/
  // useTransition/useActionState/useOptimistic). Effects/memos change identity on
  // every render and would make every update look like a state change.
  function stateChanged(fiber, alt) {
    if (fiber.tag === ClassComponent) return fiber.memoizedState !== alt.memoizedState;
    var a = fiber.memoizedState,
      b = alt.memoizedState,
      i = 0;
    while (a && b && i < 200) {
      if (a.queue != null && !Object.is(a.memoizedState, b.memoizedState)) return true;
      a = a.next;
      b = b.next;
      i++;
    }
    return false;
  }

  function contextChanged(fiber, alt) {
    var d1 = fiber.dependencies,
      d2 = alt.dependencies;
    if (!d1 || !d2) return false;
    var a = d1.firstContext,
      b = d2.firstContext;
    while (a && b) {
      if (a.context !== b.context) return false; // shape changed; can't attribute
      if (!Object.is(a.memoizedValue, b.memoizedValue)) return true;
      a = a.next;
      b = b.next;
    }
    return false;
  }

  function isVisible(el) {
    var v = visCache.get(el);
    if (v === undefined) {
      v = el.checkVisibility
        ? el.checkVisibility()
        : !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      visCache.set(el, v);
    }
    return v;
  }

  var OVERLAY_SEL =
    '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[role="tooltip"],' +
    "[data-radix-popper-content-wrapper],[data-link-menu-content],[cmdk-root]";

  // Classify where a host element lives. Cached per element per commit.
  function classifyEl(el) {
    if (!el || el.nodeType !== 1) return { loc: "shell", pane: null, island: null, root: el };
    var c = elInfoCache.get(el);
    if (c) return c;
    var pane = el.closest("[data-tab-pane]");
    var island = el.closest("[data-island]");
    var info = {
      loc: "shell",
      pane: pane ? pane.getAttribute("data-tab-pane") : null,
      island: island ? island.getAttribute("data-island") : null,
      paneEl: pane,
      islandEl: island,
    };
    if (el.closest(OVERLAY_SEL) || !el.closest("#root")) info.loc = "overlay";
    else if (el.closest("#workspace-sidebar")) info.loc = "sidebar";
    else if (pane) {
      if (!isVisible(pane)) info.loc = "hidden";
      else if (island && !island.hasAttribute("data-focused")) info.loc = "otherIsland";
      else info.loc = "visible";
    } else if (island) {
      info.loc = !isVisible(island)
        ? "hidden"
        : island.hasAttribute("data-focused")
          ? "visible"
          : "otherIsland";
    }
    elInfoCache.set(el, info);
    return info;
  }

  function bump(obj, key, n) {
    obj[key] = (obj[key] || 0) + (n || 1);
  }

  // Walk the committed tree. Iterative DFS carrying (hostParentElement, offscreenHidden).
  function walkCommit(root, priority) {
    var t = performance.now() - startedAt;
    var current = root.current;
    elInfoCache = new WeakMap();
    visCache = new Map();
    var rec = {
      t: Math.round(t * 100) / 100,
      duration: current.actualDuration || 0,
      priority: priority,
      fibers: 0,
      f: [],
    };

    var container = root.containerInfo;
    var stack = [current.child, container, false];
    while (stack.length) {
      var hidden = stack.pop();
      var hostEl = stack.pop();
      var fiber = stack.pop();
      while (fiber) {
        var alt = fiber.alternate;
        var mount = alt === null;
        var tag = fiber.tag;

        // Prune: subtree children weren't reconciled in this commit.
        var childrenTouched = mount || fiber.child !== alt.child;

        if (isComponent(tag)) {
          var rendered = mount || (fiber.flags & PerformedWork) === PerformedWork;
          if (rendered) recordFiber(fiber, alt, mount, hostEl, hidden, rec);
        }

        if (childrenTouched && fiber.child) {
          var childHost = hostEl;
          var childHidden = hidden;
          if (tag === HostComponent || tag === HostSingleton || tag === HostHoistable) {
            if (fiber.stateNode && fiber.stateNode.nodeType === 1) childHost = fiber.stateNode;
          } else if (tag === HostPortal) {
            childHost = fiber.stateNode && fiber.stateNode.containerInfo;
          } else if (tag === OffscreenComponent && fiber.memoizedState !== null) {
            childHidden = true;
          }
          if (fiber.sibling) stack.push(fiber.sibling, hostEl, hidden);
          fiber = fiber.child;
          hostEl = childHost;
          hidden = childHidden;
          continue;
        }
        fiber = fiber.sibling;
      }
    }
    commits.push(rec);
  }

  function recordFiber(fiber, alt, mount, hostEl, offscreenHidden, rec) {
    var name = getName(fiber);
    var actual = fiber.actualDuration || 0;
    var self = actual;
    for (var c = fiber.child; c; c = c.sibling) self -= c.actualDuration || 0;
    if (self < 0) self = 0;

    var why = mount ? "mount" : null;
    var keys = null;
    var reasons = [];
    if (!mount) {
      if (fiber.memoizedProps !== alt.memoizedProps) {
        keys = changedPropKeys(alt.memoizedProps, fiber.memoizedProps);
        if (keys.length) reasons.push("props");
      }
      if (stateChanged(fiber, alt)) reasons.push("state");
      if (contextChanged(fiber, alt)) reasons.push("context");
      if (!reasons.length) reasons.push("parent");
      why = reasons.join("+");
    }

    var info = classifyEl(hostEl);
    var loc = offscreenHidden ? "hidden" : info.loc;

    rec.fibers++;
    rec.f.push([
      name,
      round(actual),
      round(self),
      round(fiber.selfBaseDuration || 0),
      why,
      loc,
      info.pane,
      info.island,
      keys && keys.length ? keys.slice(0, 8) : undefined,
    ]);

    var e = byComponent.get(name);
    if (!e) {
      e = {
        name: name,
        renders: 0,
        mounts: 0,
        totalActual: 0,
        totalSelf: 0,
        maxActual: 0,
        selfBaseDuration: 0,
        why: { props: 0, state: 0, context: 0, parent: 0 },
        propKeys: {},
        locations: {},
        panes: {},
      };
      byComponent.set(name, e);
    }
    e.renders++;
    if (mount) e.mounts++;
    e.totalActual += actual;
    e.totalSelf += self;
    if (actual > e.maxActual) e.maxActual = actual;
    e.selfBaseDuration = fiber.selfBaseDuration || 0;
    for (var i = 0; i < reasons.length; i++) e.why[reasons[i]]++;
    if (keys) for (var j = 0; j < keys.length && j < 8; j++) bump(e.propKeys, keys[j]);
    bump(e.locations, loc);
    if (info.pane) bump(e.panes, info.pane);

    var L = byLocation[loc] || (byLocation[loc] = { renders: 0, totalActual: 0, totalSelf: 0 });
    L.renders++;
    L.totalActual += actual;
    L.totalSelf += self;

    if (info.pane) {
      var P =
        byPane[info.pane] ||
        (byPane[info.pane] = {
          island: info.island,
          renders: 0,
          totalActual: 0,
          totalSelf: 0,
          hiddenRenders: 0,
          hidden: false,
        });
      P.renders++;
      P.totalActual += actual;
      P.totalSelf += self;
      if (loc === "hidden") P.hiddenRenders++;
      P.hidden = loc === "hidden";
      P.island = info.island;
    }
  }

  function round(n) {
    return Math.round(n * 1000) / 1000;
  }

  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: renderers,
    inject: (renderer) => {
      var id = nextId++;
      renderers.set(id, renderer);
      return id;
    },
    checkDCE: () => {},
    onScheduleFiberRoot: () => {},
    onCommitFiberRoot: (id, root, priority) => {
      if (!recording) return;
      try {
        walkCommit(root, priority);
      } catch (err) {
        if (errors.length < 50) errors.push(String((err && err.stack) || err));
      }
    },
    onCommitFiberUnmount: () => {},
    onPostCommitFiberRoot: () => {},
  };

  function reset() {
    commits = [];
    errors = [];
    byComponent = new Map();
    byLocation = {};
    byPane = {};
  }

  function r3(o) {
    for (var k in o) if (typeof o[k] === "number") o[k] = round(o[k]);
    return o;
  }

  window.__perf = {
    start: (l) => {
      reset();
      label = l == null ? null : String(l);
      startedAt = performance.now();
      recording = true;
      return true;
    },
    stop: () => {
      recording = false;
      var comps = Array.from(byComponent.values()).sort((a, b) => b.totalActual - a.totalActual);
      var total = 0;
      for (var i = 0; i < commits.length; i++) total += commits[i].duration;
      var loc = {};
      for (var k in byLocation) loc[k] = r3(Object.assign({}, byLocation[k]));
      var panes = {};
      for (var p in byPane) panes[p] = r3(Object.assign({}, byPane[p]));
      return {
        label: label,
        elapsedMs: round(performance.now() - startedAt),
        commits: commits.length,
        totalActualDuration: round(total),
        renderers: renderers.size,
        errors: errors.slice(),
        byComponent: comps.slice(0, 200).map((c) => r3(Object.assign({}, c))),
        bySelf: comps
          .slice()
          .sort((a, b) => b.totalSelf - a.totalSelf)
          .slice(0, 50)
          .map((c) => ({ name: c.name, renders: c.renders, totalSelf: round(c.totalSelf) })),
        byLocation: loc,
        byPane: panes,
        commitsList: commits.map((c) => ({
          t: c.t,
          duration: round(c.duration),
          fibers: c.fibers,
          priority: c.priority,
        })),
      };
    },
    reset: reset,
    raw: () => ({
      label: label,
      fields: [
        "name",
        "actual",
        "self",
        "selfBase",
        "why",
        "location",
        "pane",
        "island",
        "changedProps",
      ],
      commits: commits,
      errors: errors.slice(),
    }),
    isRecording: () => recording,
  };
})();

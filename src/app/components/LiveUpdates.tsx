import { Component, createRef, type ReactNode } from "react";
import { Button } from "@/app/components/ui/button";

type Props = { children: ReactNode; ready: boolean; className?: string; announce?: boolean };
type Snapshot = {
  keys: Set<string>;
  anchor: HTMLElement | undefined;
  top: number;
};

/**
 * Keep the reader's anchor through a React commit. Mark stable rows with
 * data-live-item, and static content (description/composer) with data-live-anchor.
 * `ready` distinguishes the initial load from later arrivals.
 */
export class LiveUpdates extends Component<Props, { unseen: string[] }, Snapshot | null> {
  override state = { unseen: [] as string[] };
  private root = createRef<HTMLDivElement>();
  private scroller: HTMLElement | null = null;
  private resize: ResizeObserver | undefined;
  private readingAnchor: { node: HTMLElement; top: number; atTop: boolean } | undefined;

  override componentDidMount() {
    this.scroller = this.root.current?.closest<HTMLElement>("[data-tab-pane]") ?? null;
    this.scroller?.addEventListener("scroll", this.onScroll, { passive: true });
    this.captureAnchor();
    this.resize = new ResizeObserver(() => {
      // Images and expanded markdown can settle after the React commit.
      // A reader at the very top stays there: when an island narrows and a
      // toolbar above the rows wraps, following the anchor would scroll the
      // toolbar under the island header.
      const anchor = this.readingAnchor;
      if (anchor?.node.isConnected && this.scroller && !anchor.atTop) {
        this.scroller.scrollTop += anchor.node.getBoundingClientRect().top - anchor.top;
      }
      this.captureAnchor();
      this.markVisible();
    });
    if (this.root.current) this.resize.observe(this.root.current);
  }

  override componentWillUnmount() {
    this.scroller?.removeEventListener("scroll", this.onScroll);
    this.resize?.disconnect();
  }

  override getSnapshotBeforeUpdate(previous: Props): Snapshot | null {
    if (!previous.ready || previous.children === this.props.children || !this.scroller) return null;
    const top = this.scroller.getBoundingClientRect().top;
    const anchors = this.root.current?.querySelectorAll<HTMLElement>(
      "[data-live-item], [data-live-anchor]",
    );
    const anchor = Array.from(anchors ?? []).find(
      (node) => node.getBoundingClientRect().bottom > top + 8,
    );
    return {
      keys: new Set(this.items().map((node) => node.dataset.liveItem!)),
      anchor,
      top: anchor?.getBoundingClientRect().top ?? 0,
    };
  }

  override componentDidUpdate(
    _previous: Props,
    _state: { unseen: string[] },
    snapshot: Snapshot | null,
  ) {
    if (!snapshot || !this.scroller) {
      this.captureAnchor();
      return;
    }
    if (snapshot.anchor?.isConnected) {
      this.scroller.scrollTop += snapshot.anchor.getBoundingClientRect().top - snapshot.top;
    }
    const added = this.items().filter((node) => !snapshot.keys.has(node.dataset.liveItem!));
    const below = added.filter(
      (node) => node.getBoundingClientRect().top >= this.scroller!.getBoundingClientRect().bottom,
    );
    if (this.props.announce !== false && below.length) {
      this.setState((state) => ({
        unseen: [...new Set([...state.unseen, ...below.map((node) => node.dataset.liveItem!)])],
      }));
    }
    this.captureAnchor();
  }

  private items() {
    return Array.from(this.root.current?.querySelectorAll<HTMLElement>("[data-live-item]") ?? []);
  }

  private captureAnchor() {
    if (!this.scroller) return;
    const viewport = this.scroller.getBoundingClientRect();
    const nodes = this.root.current?.querySelectorAll<HTMLElement>(
      "[data-live-item], [data-live-anchor]",
    );
    const node = Array.from(nodes ?? []).find((item) => {
      const bounds = item.getBoundingClientRect();
      return bounds.bottom > viewport.top + 8 && bounds.top < viewport.bottom;
    });
    this.readingAnchor = node
      ? { node, top: node.getBoundingClientRect().top, atTop: this.scroller.scrollTop <= 0 }
      : undefined;
  }

  private onScroll = () => {
    this.captureAnchor();
    this.markVisible();
  };

  private markVisible = () => {
    if (!this.scroller || !this.state.unseen.length) return;
    const viewport = this.scroller.getBoundingClientRect();
    const remaining = this.items()
      .filter((node) => {
        const bounds = node.getBoundingClientRect();
        return (
          this.state.unseen.includes(node.dataset.liveItem!) &&
          (bounds.top >= viewport.bottom || bounds.bottom <= viewport.top)
        );
      })
      .map((node) => node.dataset.liveItem!);
    if (remaining.length !== this.state.unseen.length) this.setState({ unseen: remaining });
  };

  private jump = () => {
    const first = this.items().find((node) => this.state.unseen.includes(node.dataset.liveItem!));
    first?.scrollIntoView({ block: "center", behavior: "instant" });
    first?.focus({ preventScroll: true });
    this.captureAnchor();
    this.markVisible();
  };

  override render() {
    return (
      <div ref={this.root} className={this.props.className}>
        {this.props.children}
        {this.state.unseen.length > 0 && (
          <div className="pointer-events-none sticky bottom-4 z-30 -mt-7 flex h-7 justify-center">
            <Button size="sm" className="pointer-events-auto rounded-full" onClick={this.jump}>
              {this.state.unseen.length} new ↓
            </Button>
          </div>
        )}
      </div>
    );
  }
}

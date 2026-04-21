import { BrutalistNav } from "@/app/components/shell/navs/BrutalistNav";
import { CommandCenterNav } from "@/app/components/shell/navs/CommandCenterNav";
import { DeckNav } from "@/app/components/shell/navs/DeckNav";
import { HeadsUpNav } from "@/app/components/shell/navs/HeadsUpNav";
import { InlineNav } from "@/app/components/shell/navs/InlineNav";
import { MonolineNav } from "@/app/components/shell/navs/MonolineNav";
import { SplitRailNav } from "@/app/components/shell/navs/SplitRailNav";
import { TerminalNav } from "@/app/components/shell/navs/TerminalNav";
import { VerticalRailNav } from "@/app/components/shell/navs/VerticalRailNav";
import { useNavVariantStore } from "@/app/stores/navVariant";

export type TopBarProps = {
  bordered?: boolean;
  className?: string;
};

/**
 * Dispatches to one of 9 navbar variants based on user preference.
 * `inline` is the default — tabs flow inline with the main nav on one row.
 * Swap via the picker in Settings → Navbar variant.
 */
export function TopBar(props: TopBarProps) {
  const variantId = useNavVariantStore((s) => s.variantId);

  switch (variantId) {
    case "inline-wide":
      return <InlineNav {...props} wide />;
    case "terminal":
      return <TerminalNav bordered={props.bordered} />;
    case "split-rail":
      return <SplitRailNav bordered={props.bordered} />;
    case "command-center":
      return <CommandCenterNav bordered={props.bordered} />;
    case "monoline":
      return <MonolineNav bordered={props.bordered} />;
    case "deck":
      return <DeckNav bordered={props.bordered} />;
    case "vertical-rail":
      return <VerticalRailNav bordered={props.bordered} />;
    case "heads-up":
      return <HeadsUpNav bordered={props.bordered} />;
    case "brutalist":
      return <BrutalistNav bordered={props.bordered} />;
    default:
      return <InlineNav {...props} />;
  }
}

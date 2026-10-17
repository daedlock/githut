import { useId } from "react";
import { CodeFontPicker } from "@/app/components/settings/CodeFontPicker";
import { ContainerWidthPicker } from "@/app/components/settings/ContainerWidthPicker";
import { ThemePicker } from "@/app/components/settings/ThemePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/app/components/ui/field";
import { Switch } from "@/app/components/ui/switch";
import { useMe } from "@/app/hooks/useMe";
import { useSettingsStore } from "@/app/stores/settings";
import { closeSettings, useSettingsModal } from "@/app/stores/settingsModal";

export function SettingsModal() {
  const open = useSettingsModal((s) => s.open);
  const { data: me } = useMe();
  const repoColor = useSettingsStore((s) => s.repoColor);
  const setRepoColor = useSettingsStore((s) => s.setRepoColor);
  const analyticsEnabled = useSettingsStore((s) => s.analyticsEnabled);
  const setAnalyticsEnabled = useSettingsStore((s) => s.setAnalyticsEnabled);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeSettings()}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-[48rem]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.querySelector<HTMLButtonElement>('[aria-label="Open user menu"]')?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Preferences stay in this browser.</DialogDescription>
        </DialogHeader>
        <FieldGroup className="min-h-0 overflow-y-auto pr-1">
          <FieldSet>
            <FieldLegend>Appearance</FieldLegend>
            <ThemePicker />
            <CodeFontPicker />
          </FieldSet>
          <FieldSet>
            <FieldLegend>Workspace</FieldLegend>
            <ContainerWidthPicker />
            <SettingsSwitch
              title="Repository colours"
              description="Use colour to help distinguish repository marks."
              checked={repoColor}
              onCheckedChange={setRepoColor}
            />
          </FieldSet>
          <FieldSet>
            <FieldLegend>Privacy</FieldLegend>
            <SettingsSwitch
              title="Product analytics"
              description="Help improve GitHut with privacy-friendly usage analytics."
              checked={analyticsEnabled}
              onCheckedChange={setAnalyticsEnabled}
            />
          </FieldSet>
          <FieldSet>
            <FieldLegend>Account</FieldLegend>
            <p className="text-ui text-muted-foreground">
              Signed in as <span className="font-mono text-foreground">{me?.login ?? "…"}</span>.
            </p>
          </FieldSet>
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}

function SettingsSwitch({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{title}</FieldLabel>
        <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
      </FieldContent>
      <Switch
        id={id}
        aria-describedby={`${id}-description`}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </Field>
  );
}

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
export function ConfirmAction({
  label,
  subject,
  detail,
  disabled,
  perform,
}: {
  label: string;
  subject: string;
  detail: string;
  disabled: boolean;
  perform: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setTyped("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{label}</DialogTitle>
        <p>{detail}</p>
        <form
          className="project-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (typed === subject && (await perform())) setOpen(false);
          }}
        >
          <label>
            Type {subject} to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
          <Button variant="destructive" disabled={disabled || typed !== subject}>
            {label}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

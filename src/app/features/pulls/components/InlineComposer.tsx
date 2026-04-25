import { useState } from "react";
import { CommentCardReply } from "@/app/components/ui/CommentCard";
import { cn } from "@/app/lib/cn";

export type InlineComposerProps = {
  login: string;
  avatarUrl?: string;
  onSubmit: (body: string) => void;
  onCancel: () => void;
  isPending?: boolean;
  submitLabel?: string;
  placeholder?: string;
};

export function InlineComposer({
  login,
  avatarUrl,
  onSubmit,
  onCancel,
  isPending,
  submitLabel = "Add comment",
  placeholder = "Leave a comment on this line…",
}: InlineComposerProps) {
  const [body, setBody] = useState("");

  return (
    <div className="sticky left-0 mx-4 my-2 max-w-[calc(100cqi-3rem)] rounded-lg border border-primary/40 bg-background p-3">
      <CommentCardReply
        login={login}
        avatarUrl={avatarUrl}
        value={body}
        onChange={setBody}
        onSubmit={() => onSubmit(body.trim())}
        onCancel={onCancel}
        isPending={isPending}
        submitLabel={submitLabel}
        placeholder={placeholder}
      />
    </div>
  );
}

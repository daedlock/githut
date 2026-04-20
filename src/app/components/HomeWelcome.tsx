import { ProfileLink } from "@/app/components/user/ProfileLink";

export type HomeWelcomeProps = {
  name: string;
  login: string;
};

export function HomeWelcome({ name, login }: HomeWelcomeProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-mono text-display font-medium text-foreground">
        Welcome,{" "}
        <ProfileLink login={login} className="text-primary">
          {name || login}
        </ProfileLink>
      </h1>
      <p className="max-w-md text-body text-muted-foreground">
        Authenticated via GitHub. Token lives in your browser only — the Worker never sees it after
        callback.
      </p>
    </div>
  );
}

import type { ReactNode } from "react";
import { Building2, Globe, Mail, MapPin } from "lucide-react";
import type { GitHubProfile } from "../schemas";

export type ProfileMetaProps = {
  profile: GitHubProfile;
};

export function ProfileMeta({ profile }: ProfileMetaProps) {
  const stats: { label: string; value: number }[] = [
    { label: "repositories", value: profile.public_repos },
    { label: "followers", value: profile.followers },
    ...(profile.following > 0 ? [{ label: "following", value: profile.following }] : []),
  ];

  const links: { icon: ReactNode; label: string; href?: string }[] = [];
  if (profile.location) {
    links.push({ icon: <MapPin className="size-3.5" />, label: profile.location });
  }
  if (profile.company) {
    links.push({
      icon: <Building2 className="size-3.5" />,
      label: profile.company.replace(/^@/, ""),
    });
  }
  if (profile.blog) {
    const url = profile.blog.startsWith("http") ? profile.blog : `https://${profile.blog}`;
    links.push({
      icon: <Globe className="size-3.5" />,
      label: profile.blog.replace(/^https?:\/\//, ""),
      href: url,
    });
  }
  if (profile.twitter_username) {
    links.push({
      icon: <span className="font-mono text-micro font-medium">𝕏</span>,
      label: `@${profile.twitter_username}`,
      href: `https://x.com/${profile.twitter_username}`,
    });
  }
  if (profile.email) {
    links.push({
      icon: <Mail className="size-3.5" />,
      label: profile.email,
      href: `mailto:${profile.email}`,
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Stats — editorial prose line */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-ui">
        {stats.map((s, i) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="text-(--color-fg-faint)">·</span>}
            <span className="font-medium tabular-nums text-foreground">{formatNum(s.value)}</span>
            <span className="text-muted-foreground">{s.label}</span>
          </span>
        ))}
      </div>

      {/* Links — location, company, website, etc. */}
      {links.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ui text-muted-foreground">
          {links.map((link, i) => (
            <span key={link.label} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-(--color-fg-faint)">·</span>}
              <span className="text-(--color-fg-faint)">{link.icon}</span>
              {link.href ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <span>{link.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

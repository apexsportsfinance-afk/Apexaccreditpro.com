import React, { useState } from "react";
import { Shield } from "lucide-react";
import { cn, getCountryFlag } from "../../lib/utils";

const SIZE_CLASSES = {
  sm: "w-5 h-5",
  md: "w-7 h-7",
  lg: "w-10 h-10",
};

const ICON_SIZE_CLASSES = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-5 h-5",
};

// Renders a team's logo, falling back to a national flag (by country name/code),
// and finally to a generic shield icon if neither is available or the image fails to load.
export default function TeamBadge({ logoUrl, country, name, size = "md", className }) {
  const [imgError, setImgError] = useState(false);

  const flagUrl = !logoUrl ? getCountryFlag(country) : null;
  const src = logoUrl || flagUrl;

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const iconSizeClass = ICON_SIZE_CLASSES[size] || ICON_SIZE_CLASSES.md;

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name ? `${name} badge` : "Team badge"}
        title={name}
        onError={() => setImgError(true)}
        className={cn(sizeClass, "rounded-full object-cover bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 shrink-0", className)}
      />
    );
  }

  return (
    <div
      title={name}
      className={cn(sizeClass, "rounded-full bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 flex items-center justify-center shrink-0", className)}
    >
      <Shield className={cn(iconSizeClass, "text-slate-400 dark:text-slate-500")} />
    </div>
  );
}

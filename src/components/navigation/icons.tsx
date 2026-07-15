import type { RouteName } from "../../app/routes";

function SvgIcon({ children }: { children: preact.ComponentChildren }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function BrandMark() {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <path d="M8.5 9.5h12a4 4 0 0 1 4 4v5.25a4 4 0 0 1-4 4h-5.7l-4.7 4.1v-4.4a4 4 0 0 1-3.6-4v-4.95a4 4 0 0 1 4-4Z" />
      <path d="M16.5 13.25h9a4 4 0 0 1 4 4v4.25a4 4 0 0 1-4 4h-1.7v3.25l-4.15-3.25H16.5a4 4 0 0 1-4-4v-4.25a4 4 0 0 1 4-4Z" />
      <circle cx="18" cy="19.4" r="1.25" />
      <circle cx="23" cy="19.4" r="1.25" />
    </svg>
  );
}

export function NavigationIcon({ route }: { route: RouteName }) {
  if (route === "encrypt") {
    return (
      <SvgIcon>
        <rect x="5.5" y="10" width="13" height="10" rx="2.5" />
        <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2.5" />
      </SvgIcon>
    );
  }
  if (route === "decrypt") {
    return (
      <SvgIcon>
        <rect x="5.5" y="10" width="13" height="10" rx="2.5" />
        <path d="M15.5 10V7.5a3.5 3.5 0 0 0-6.65-1.52M12 14v2.5" />
      </SvgIcon>
    );
  }
  if (route === "contacts") {
    return (
      <SvgIcon>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="10" r="2.3" />
        <path d="M3.8 19c.45-3.4 2.2-5.1 5.2-5.1s4.75 1.7 5.2 5.1M14 14.6c3.35-.65 5.4.82 6.15 4.4" />
      </SvgIcon>
    );
  }
  if (route === "identity") {
    return (
      <SvgIcon>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 20c.55-4.25 2.7-6.35 6.5-6.35s5.95 2.1 6.5 6.35" />
      </SvgIcon>
    );
  }
  if (route === "settings") {
    return (
      <SvgIcon>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.75v2.1M12 19.15v2.1M2.75 12h2.1M19.15 12h2.1M5.45 5.45l1.5 1.5M17.05 17.05l1.5 1.5M18.55 5.45l-1.5 1.5M6.95 17.05l-1.5 1.5" />
      </SvgIcon>
    );
  }
  return (
    <SvgIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9a2.55 2.55 0 1 1 4.2 1.95c-1.2.9-1.8 1.35-1.8 2.8M12 17.6h.01" />
    </SvgIcon>
  );
}

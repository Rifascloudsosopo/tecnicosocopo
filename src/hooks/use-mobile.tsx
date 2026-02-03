import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // Some Chrome/Android builds still expose the legacy MediaQueryList API
    // (addListener/removeListener) and will throw if we call addEventListener.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setIsMobile(false);
      return;
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Set initial value
    onChange();

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }

    // Legacy fallback
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - MediaQueryList legacy API
    mql.addListener(onChange);
    return () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - MediaQueryList legacy API
      mql.removeListener(onChange);
    };
  }, []);

  return !!isMobile;
}

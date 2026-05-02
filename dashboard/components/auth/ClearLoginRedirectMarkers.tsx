"use client";

import { useEffect } from "react";

const AUTO_REDIRECT_KEY = "bpvp_login_auto_redirect_once";
const REDIRECT_TS_KEY = "bpvp_auth_redirect_ts";

/**
 * After a successful dashboard load, clear login redirect markers so a later visit
 * to /login can auto-redirect again. Delay avoids breaking fast loop detection.
 */
export function ClearLoginRedirectMarkers() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(AUTO_REDIRECT_KEY);
        window.sessionStorage.removeItem(REDIRECT_TS_KEY);
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

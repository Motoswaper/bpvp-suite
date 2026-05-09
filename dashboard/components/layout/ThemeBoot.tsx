/**
 * Runs before React paint: syncs <html data-theme> from localStorage first, then cookie.
 * localStorage wins so night mode survives hydration when the SSR cookie is missing or stale
 * (e.g. Set-Cookie without Secure on HTTPS, or RSC overwriting the attribute).
 */
export function ThemeBoot() {
  const js = `(function(){try{var d=document.documentElement;var ls=null;try{ls=localStorage.getItem("bpvp_theme");}catch(e){}if(ls==="dark"||ls==="light"){d.setAttribute("data-theme",ls);return;}var m=document.cookie.match(/(?:^|;\\s*)bpvp_theme=(dark|light)/);if(m){d.setAttribute("data-theme",m[1]);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

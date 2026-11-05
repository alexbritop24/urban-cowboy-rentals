import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface SEOProps { title: string; description: string; noIndex?: boolean; }
const SEO = ({ title, description, noIndex = false }: SEOProps) => {
  const { pathname } = useLocation();
  useEffect(() => {
    const url = `https://www.urbancowboyrentals.com${pathname}`;
    const meta = (key: string, value: string, content: string) => {
      let node = document.head.querySelector(`meta[${key}="${value}"]`);
      if (!node) { node = document.createElement("meta"); node.setAttribute(key, value); document.head.appendChild(node); }
      node.setAttribute("content", content);
    };
    document.title = title;
    meta("name", "description", description);
    meta("property", "og:title", title);
    meta("property", "og:description", description);
    meta("property", "og:url", url);
    meta("name", "twitter:title", title);
    meta("name", "twitter:description", description);
    meta("name", "robots", (noIndex || /^\/(admin|admin-login|invoice)(\/|$)/.test(pathname)) ? "noindex, nofollow" : "index, follow");
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.setAttribute("rel", "canonical"); document.head.appendChild(canonical); }
    canonical.setAttribute("href", url);
  }, [title, description, pathname, noIndex]);
  return null;
};
export default SEO;

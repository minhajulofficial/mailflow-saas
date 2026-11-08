/**
 * Injects an open-tracking pixel and wraps outbound links with click tracking.
 * Used right before an email is handed to the provider.
 */
export function injectTracking(html: string, jobId: string, appUrl: string): string {
  if (!html) return html;

  const base = appUrl.replace(/\/$/, "");

  // Rewrite absolute http(s) links, but leave mailto/tel/unsubscribe links alone.
  let output = html.replace(
    /href=(["'])(https?:\/\/[^"']+)\1/gi,
    (_match, quote, url) => {
      if (url.includes("/api/unsubscribe") || url.includes("/api/track/")) {
        return `href=${quote}${url}${quote}`;
      }
      const tracked = `${base}/api/track/click/${jobId}?url=${encodeURIComponent(
        url
      )}`;
      return `href=${quote}${tracked}${quote}`;
    }
  );

  const pixel = `<img src="${base}/api/track/open/${jobId}" width="1" height="1" alt="" style="display:none!important;width:1px;height:1px;border:0;" />`;

  if (/<\/body>/i.test(output)) {
    output = output.replace(/<\/body>/i, `${pixel}</body>`);
  } else {
    output += pixel;
  }

  return output;
}

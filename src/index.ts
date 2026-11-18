// Enquire · enquire.nexus
// First deploy: a holding page and a health check. The engine (search index,
// approved sources, answers, members' rooms) is added in the following releases.

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Enquire · enquire.nexus</title>
<meta name="robots" content="noindex">
<style>
  html,body{margin:0;height:100%;background:#0a1226;color:#efe7d4;font-family:Georgia,'EB Garamond',serif}
  main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}
  h1{margin:0;font-weight:500;font-size:44px}
  .nexus{display:flex;align-items:center;gap:10px;font:500 12px system-ui,sans-serif;letter-spacing:.42em}
  .nexus i{display:block;width:28px;height:1px;background:#c89244}
  p{margin:8px 0 0;font:400 16px/1.5 system-ui,sans-serif;color:rgba(239,231,212,.8);max-width:520px}
</style>
</head>
<body>
<main>
  <h1>Enquire</h1>
  <div class="nexus"><i></i>NEXUS<i></i></div>
  <p>Governed enquiry across the ThinkPeople Nexus is being prepared.</p>
</main>
</body>
</html>`;

const SECURITY: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-robots-tag": "noindex",
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ service: "enquire-nexus", stage: "holding", ok: true }, { headers: { "cache-control": "no-store", ...SECURITY } });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: SECURITY });
    }
    return new Response(request.method === "HEAD" ? null : PAGE, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60", ...SECURITY },
    });
  },
};

// Cloudflare Worker — API de stockage du carnet de recettes + proxy de récupération de pages.
// Bindings requis : KV namespace "RECETTES" ; secret "TOKEN" ; variable optionnelle "ALLOWED_ORIGIN"
// (ex. https://ton-compte.github.io — origine seule, sans chemin).

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "X-Token, Content-Type",
      "Vary": "Origin",
    };
    const reply = (body, status = 200, extra = {}) =>
      new Response(body, { status, headers: { ...cors, ...extra } });

    if (request.method === "OPTIONS") return reply(null, 204);
    if (!env.TOKEN || request.headers.get("X-Token") !== env.TOKEN) return reply("Unauthorized", 401);

    const url = new URL(request.url);

    // Lecture / écriture de l'ensemble des recettes
    if (url.pathname === "/data") {
      if (request.method === "GET") {
        const v = await env.RECETTES.get("recettes");
        return reply(v || "[]", 200, { "Content-Type": "application/json" });
      }
      if (request.method === "PUT") {
        const body = await request.text();
        try {
          if (!Array.isArray(JSON.parse(body))) throw new Error("not array");
        } catch {
          return reply("Bad JSON", 400);
        }
        await env.RECETTES.put("recettes", body);
        return reply("ok");
      }
    }

    // Proxy : récupère le HTML d'une page de recette
    if (url.pathname === "/fetch" && request.method === "GET") {
      let target;
      try {
        target = new URL(url.searchParams.get("url"));
      } catch {
        return reply("Bad URL", 400);
      }
      if (!/^https?:$/.test(target.protocol)) return reply("Bad protocol", 400);
      const r = await fetch(target.toString(), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CarnetRecettes/1.0)", "Accept": "text/html" },
        redirect: "follow",
      });
      return reply(await r.text(), r.status, { "Content-Type": "text/html; charset=utf-8" });
    }

    return reply("Not found", 404);
  },
};

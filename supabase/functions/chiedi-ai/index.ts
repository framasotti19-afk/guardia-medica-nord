// Edge Function "chiedi-ai" — proxy verso l'API Anthropic (Tappa 2).
//
// Perché esiste: la chiave Anthropic (ANTHROPIC_API_KEY) è un SECRET di Supabase e non deve MAI
// arrivare al browser. Questa Function la tiene lato server, riceve dal browser lo STESSO body
// che l'app costruisce (system=prompt, messages, model, ...), lo inoltra ad Anthropic aggiungendo
// la chiave + anthropic-version, e rigira la risposta. Risolve anche il CORS (Anthropic non
// permette la chiamata diretta dal browser).
//
// Sicurezza: SOLO utenti loggati. Deploy con "Verify JWT" = ON → il gateway Supabase rifiuta chi
// non ha un JWT valido del progetto PRIMA che la Function parta. In più, qui sotto un controllo
// esplicito su /auth/v1/user: se il token non corrisponde a un utente reale → 401.

// CORS ristretto al solo sito del coordinatore (oltre al login, non lasciamo la porta aperta a
// tutti). Se un giorno cambi dominio/URL, aggiorna qui.
const cors = {
  "Access-Control-Allow-Origin": "https://framasotti19-afk.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight CORS
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_KEY) return json({ error: "Configurazione mancante: ANTHROPIC_API_KEY non impostata" }, 500);

  // Verifica che il chiamante sia un utente loggato reale (non anonimo).
  const auth = req.headers.get("Authorization") || "";
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: ANON ?? "" } });
    if (!u.ok) return json({ error: "Non autorizzato" }, 401);
    const user = await u.json();
    if (!user?.id) return json({ error: "Non autorizzato" }, 401);
  } catch (_e) {
    return json({ error: "Verifica utente non riuscita" }, 401);
  }

  // Inoltra il body INVARIATO ad Anthropic, con la chiave dal secret (mai vista dal browser).
  const body = await req.text();
  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body,
    });
  } catch (e) {
    return json({ error: "Chiamata ad Anthropic non riuscita: " + (e instanceof Error ? e.message : String(e)) }, 502);
  }

  // Rigira la risposta di Anthropic tale e quale (stesso status + corpo JSON), con header CORS.
  const text = await r.text();
  return new Response(text, { status: r.status, headers: { ...cors, "Content-Type": "application/json" } });
});

/* =====================================================================
   FactureFlow CI — Proxy IA sécurisé (Netlify Function)
   ---------------------------------------------------------------------
   Détient ANTHROPIC_API_KEY (variable d'env Netlify) et relaie vers
   l'API Anthropic en VISION + TOOL_USE. La clé n'est jamais exposée au
   navigateur.

   Sécurité (cf. CLAUDE.md §10) :
     1. Filtrage par ORIGINE (CORS) ;
     2. Vérification du JWT Supabase de l'utilisateur : le token Bearer
        envoyé par le client est validé auprès de Supabase Auth
        (GET /auth/v1/user). Tout appel non authentifié est rejeté
        → protège la clé Anthropic contre l'abus.

   Variables d'environnement Netlify requises :
     - ANTHROPIC_API_KEY   = sk-ant-...
     - SUPABASE_URL        = https://<projet>.supabase.co
     - SUPABASE_ANON_KEY   = clé anon publique (sert d'apikey pour /auth/v1/user)
     - ALLOWED_ORIGINS     = "https://votre-site.netlify.app,http://localhost:8888"

   Déploiement :
     netlify env:set ANTHROPIC_API_KEY "sk-ant-..."
     netlify deploy --prod
   URL obtenue (à reporter dans js/config.js → AI_PROXY_URL) :
     https://VOTRE-SITE.netlify.app/.netlify/functions/ai-proxy
===================================================================== */

const DEFAULT_MODEL  = "claude-sonnet-4-6";   // modèle par défaut (CLAUDE.md §3)
const FALLBACK_MODEL = "claude-opus-4-8";     // repli factures complexes
const MAX_TOKENS_CAP = 4000;                  // factures à nombreuses lignes

// Origines autorisées : configurables via env, repli sur le site de prod + localhost.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  "https://factureflow-ci.netlify.app,http://localhost:8888,http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

// Vérifie le JWT Supabase. Renvoie l'utilisateur si valide, sinon null.
async function verifierJwtSupabase(authHeader) {
  const token = (authHeader || "").replace(/^Bearer\s+/i, "").trim();
  // Nettoie les valeurs d'env : espaces et guillemets parfois collés par erreur
  // dans l'interface Netlify (cause classique d'URL invalide).
  const clean = (v) => (v || "").trim().replace(/^["']|["']$/g, "");
  const url = clean(process.env.SUPABASE_URL);
  const anon = clean(process.env.SUPABASE_ANON_KEY);

  // Diagnostic renvoyé : { user, reason }. reason aide à corriger la config
  // sans exposer de secret (on ne renvoie jamais la clé, juste la cause).
  if (!token) return { user: null, reason: "no_token" };
  if (!url || !anon) return { user: null, reason: "server_misconfig" };
  try {
    const base = url.replace(/\/+$/, ""); // tolère un slash final dans SUPABASE_URL
    const res = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { user: null, reason: `auth_${res.status}` };
    const user = await res.json();
    if (user && user.id) return { user, reason: "ok" };
    return { user: null, reason: "no_user" };
  } catch (e) {
    // Le détail (sans secret) aide a diagnostiquer : URL invalide, fetch absent, DNS…
    return { user: null, reason: "auth_unreachable", detail: String((e && e.message) || e) };
  }
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || "";
  const cors = corsHeaders(origin);

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Méthode non autorisée" }) };

  // 1) Refuser les origines inconnues.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "Origine non autorisée" }) };
  }

  // 2) Vérifier le JWT Supabase.
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const { user, reason, detail } = await verifierJwtSupabase(auth);
  if (!user) {
    // Config serveur incomplète → 500 (problème côté déploiement, pas côté client).
    if (reason === "server_misconfig") {
      return { statusCode: 500, headers: cors, body: JSON.stringify({
        error: "Config serveur IA incomplète : SUPABASE_URL et/ou SUPABASE_ANON_KEY manquantes côté Netlify.",
        reason }) };
    }
    // Sinon, problème d'authentification (token absent/expiré, clé anon erronée…).
    const messages = {
      no_token: "Aucun jeton transmis au proxy.",
      no_user: "Jeton valide mais aucun utilisateur associé.",
      auth_401: "Jeton refusé par Supabase (clé anon erronée ou jeton invalide).",
      auth_403: "Accès refusé par Supabase (vérifiez SUPABASE_ANON_KEY).",
      auth_404: "Endpoint Supabase introuvable (vérifiez SUPABASE_URL).",
      auth_unreachable: "Supabase injoignable depuis le proxy.",
    };
    const baseMsg = messages[reason] || "Authentification refusée.";
    return { statusCode: 401, headers: cors, body: JSON.stringify({
      error: detail ? `${baseMsg} (${detail})` : baseMsg, reason }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { system, messages, model, max_tokens, tools, tool_choice } = body;

    if (!Array.isArray(messages) || !messages.length) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "messages requis" }) };
    }

    // N'autoriser que les deux modèles prévus.
    const chosenModel = model === FALLBACK_MODEL ? FALLBACK_MODEL : DEFAULT_MODEL;

    const payload = {
      model: chosenModel,
      max_tokens: Math.min(Number(max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP),
      messages,
    };
    if (system) payload.system = system;
    if (Array.isArray(tools) && tools.length) payload.tools = tools;
    if (tool_choice) payload.tool_choice = tool_choice;

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const data = await apiRes.json();
    return { statusCode: apiRes.status, headers: cors, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: "Erreur du proxy IA" }) };
  }
};

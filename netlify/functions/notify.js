/* =====================================================================
   FactureFlow CI — Notifications du circuit (Netlify Function)
   ---------------------------------------------------------------------
   Envoie des e-mails aux bonnes personnes lors des transitions du circuit :
     - a_controler / a_valider → Contrôle de Gestion + admins de l'org
     - validee                 → la personne qui a saisi la facture
     - retards                 → récap des factures échues non réglées (admins/CG)

   Sécurité (comme ai-proxy) : CORS + vérification du JWT Supabase. Les
   destinataires sont déterminés CÔTÉ SERVEUR via l'API REST Supabase appelée
   AVEC LE JWT de l'utilisateur (la RLS limite donc aux membres de SON org).

   Variables d'environnement Netlify :
     SUPABASE_URL, SUPABASE_ANON_KEY   (déjà présentes pour ai-proxy)
     ALLOWED_ORIGINS                   (idem)
     SMTP_HOST, SMTP_PORT, SMTP_SECURE ("true"/"false"),
     SMTP_USER, SMTP_PASS, NOTIFY_FROM  ("FactureFlow <no-reply@votre-domaine>")
     APP_URL                            (ex. https://factureflow-ci.netlify.app)
   Si SMTP_HOST est absent, la fonction ne fait rien (no-op) sans erreur.
===================================================================== */
const nodemailer = require("nodemailer");

const clean = (v) => (v || "").trim().replace(/^["']|["']$/g, "");

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  "https://factureflow-ci.netlify.app,http://localhost:8888,http://localhost:3000")
  .split(",").map((s) => s.trim()).filter(Boolean);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

const SB_URL = () => clean(process.env.SUPABASE_URL).replace(/\/+$/, "");
const SB_ANON = () => clean(process.env.SUPABASE_ANON_KEY);

// Appel REST Supabase avec le JWT de l'utilisateur (RLS appliquée).
async function sbGet(path, token) {
  const res = await fetch(`${SB_URL()}/rest/v1/${path}`, {
    headers: { apikey: SB_ANON(), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`supabase_${res.status}`);
  return res.json();
}

async function verifierJwt(token) {
  if (!token) return null;
  if (!SB_URL() || !SB_ANON()) return null;
  try {
    const res = await fetch(`${SB_URL()}/auth/v1/user`, {
      headers: { apikey: SB_ANON(), Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return u && u.id ? u : null;
  } catch { return null; }
}

function transporteur() {
  const host = clean(process.env.SMTP_HOST);
  if (!host) return null; // non configuré → no-op
  return nodemailer.createTransport({
    host,
    port: Number(clean(process.env.SMTP_PORT)) || 587,
    secure: clean(process.env.SMTP_SECURE) === "true",
    auth: { user: clean(process.env.SMTP_USER), pass: clean(process.env.SMTP_PASS) },
  });
}

const fcfa = (n) => (Math.round(Number(n) || 0)).toLocaleString("fr-FR") + " FCFA";
const lienFacture = (id) => `${clean(process.env.APP_URL) || ALLOWED_ORIGINS[0]}/#/facture/${id}`;

// Emails des membres de l'org ayant un rôle de contrôle (admin + controle_gestion).
async function destinatairesControle(token) {
  const rows = await sbGet("users?select=email,role&role=in.(admin,controle_gestion)", token);
  return [...new Set((rows || []).map((r) => r.email).filter(Boolean))];
}

// Construit le message selon l'événement. Renvoie { to[], subject, text } ou null.
async function composer(eventName, factureId, token) {
  if (eventName === "retards") {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await sbGet(
      `factures?select=numero,total_ttc,echeance,montant_paye,fournisseurs(nom)` +
      `&statut=neq.non_conforme&statut_paiement=neq.paye&echeance=lt.${today}&order=echeance.asc`,
      token);
    if (!rows || !rows.length) return null;
    const to = await destinatairesControle(token);
    if (!to.length) return null;
    const lignes = rows.map((f) => {
      const reste = (Number(f.total_ttc) || 0) - (Number(f.montant_paye) || 0);
      return `• ${f.fournisseurs?.nom || "—"} — ${f.numero || "sans n°"} — échéance ${f.echeance} — reste ${fcfa(reste)}`;
    });
    const total = rows.reduce((s, f) => s + ((Number(f.total_ttc) || 0) - (Number(f.montant_paye) || 0)), 0);
    return {
      to,
      subject: `FactureFlow — ${rows.length} facture(s) en retard de paiement`,
      text: `Factures échues non réglées :\n\n${lignes.join("\n")}\n\nTotal restant dû : ${fcfa(total)}\n\n${clean(process.env.APP_URL) || ALLOWED_ORIGINS[0]}/#/echeancier`,
    };
  }

  // Événements liés à une facture.
  const rows = await sbGet(
    `factures?select=numero,total_ttc,created_by,fournisseurs(nom)&id=eq.${factureId}`, token);
  const f = rows && rows[0];
  if (!f) return null;
  const fourn = f.fournisseurs?.nom || "Fournisseur inconnu";
  const montant = fcfa(f.total_ttc);
  const ref = f.numero || "sans n°";

  if (eventName === "a_controler" || eventName === "a_valider") {
    const to = await destinatairesControle(token);
    if (!to.length) return null;
    const quoi = eventName === "a_controler" ? "à contrôler (comptes de charge)" : "à valider";
    return {
      to,
      subject: `FactureFlow — Facture ${quoi} : ${ref}`,
      text: `Une facture est ${quoi}.\n\nFournisseur : ${fourn}\nN° : ${ref}\nMontant TTC : ${montant}\n\nOuvrir : ${lienFacture(factureId)}`,
    };
  }

  if (eventName === "validee") {
    if (!f.created_by) return null;
    const us = await sbGet(`users?select=email&id=eq.${f.created_by}`, token);
    const to = (us || []).map((u) => u.email).filter(Boolean);
    if (!to.length) return null;
    return {
      to,
      subject: `FactureFlow — Facture validée : ${ref}`,
      text: `Votre facture a été validée.\n\nFournisseur : ${fourn}\nN° : ${ref}\nMontant TTC : ${montant}\n\nOuvrir : ${lienFacture(factureId)}`,
    };
  }
  return null;
}

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || "";
  const cors = corsHeaders(origin);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Méthode non autorisée" }) };
  if (origin && !ALLOWED_ORIGINS.includes(origin))
    return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "Origine non autorisée" }) };

  const token = (event.headers.authorization || event.headers.Authorization || "").replace(/^Bearer\s+/i, "").trim();
  const user = await verifierJwt(token);
  if (!user) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Non authentifié" }) };

  const tx = transporteur();
  if (!tx) return { statusCode: 200, headers: cors, body: JSON.stringify({ skipped: "smtp_not_configured" }) };

  try {
    const { event: eventName, factureId } = JSON.parse(event.body || "{}");
    const msg = await composer(eventName, factureId, token);
    if (!msg) return { statusCode: 200, headers: cors, body: JSON.stringify({ sent: 0, reason: "no_recipients_or_data" }) };

    await tx.sendMail({
      from: clean(process.env.NOTIFY_FROM) || clean(process.env.SMTP_USER),
      to: msg.to.join(", "),
      subject: msg.subject,
      text: msg.text,
    });
    return { statusCode: 200, headers: cors, body: JSON.stringify({ sent: msg.to.length }) };
  } catch (e) {
    // Best-effort : on renvoie 200 pour ne pas faire échouer l'action métier côté client.
    return { statusCode: 200, headers: cors, body: JSON.stringify({ sent: 0, error: String((e && e.message) || e) }) };
  }
};

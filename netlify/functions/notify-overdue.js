/* =====================================================================
   FactureFlow CI — Relance automatique des retards de paiement (planifiée)
   ---------------------------------------------------------------------
   Scheduled Function : s'exécute chaque jour (cron défini dans netlify.toml).
   Parcourt TOUTES les entreprises et envoie à chacune (admins + Contrôle de
   Gestion) le récapitulatif de ses factures échues non réglées.

   S'exécutant hors session utilisateur, elle lit au-delà de la RLS via la clé
   SUPABASE_SERVICE_ROLE_KEY (secret, uniquement côté Netlify). No-op si le SMTP
   ou la clé service ne sont pas configurés.

   Variables d'env requises (en plus du SMTP de notify.js) :
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, et SMTP_* / NOTIFY_FROM / APP_URL
===================================================================== */
const nodemailer = require("nodemailer");

const clean = (v) => (v || "").trim().replace(/^["']|["']$/g, "");
const SB_URL = () => clean(process.env.SUPABASE_URL).replace(/\/+$/, "");
const SERVICE = () => clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const fcfa = (n) => (Math.round(Number(n) || 0)).toLocaleString("fr-FR") + " FCFA";

// Lecture REST avec la clé service (contourne la RLS).
async function sbAdminGet(path) {
  const res = await fetch(`${SB_URL()}/rest/v1/${path}`, {
    headers: { apikey: SERVICE(), Authorization: `Bearer ${SERVICE()}` },
  });
  if (!res.ok) throw new Error(`supabase_${res.status}`);
  return res.json();
}

function transporteur() {
  const host = clean(process.env.SMTP_HOST);
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(clean(process.env.SMTP_PORT)) || 587,
    secure: clean(process.env.SMTP_SECURE) === "true",
    auth: { user: clean(process.env.SMTP_USER), pass: clean(process.env.SMTP_PASS) },
  });
}

exports.handler = async () => {
  const tx = transporteur();
  if (!tx || !SERVICE() || !SB_URL()) {
    return { statusCode: 200, body: JSON.stringify({ skipped: "smtp_or_service_not_configured" }) };
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    // Toutes les factures échues non réglées (toutes orgs confondues).
    const factures = await sbAdminGet(
      `factures?select=org_id,numero,total_ttc,echeance,montant_paye,fournisseurs(nom)` +
      `&statut=neq.non_conforme&statut_paiement=neq.paye&echeance=lt.${today}&order=org_id.asc,echeance.asc`);
    if (!factures.length) return { statusCode: 200, body: JSON.stringify({ orgs: 0, emails: 0 }) };

    const orgIds = [...new Set(factures.map((f) => f.org_id))];

    // Destinataires (admin + contrôle de gestion) de ces orgs.
    const users = await sbAdminGet(
      `users?select=email,org_id,role&role=in.(admin,controle_gestion)&org_id=in.(${orgIds.join(",")})`);

    // Regroupe par org : { factures[], recipients[] }.
    const parOrg = new Map();
    for (const f of factures) {
      const g = parOrg.get(f.org_id) || { factures: [], recipients: [] };
      g.factures.push(f); parOrg.set(f.org_id, g);
    }
    for (const u of users) {
      if (!u.email) continue;
      const g = parOrg.get(u.org_id);
      if (g && !g.recipients.includes(u.email)) g.recipients.push(u.email);
    }

    const appUrl = clean(process.env.APP_URL) || "https://factureflow-ci.netlify.app";
    const from = clean(process.env.NOTIFY_FROM) || clean(process.env.SMTP_USER);
    let orgsNotifiees = 0, emails = 0;

    for (const [, g] of parOrg) {
      if (!g.recipients.length) continue;
      const lignes = g.factures.map((f) => {
        const reste = (Number(f.total_ttc) || 0) - (Number(f.montant_paye) || 0);
        return `• ${f.fournisseurs?.nom || "—"} — ${f.numero || "sans n°"} — échéance ${f.echeance} — reste ${fcfa(reste)}`;
      });
      const total = g.factures.reduce((s, f) => s + ((Number(f.total_ttc) || 0) - (Number(f.montant_paye) || 0)), 0);
      await tx.sendMail({
        from,
        to: g.recipients.join(", "),
        subject: `FactureFlow — ${g.factures.length} facture(s) en retard de paiement`,
        text: `Rappel quotidien — factures échues non réglées :\n\n${lignes.join("\n")}\n\nTotal restant dû : ${fcfa(total)}\n\n${appUrl}/#/echeancier`,
      });
      orgsNotifiees++; emails += g.recipients.length;
    }

    return { statusCode: 200, body: JSON.stringify({ orgs: orgsNotifiees, emails }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};

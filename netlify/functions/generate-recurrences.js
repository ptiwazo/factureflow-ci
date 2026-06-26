/* =====================================================================
   FactureFlow CI — Génération automatique des abonnements (planifiée)
   ---------------------------------------------------------------------
   Scheduled Function (cron dans netlify.toml) : chaque jour, parcourt TOUTES
   les organisations et génère les factures dues à partir des abonnements
   actifs (statut a_controler), sans doublon (derniere_periode). Utilise la
   clé SUPABASE_SERVICE_ROLE_KEY (hors RLS). No-op si non configurée.
===================================================================== */
const clean = (v) => (v || "").trim().replace(/^["']|["']$/g, "");
const SB_URL = () => clean(process.env.SUPABASE_URL).replace(/\/+$/, "");
const SERVICE = () => clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

function headers(extra) {
  return { apikey: SERVICE(), Authorization: `Bearer ${SERVICE()}`, "Content-Type": "application/json", ...extra };
}
async function sbGet(path) {
  const res = await fetch(`${SB_URL()}/rest/v1/${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`get_${res.status}`);
  return res.json();
}
async function sbPost(table, body, returnRep) {
  const res = await fetch(`${SB_URL()}/rest/v1/${table}`, {
    method: "POST", headers: headers(returnRep ? { Prefer: "return=representation" } : {}), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`post_${table}_${res.status}`);
  return returnRep ? res.json() : null;
}
async function sbPatch(path, body) {
  const res = await fetch(`${SB_URL()}/rest/v1/${path}`, { method: "PATCH", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`patch_${res.status}`);
}

exports.handler = async () => {
  if (!SB_URL() || !SERVICE()) {
    return { statusCode: 200, body: JSON.stringify({ skipped: "service_not_configured" }) };
  }
  try {
    const auj = new Date();
    const periode = auj.toISOString().slice(0, 10).slice(0, 7);
    const jourAuj = auj.getDate();

    const recs = await sbGet("recurrences?select=*&actif=eq.true");
    let cree = 0;
    for (const r of recs) {
      if (r.derniere_periode === periode) continue;
      if (r.date_debut && r.date_debut.slice(0, 7) > periode) continue;
      if (r.date_fin && r.date_fin.slice(0, 7) < periode) continue;
      if (jourAuj < (r.jour || 1)) continue;

      const ht = Number(r.montant_ht) || 0;
      const taux = Number(r.taux_tva) || 0;
      const tva = Math.round(ht * taux) / 100;
      const dateFact = `${periode}-${String(Math.min(r.jour || 1, 28)).padStart(2, "0")}`;

      const [facture] = await sbPost("factures", {
        org_id: r.org_id, fournisseur_id: r.fournisseur_id || null, numero: `ABO ${periode}`,
        date: dateFact, echeance: dateFact, total_ht: ht, taux_tva: taux, montant_tva: tva,
        total_ttc: Math.round((ht + tva) * 100) / 100, devise: r.devise || "XOF", statut: "a_controler",
      }, true);

      await sbPost("lignes", {
        facture_id: facture.id, designation: r.designation, quantite: 1,
        prix_unitaire: ht, montant_ht: ht, taux_tva: taux, categorie: r.categorie || null,
      });
      await sbPatch(`recurrences?id=eq.${r.id}`, { derniere_periode: periode });
      // Trace l'action (utilisateur système : user_id null).
      await sbPost("logs", { org_id: r.org_id, user_id: null, action: "generation_recurrences", cible: `recurrence:${r.id}` }).catch(() => {});
      cree++;
    }
    return { statusCode: 200, body: JSON.stringify({ periode, cree }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};

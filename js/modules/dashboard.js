/* =====================================================================
   Module 6.5 — Tableau de bord : KPIs, dépenses par fournisseur, récentes
===================================================================== */
import { setView, fcfa, dateFr, esc, statutBadge, emptyState, moisLabel } from "../ui.js";
import { statsDashboard } from "../store.js";
import { getProfil } from "../auth.js";

export async function render() {
  setView(`<div class="loading-block"><span class="spinner dark"></span><p>Calcul des indicateurs…</p></div>`);

  let s;
  try { s = await statsDashboard(); }
  catch (e) { setView(emptyState("⚠️", "Erreur", e.message)); return; }

  const prenom = (getProfil()?.org_nom) || "";
  const maxFourn = Math.max(1, ...s.topFournisseurs.map((f) => f.total));

  setView(`
    <h1 class="page-title">Tableau de bord</h1>
    <p class="muted" style="margin-top:-10px">${esc(prenom)} · ${moisLabel(new Date())}</p>

    <div class="kpi-grid">
      <div class="kpi accent-amber">
        <div class="kpi-label">À contrôler</div>
        <div class="kpi-value">${s.aControler}</div>
      </div>
      <div class="kpi accent-amber">
        <div class="kpi-label">À valider</div>
        <div class="kpi-value">${s.aValider}</div>
      </div>
      <div class="kpi accent-teal">
        <div class="kpi-label">Dépenses du mois</div>
        <div class="kpi-value" style="font-size:1.15rem">${fcfa(s.depensesMois)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">TVA cumulée</div>
        <div class="kpi-value" style="font-size:1.15rem">${fcfa(s.tvaCumulee)}</div>
      </div>
      <div class="kpi accent-teal">
        <div class="kpi-label">Restant à payer</div>
        <div class="kpi-value" style="font-size:1.15rem">${fcfa(s.montantAPayer)}</div>
      </div>
      <div class="kpi accent-danger">
        <div class="kpi-label">Non conformes</div>
        <div class="kpi-value">${s.nonConformes}</div>
      </div>
    </div>

    ${s.aControler ? `<a href="#/factures/a_controler" class="alert alert-warn" style="text-decoration:none">
      🧮 <div>${s.aControler} facture(s) en attente de <strong>contrôle de gestion</strong>. <strong>Contrôler →</strong></div></a>` : ""}
    ${s.aValider ? `<a href="#/factures/a_valider" class="alert alert-warn" style="text-decoration:none">
      ✅ <div>${s.aValider} facture(s) prêtes à <strong>valider</strong>. <strong>Valider →</strong></div></a>` : ""}
    ${s.nbEnRetard ? `<a href="#/echeancier" class="alert alert-danger" style="text-decoration:none">
      ⏰ <div>${s.nbEnRetard} facture(s) <strong>en retard de paiement</strong>. <strong>Voir l'échéancier →</strong></div></a>`
      : (s.nbAPayer ? `<a href="#/echeancier" class="alert alert-info" style="text-decoration:none">
      📅 <div>${s.nbAPayer} facture(s) à régler. <strong>Voir l'échéancier →</strong></div></a>` : "")}

    <div class="row between mt">
      <h2 class="section-title" style="margin:0">Dépenses par fournisseur</h2>
    </div>
    <div class="card">
      ${s.topFournisseurs.length ? s.topFournisseurs.map((f) => `
        <div style="margin-bottom:12px">
          <div class="row between"><span>${esc(f.nom)}</span><strong>${fcfa(f.total)}</strong></div>
          <div class="confidence-bar"><span style="width:${Math.round((f.total / maxFourn) * 100)}%;background:var(--teal)"></span></div>
        </div>`).join("") : `<p class="muted center">Pas encore de données.</p>`}
    </div>

    <h2 class="section-title">Factures récentes</h2>
    <div class="list">
      ${s.recentes.length ? s.recentes.map((f) => `
        <a class="list-item" href="#/facture/${f.id}">
          <div class="li-main"><div class="li-title">${esc(f.fournisseurs?.nom || "Fournisseur inconnu")}</div>
            <div class="li-sub">${dateFr(f.date)} · ${statutBadge(f.statut)}</div></div>
          <div class="li-amount">${fcfa(f.total_ttc, f.devise)}</div>
        </a>`).join("") : emptyState("🧾", "Aucune facture", "Commencez par en capturer une.")}
    </div>

    <div class="row mt" style="gap:10px;justify-content:center;margin-bottom:24px">
      <a href="#/capture" class="btn btn-primary">📸 Nouvelle facture</a>
      <a href="#/echeancier" class="btn btn-secondary">📅 Échéancier</a>
    </div>
  `);
}

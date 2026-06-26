/* =====================================================================
   Module — Tableau de bord analytique
   ---------------------------------------------------------------------
   Vues de pilotage (sans librairie graphique : barres CSS) sur une période
   glissante : tendance mensuelle des dépenses, TVA déductible par mois, top
   fournisseurs, répartition par compte de charge, et état des règlements.
   Tout est calculé côté client à partir des factures + lignes de l'org.
===================================================================== */
import { $, setView, fcfa, esc, emptyState } from "../ui.js";
import { listerFactures, listerLignesPourAnalyse } from "../store.js";
import { COMPTES_PAR_NUMERO } from "../comptes-charge-ifrs.js";

let cache = null; // { factures, lignes }

export async function render() {
  setView(`<div class="loading-block"><span class="spinner dark"></span><p>Calcul des analyses…</p></div>`);
  try {
    if (!cache) {
      const [factures, lignes] = await Promise.all([listerFactures(), listerLignesPourAnalyse().catch(() => [])]);
      cache = { factures, lignes };
    }
  } catch (e) { setView(emptyState("⚠️", "Erreur", e.message)); return; }

  setView(`
    <h1 class="page-title">Analyse</h1>
    <div class="card">
      <div class="field" style="max-width:220px;margin:0">
        <label for="an-periode">Période</label>
        <select id="an-periode">
          <option value="6">6 derniers mois</option>
          <option value="12" selected>12 derniers mois</option>
          <option value="24">24 derniers mois</option>
        </select>
      </div>
    </div>
    <div id="an-contenu"></div>
  `);
  $("#an-periode").addEventListener("change", dessiner);
  dessiner();
}

// Liste des N derniers mois au format AAAA-MM (du plus ancien au plus récent).
function derniersMois(n) {
  const out = [];
  const base = new Date(); base.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(base.getFullYear(), base.getMonth() - i, 1);
    out.push(m.toISOString().slice(0, 7));
  }
  return out;
}
const labelMois = (ym) => new Date(ym + "-01").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

// Rendu d'un jeu de barres horizontales. items = [{ label, valeur, sous? }].
function barres(items, couleur = "var(--teal)") {
  if (!items.length) return `<p class="muted center">Pas de données.</p>`;
  const max = Math.max(1, ...items.map((i) => i.valeur));
  return items.map((i) => `
    <div style="margin-bottom:10px">
      <div class="row between" style="font-size:.85rem">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">${esc(i.label)}</span>
        <strong>${fcfa(i.valeur)}${i.sous ? ` <span class="muted" style="font-weight:400">${esc(i.sous)}</span>` : ""}</strong>
      </div>
      <div class="confidence-bar"><span style="width:${Math.round((i.valeur / max) * 100)}%;background:${couleur}"></span></div>
    </div>`).join("");
}

function dessiner() {
  const n = Number($("#an-periode").value) || 12;
  const mois = derniersMois(n);
  const debut = mois[0]; // borne basse (AAAA-MM)
  const dansPeriode = (d) => d && d.slice(0, 7) >= debut;
  const cible = $("#an-contenu");

  const factures = cache.factures.filter((f) => f.statut !== "non_conforme");

  // 1) Tendance mensuelle des dépenses (TTC) + TVA.
  const parMois = Object.fromEntries(mois.map((m) => [m, { ttc: 0, tva: 0 }]));
  for (const f of factures) {
    const ym = (f.date || "").slice(0, 7);
    if (parMois[ym]) {
      parMois[ym].ttc += Number(f.total_ttc) || 0;
      parMois[ym].tva += Number(f.montant_tva) || 0;
    }
  }
  const trend = mois.map((m) => ({ label: labelMois(m), valeur: Math.round(parMois[m].ttc), sous: `TVA ${fcfa(parMois[m].tva)}` }));
  const totalPeriode = trend.reduce((s, x) => s + x.valeur, 0);

  // 2) Top fournisseurs (TTC) sur la période.
  const parFourn = new Map();
  for (const f of factures) {
    if (!dansPeriode(f.date)) continue;
    const nom = f.fournisseurs?.nom || "—";
    parFourn.set(nom, (parFourn.get(nom) || 0) + (Number(f.total_ttc) || 0));
  }
  const topFourn = [...parFourn.entries()].map(([label, valeur]) => ({ label, valeur }))
    .sort((a, b) => b.valeur - a.valeur).slice(0, 8);

  // 3) Répartition par compte de charge (HT) sur la période.
  const parCompte = new Map();
  for (const l of cache.lignes) {
    if (!["validee", "exportee"].includes(l.statut) || !dansPeriode(l.date)) continue;
    const cpt = l.categorie || "—";
    parCompte.set(cpt, (parCompte.get(cpt) || 0) + l.montant_ht);
  }
  const topComptes = [...parCompte.entries()]
    .map(([cpt, valeur]) => {
      const ref = COMPTES_PAR_NUMERO[cpt];
      return { label: ref ? `${cpt} — ${ref.labelFr}` : (cpt === "—" ? "Non classé" : cpt), valeur };
    })
    .sort((a, b) => b.valeur - a.valeur).slice(0, 8);

  // 4) Règlements (sur la période).
  let paye = 0, restant = 0;
  for (const f of factures) {
    if (!dansPeriode(f.date)) continue;
    const ttc = Number(f.total_ttc) || 0;
    const mp = Number(f.montant_paye) || 0;
    const ps = f.statut_paiement || (ttc > 0 && mp >= ttc ? "paye" : mp > 0 ? "partiel" : "a_payer");
    if (ps === "paye") paye += ttc; else { paye += mp; restant += Math.max(0, ttc - mp); }
  }

  cible.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi accent-teal"><div class="kpi-label">Dépenses (période)</div><div class="kpi-value" style="font-size:1.1rem">${fcfa(totalPeriode)}</div></div>
      <div class="kpi accent-teal"><div class="kpi-label">Réglé</div><div class="kpi-value" style="font-size:1.1rem">${fcfa(paye)}</div></div>
      <div class="kpi accent-danger"><div class="kpi-label">Restant dû</div><div class="kpi-value" style="font-size:1.1rem">${fcfa(restant)}</div></div>
    </div>

    <div class="card"><h3>Dépenses par mois (TTC)</h3>${barres(trend)}</div>
    <div class="card"><h3>Top fournisseurs</h3>${barres(topFourn, "var(--teal)")}</div>
    <div class="card"><h3>Par compte de charge (HT, factures validées)</h3>
      ${cache.lignes.length ? barres(topComptes, "#6366F1") : `<p class="muted center">Détail par compte indisponible.</p>`}</div>
    <div style="height:24px"></div>
  `;
}

/* =====================================================================
   Module 6.3 — Fournisseurs : liste, fiche, historique
   (Déduplication par NCC assurée côté store.trouverOuCreerFournisseur.)
===================================================================== */
import { $, setView, toast, fcfa, dateFr, esc, emptyState, statutBadge, nccValide, busy } from "../ui.js";
import { listerFournisseurs, getFournisseur, listerFactures, majFournisseur, journaliser } from "../store.js";
import { getProfil } from "../auth.js";
import { navigate } from "../app.js";

export async function renderListe() {
  setView(`
    <h1 class="page-title">Fournisseurs</h1>
    <input id="recherche" type="search" placeholder="Rechercher par nom ou NCC…" class="mb" />
    <div id="liste"><div class="loading-block"><span class="spinner dark"></span></div></div>
  `);

  let tous = [];
  try { tous = await listerFournisseurs(); }
  catch (e) { $("#liste").innerHTML = emptyState("⚠️", "Erreur", e.message); return; }

  const dessiner = (items) => {
    const cible = $("#liste");
    if (!items.length) {
      cible.innerHTML = emptyState("🏢", "Aucun fournisseur", "Les fournisseurs sont créés automatiquement lors de l'enregistrement des factures.");
      return;
    }
    cible.innerHTML = `<div class="list">${items.map((f) => `
      <a class="list-item" href="#/fournisseur/${f.id}">
        <div class="li-main">
          <div class="li-title">${esc(f.nom)}</div>
          <div class="li-sub">${f.ncc ? "NCC " + esc(f.ncc) : `<span style="color:var(--danger)">NCC manquant</span>`}${f.telephone ? " · " + esc(f.telephone) : ""}</div>
        </div>
        <span>›</span>
      </a>`).join("")}</div>`;
  };

  dessiner(tous);
  $("#recherche").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    dessiner(tous.filter((f) => (f.nom || "").toLowerCase().includes(q) || (f.ncc || "").toLowerCase().includes(q)));
  });
}

export async function renderDetail(id) {
  if (!id) return navigate("#/fournisseurs");
  setView(`<div class="loading-block"><span class="spinner dark"></span></div>`);

  let f, factures;
  try {
    f = await getFournisseur(id);
    if (!f) { setView(emptyState("🔍", "Fournisseur introuvable")); return; }
    factures = await listerFactures({ fournisseurId: id });
  } catch (e) { setView(emptyState("⚠️", "Erreur", e.message)); return; }

  const totalDepense = factures
    .filter((x) => x.statut !== "non_conforme")
    .reduce((s, x) => s + (Number(x.total_ttc) || 0), 0);
  const peutEcrire = ["admin", "saisie"].includes(getProfil()?.role);

  setView(`
    <a href="#/fournisseurs" class="btn btn-ghost btn-sm">← Fournisseurs</a>
    <h1 class="page-title">${esc(f.nom)}</h1>

    ${!f.ncc ? `<div class="alert alert-danger">⛔ NCC manquant — les factures de ce fournisseur sont marquées non conformes.</div>` : ""}

    <div class="card">
      <div class="field"><label for="e-nom">Nom</label><input id="e-nom" value="${esc(f.nom)}" ${peutEcrire ? "" : "disabled"} /></div>
      <div class="field ${f.ncc && !nccValide(f.ncc) ? "uncertain" : ""}">
        <label for="e-ncc">NCC</label><input id="e-ncc" value="${esc(f.ncc || "")}" ${peutEcrire ? "" : "disabled"} />
        <div class="uncertain-flag">⚠️ Format inhabituel</div>
      </div>
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="e-rccm">RCCM</label><input id="e-rccm" value="${esc(f.rccm || "")}" ${peutEcrire ? "" : "disabled"} /></div>
        <div class="grow field"><label for="e-tel">Téléphone</label><input id="e-tel" value="${esc(f.telephone || "")}" ${peutEcrire ? "" : "disabled"} /></div>
      </div>
      ${peutEcrire ? `<button id="btn-save" class="btn btn-primary btn-sm">Enregistrer</button>` : ""}
    </div>

    <div class="kpi-grid">
      <div class="kpi accent-teal"><div class="kpi-label">Total dépensé</div><div class="kpi-value">${fcfa(totalDepense)}</div></div>
      <div class="kpi"><div class="kpi-label">Factures</div><div class="kpi-value">${factures.length}</div></div>
    </div>

    <h2 class="section-title">Historique des factures</h2>
    <div class="list">
      ${factures.length ? factures.map((x) => `
        <a class="list-item" href="#/facture/${x.id}">
          <div class="li-main"><div class="li-title">${esc(x.numero || "sans n°")}</div>
            <div class="li-sub">${dateFr(x.date)} · ${statutBadge(x.statut)}</div></div>
          <div class="li-amount">${fcfa(x.total_ttc, x.devise)}</div>
        </a>`).join("") : emptyState("🧾", "Aucune facture")}
    </div>
  `);

  const btn = $("#btn-save");
  if (btn) btn.onclick = async (e) => {
    busy(e.currentTarget, true);
    try {
      await majFournisseur(id, {
        nom: $("#e-nom").value.trim(),
        ncc: $("#e-ncc").value.trim() || null,
        rccm: $("#e-rccm").value.trim() || null,
        telephone: $("#e-tel").value.trim() || null,
      });
      await journaliser("maj_fournisseur", `fournisseur:${id}`);
      toast("Fournisseur mis à jour.", "success");
      renderDetail(id);
    } catch (err) { busy(e.currentTarget, false); toast(err.message, "error"); }
  };
}

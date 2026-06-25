/* =====================================================================
   Module — Échéancier & suivi des paiements
   ---------------------------------------------------------------------
   Liste les factures NON réglées, regroupées par urgence d'échéance
   (en retard / cette semaine / à venir / sans échéance). Permet un
   règlement rapide (paiement intégral à la date du jour). Le détail d'une
   facture permet le paiement partiel et l'annulation.
===================================================================== */
import { $, $$, setView, toast, fcfa, dateFr, esc, emptyState, busy, paiementBadge, infoPaiement, debutJour } from "../ui.js";
import { listerFactures, majPaiement, journaliser } from "../store.js";
import { getProfil } from "../auth.js";

export async function render() {
  setView(`<div class="loading-block"><span class="spinner dark"></span><p>Chargement de l'échéancier…</p></div>`);

  const peutEcrire = ["admin", "saisie"].includes(getProfil()?.role);
  let factures;
  try { factures = await listerFactures(); }
  catch (e) { setView(emptyState("⚠️", "Erreur", e.message)); return; }

  const auj = debutJour();
  const finSemaine = new Date(auj); finSemaine.setDate(finSemaine.getDate() + 7);

  // Factures exploitables et non soldées.
  const items = factures
    .filter((f) => f.statut !== "non_conforme")
    .map((f) => ({ f, ...infoPaiement(f, auj) }))
    .filter((x) => x.statut !== "paye");

  const dateEch = (x) => (x.f.echeance ? new Date(x.f.echeance) : null);
  const enRetard = items.filter((x) => dateEch(x) && dateEch(x) < auj)
    .sort((a, b) => dateEch(a) - dateEch(b));
  const cetteSemaine = items.filter((x) => dateEch(x) && dateEch(x) >= auj && dateEch(x) <= finSemaine)
    .sort((a, b) => dateEch(a) - dateEch(b));
  const aVenir = items.filter((x) => dateEch(x) && dateEch(x) > finSemaine)
    .sort((a, b) => dateEch(a) - dateEch(b));
  const sansEcheance = items.filter((x) => !dateEch(x));

  const totalDu = items.reduce((s, x) => s + x.restant, 0);
  const totalRetard = enRetard.reduce((s, x) => s + x.restant, 0);

  setView(`
    <h1 class="page-title">Échéancier</h1>
    <div class="kpi-grid">
      <div class="kpi accent-teal"><div class="kpi-label">Restant à payer</div>
        <div class="kpi-value" style="font-size:1.15rem">${fcfa(totalDu)}</div></div>
      <div class="kpi accent-danger"><div class="kpi-label">Dont en retard</div>
        <div class="kpi-value" style="font-size:1.15rem">${fcfa(totalRetard)}</div></div>
    </div>

    ${items.length ? "" : emptyState("✅", "Rien à régler", "Toutes les factures exploitables sont payées.")}
    ${section("⏰ En retard", enRetard, peutEcrire, true)}
    ${section("📅 Cette semaine", cetteSemaine, peutEcrire)}
    ${section("🗓️ À venir", aVenir, peutEcrire)}
    ${section("❓ Sans échéance", sansEcheance, peutEcrire)}
    <div style="height:24px"></div>
  `);

  if (peutEcrire) {
    $$("[data-regler]").forEach((btn) => {
      btn.onclick = (e) => reglerRapide(e.currentTarget.dataset.regler, e.currentTarget);
    });
  }
}

// Rend une section (titre + liste) ; masquée si vide.
function section(titre, liste, peutEcrire, alerte = false) {
  if (!liste.length) return "";
  return `
    <h2 class="section-title" style="${alerte ? "color:var(--danger)" : ""}">${titre} <span class="muted">(${liste.length})</span></h2>
    <div class="list">${liste.map((x) => ligne(x, peutEcrire)).join("")}</div>`;
}

function ligne(x, peutEcrire) {
  const f = x.f;
  const nom = f.fournisseurs?.nom || "Fournisseur inconnu";
  const ech = f.echeance ? dateFr(f.echeance) : "—";
  return `
    <div class="list-item">
      <a class="li-main" href="#/facture/${f.id}" style="text-decoration:none;color:inherit">
        <div class="li-title">${esc(nom)}</div>
        <div class="li-sub">${esc(f.numero || "sans n°")} · éch. ${ech} · ${paiementBadge(x.statut)}${x.enRetard ? ` <span style="color:var(--danger)">en retard</span>` : ""}</div>
      </a>
      <div style="text-align:right;display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <span class="li-amount">${fcfa(x.restant, f.devise)}</span>
        ${peutEcrire ? `<button class="btn btn-primary btn-sm" data-regler="${f.id}">Régler</button>` : ""}
      </div>
    </div>`;
}

// Règlement rapide : paiement intégral à la date du jour.
async function reglerRapide(id, btn) {
  busy(btn, true, "…");
  try {
    const factures = await listerFactures();
    const f = factures.find((x) => x.id === id);
    if (!f) throw new Error("Facture introuvable.");
    await majPaiement(id, {
      statut_paiement: "paye",
      date_paiement: new Date().toISOString().slice(0, 10),
      montant_paye: Number(f.total_ttc) || 0,
    });
    await journaliser("paiement", `facture:${id}`);
    toast("Facture marquée payée ✔", "success");
    render();
  } catch (e) {
    busy(btn, false);
    toast(e.message || "Échec du règlement.", "error");
  }
}

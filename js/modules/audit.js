/* =====================================================================
   Module — Journal d'audit enrichi (admin)
   ---------------------------------------------------------------------
   Qui a fait quoi et quand : auteur (e-mail), libellé d'action lisible, cible
   (lien vers la facture le cas échéant), date/heure. Filtres : action,
   utilisateur, période, texte. Pagination « charger plus ».
===================================================================== */
import { $, $$, setView, toast, esc, emptyState, busy, debounce } from "../ui.js";
import { listerLogs, listerUtilisateurs } from "../store.js";
import { getProfil } from "../auth.js";

// Libellés lisibles des actions journalisées.
export const ACTIONS = {
  envoi_controle: "Envoi au contrôle",
  controle_comptes: "Contrôle des comptes",
  retour_controle: "Retour au contrôle",
  validation: "Validation de facture",
  facture_non_conforme: "Facture non conforme",
  suppression: "Suppression de facture",
  paiement: "Paiement enregistré",
  paiement_annule: "Paiement annulé",
  changement_role: "Changement de rôle",
  activation: "Activation d'un compte",
  desactivation: "Désactivation d'un compte",
  changement_erp: "Changement d'ERP",
  maj_fournisseur: "Modification fournisseur",
  import_fournisseurs: "Import de fournisseurs",
  releve_fournisseur: "Relevé fournisseur (PDF)",
  creation_commande: "Création de commande",
  import_commandes: "Import de commandes",
  suppression_commande: "Suppression de commande",
  rapprochement_commande: "Rapprochement commande",
  delier_commande: "Commande déliée",
  commande_statut_auto: "Commande — statut auto",
  export_csv: "Export CSV",
  export_excel: "Export Excel",
  export_sap_fi: "Export SAP (FI)",
  export_sap_journal_upload: "Export SAP Journal Upload",
  export_sage_ecritures: "Export Sage",
  export_tva: "Export déclaration TVA",
  export_pdf: "Export PDF",
};
export const libelleAction = (a) => ACTIONS[a] || a;

const PAGE = 100;
let logs = [];                 // logs chargés (croissant en pagination)
let emails = new Map();        // user_id -> email
const critere = { action: "", userId: "", debut: "", fin: "", texte: "" };

export async function render() {
  if (getProfil()?.role !== "admin") {
    setView(emptyState("⛔", "Accès réservé", "Le journal d'audit est réservé aux administrateurs."));
    return;
  }
  setView(`<div class="loading-block"><span class="spinner dark"></span><p>Chargement du journal…</p></div>`);
  try {
    const [l, users] = await Promise.all([listerLogs({ limite: PAGE }), listerUtilisateurs()]);
    logs = l;
    emails = new Map(users.map((u) => [u.id, u.email]));
  } catch (e) { setView(emptyState("⚠️", "Erreur", e.message)); return; }

  const optUsers = [...emails.entries()]
    .map(([id, mail]) => `<option value="${esc(id)}">${esc(mail || id)}</option>`).join("");
  const optActions = Object.keys(ACTIONS)
    .map((a) => `<option value="${a}">${esc(ACTIONS[a])}</option>`).join("");

  setView(`
    <div class="row between">
      <a href="#/settings" class="btn btn-ghost btn-sm">← Réglages</a>
    </div>
    <h1 class="page-title">Journal d'audit</h1>

    <input id="a-texte" type="search" placeholder="Rechercher (action, cible)…" class="mb" />
    <div class="card">
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="a-action">Action</label>
          <select id="a-action"><option value="">Toutes</option>${optActions}</select></div>
        <div class="grow field"><label for="a-user">Utilisateur</label>
          <select id="a-user"><option value="">Tous</option>${optUsers}</select></div>
      </div>
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="a-debut">Du</label><input id="a-debut" type="date" /></div>
        <div class="grow field"><label for="a-fin">Au</label><input id="a-fin" type="date" /></div>
      </div>
    </div>
    <p id="a-compte" class="muted" style="font-size:.82rem;margin:0 0 6px"></p>
    <div id="a-liste"></div>
    <div class="center" style="margin:12px 0 24px">
      <button id="a-plus" class="btn btn-secondary btn-sm">Charger plus</button>
    </div>
  `);

  $("#a-texte").addEventListener("input", debounce((e) => { critere.texte = e.target.value.trim().toLowerCase(); dessiner(); }, 200));
  $("#a-action").addEventListener("change", (e) => { critere.action = e.target.value; dessiner(); });
  $("#a-user").addEventListener("change", (e) => { critere.userId = e.target.value; dessiner(); });
  $("#a-debut").addEventListener("change", (e) => { critere.debut = e.target.value; dessiner(); });
  $("#a-fin").addEventListener("change", (e) => { critere.fin = e.target.value; dessiner(); });
  $("#a-plus").addEventListener("click", chargerPlus);

  dessiner();
}

async function chargerPlus(e) {
  const btn = e.currentTarget;
  const dernier = logs[logs.length - 1];
  if (!dernier) return;
  busy(btn, true, "…");
  try {
    const suite = await listerLogs({ limite: PAGE, avant: dernier.created_at });
    logs = logs.concat(suite);
    if (suite.length < PAGE) btn.style.display = "none"; // plus rien à charger
    dessiner();
  } catch (err) { toast(err.message, "error"); }
  finally { busy(btn, false); }
}

// Affiche la cible : lien vers la facture si "facture:<uuid>".
function cibleHtml(cible) {
  const s = String(cible || "");
  const m = s.match(/^facture:([0-9a-f-]{36})$/i);
  if (m) return `<a href="#/facture/${m[1]}">facture</a>`;
  return esc(s || "—");
}

function dessiner() {
  const cible = $("#a-liste");
  if (!cible) return;
  const res = logs.filter((l) => {
    if (critere.action && l.action !== critere.action) return false;
    if (critere.userId && l.user_id !== critere.userId) return false;
    const jour = (l.created_at || "").slice(0, 10);
    if (critere.debut && jour < critere.debut) return false;
    if (critere.fin && jour > critere.fin) return false;
    if (critere.texte) {
      const hay = `${libelleAction(l.action)} ${l.action} ${l.cible || ""} ${emails.get(l.user_id) || ""}`.toLowerCase();
      if (!hay.includes(critere.texte)) return false;
    }
    return true;
  });

  $("#a-compte").textContent = `${res.length} entrée(s) affichée(s)`;
  cible.innerHTML = res.length ? `<div class="list">${res.map((l) => `
    <div class="list-item">
      <div class="li-main">
        <div class="li-title">${esc(libelleAction(l.action))}</div>
        <div class="li-sub">${esc(emails.get(l.user_id) || "—")} · ${cibleHtml(l.cible)}</div>
      </div>
      <div class="li-amount" style="font-size:.76rem;font-weight:500;color:var(--muted)">${new Date(l.created_at).toLocaleString("fr-FR")}</div>
    </div>`).join("")}</div>` : emptyState("🗒️", "Aucune entrée", "Aucune action ne correspond à ces filtres.");
}

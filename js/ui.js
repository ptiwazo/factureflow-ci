/* =====================================================================
   FactureFlow CI — Utilitaires UI & formatage
   Helpers réutilisés par tous les modules (DOM, toasts, formatage XOF,
   validation NCC, calculs TVA…). Aucune logique métier de stockage ici.
===================================================================== */
import { CONFIG } from "./config.js";

/* --------------------------- DOM helpers --------------------------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Échappe le HTML pour éviter toute injection lors d'un rendu en innerHTML.
export function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ----------------------------- Toaster ----------------------------- */
export function toast(message, type = "info", duration = 3200) {
  const root = $("#toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 250);
  }, duration);
}

/* ---------------------------- Formatage ---------------------------- */
// Formate un montant en FCFA : 1 250 000 FCFA (espace insécable comme séparateur).
export function fcfa(montant, devise = CONFIG.DEVISE_DEFAUT) {
  const n = Number(montant) || 0;
  const formatted = Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ");
  return devise === "XOF" ? `${formatted} FCFA` : `${formatted} ${devise}`;
}

// Parse une saisie utilisateur en nombre (tolère espaces et virgule décimale).
export function toNumber(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Date ISO (yyyy-mm-dd) → affichage fr (jj/mm/aaaa).
export function dateFr(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return esc(iso);
  return d.toLocaleDateString("fr-FR");
}

export function moisLabel(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/* ------------------------ Métier Côte d'Ivoire --------------------- */
// Validation du FORMAT du NCC, alignée sur la règle officielle de la FNE (DGI) :
// 7 chiffres suivis d'une lettre majuscule (ex. 9502363N). On tolère un préfixe
// « CC » et les espaces (conventions de saisie courantes). ⚠️ Ceci ne contrôle
// que la forme ; l'existence réelle du NCC relève de la DGI (e-impôts / FNE).
export function nccValide(ncc) {
  if (!ncc) return false;
  const v = String(ncc).trim().toUpperCase().replace(/\s/g, "");
  return /^(CC)?\d{7}[A-Z]$/.test(v);
}

// Recalcule les totaux à partir des lignes. La TVA est calculée PAR LIGNE
// (chaque ligne peut avoir son propre taux : taux mixtes / exonérations).
// `tauxDefaut` s'applique aux lignes sans taux explicite.
// Retourne { total_ht, montant_tva, total_ttc }.
export function calculerTotaux(lignes, tauxDefaut) {
  const def = toNumber(tauxDefaut);
  let total_ht = 0, montant_tva = 0;
  for (const l of lignes || []) {
    const ht = toNumber(l.montant_ht) || 0;
    const taux = l.taux_tva != null && l.taux_tva !== "" ? toNumber(l.taux_tva) : def;
    total_ht += ht;
    montant_tva += ht * taux / 100;
  }
  total_ht = Math.round(total_ht * 100) / 100;
  montant_tva = Math.round(montant_tva * 100) / 100;
  const total_ttc = Math.round((total_ht + montant_tva) * 100) / 100;
  return { total_ht, montant_tva, total_ttc };
}

// Vérifie la cohérence HT/TVA/TTC (tolérance d'arrondi). Renvoie un écart en valeur.
export function ecartCoherence(t) {
  const attendu = (toNumber(t.total_ht) + toNumber(t.montant_tva));
  return Math.abs(attendu - toNumber(t.total_ttc));
}

export const STATUTS = {
  a_verifier:   { label: "À vérifier",   cls: "status-a_verifier" },
  a_controler:  { label: "À contrôler",  cls: "status-a_controler" },
  a_valider:    { label: "À valider",    cls: "status-a_valider" },
  validee:      { label: "Validée",      cls: "status-validee" },
  exportee:     { label: "Exportée",     cls: "status-exportee" },
  non_conforme: { label: "Non conforme", cls: "status-non_conforme" },
};
export function statutBadge(statut) {
  const s = STATUTS[statut] || { label: statut, cls: "" };
  return `<span class="status ${s.cls}">${esc(s.label)}</span>`;
}

/* ----------------------------- Rendu ------------------------------- */
export function setView(html) {
  const v = $("#view");
  v.innerHTML = html;
  v.focus();
  return v;
}

export function loadingView(message = "Chargement…") {
  return setView(`<div class="loading-block"><span class="spinner dark"></span><p>${esc(message)}</p></div>`);
}

export function emptyState(icon, titre, sous = "") {
  return `<div class="empty"><span class="big">${icon}</span><strong>${esc(titre)}</strong>
    ${sous ? `<p class="muted">${esc(sous)}</p>` : ""}</div>`;
}

// Modale simple. onClose facultatif.
export function openModal(innerHtml) {
  closeModal();
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.id = "modal-backdrop";
  back.innerHTML = `<div class="modal"><div class="row between mb">
      <strong>Original de la facture</strong>
      <button class="icon-btn" style="color:var(--text)" id="modal-close">✕</button>
    </div>${innerHtml}</div>`;
  document.body.appendChild(back);
  back.addEventListener("click", (e) => { if (e.target === back) closeModal(); });
  $("#modal-close", back).addEventListener("click", closeModal);
}
export function closeModal() {
  const b = $("#modal-backdrop");
  if (b) b.remove();
}

// Indique l'état d'un bouton pendant une action async.
export function busy(button, on, labelBusy = "Patientez…") {
  if (!button) return;
  if (on) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> ${esc(labelBusy)}`;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

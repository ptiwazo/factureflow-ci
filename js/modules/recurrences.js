/* =====================================================================
   Module — Factures récurrentes / abonnements
   ---------------------------------------------------------------------
   Modèles de charges fixes (loyer, internet, électricité…) qui génèrent une
   facture chaque mois (statut a_controler). Génération manuelle ici + auto
   quotidienne (Netlify Scheduled Function generate-recurrences).
===================================================================== */
import { $, $$, setView, toast, fcfa, esc, emptyState, busy, toNumber } from "../ui.js";
import {
  listerRecurrences, getRecurrence, creerRecurrence, majRecurrence, supprimerRecurrence,
  genererRecurrencesDues, listerFournisseurs,
} from "../store.js";
import { getProfil } from "../auth.js";
import { CONFIG } from "../config.js";
import { PLAN_PAR_SECTION, COMPTES_PAR_NUMERO } from "../comptes-charge-ifrs.js";
import { navigate } from "../app.js";

const peutEcrire = () => ["admin", "saisie", "controle_gestion"].includes(getProfil()?.role);

function optionsComptes(selected) {
  const sel = COMPTES_PAR_NUMERO[selected] ? selected : "";
  const opt = (v, l) => `<option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(l)}</option>`;
  return opt("", "— Non classé —") + PLAN_PAR_SECTION.map((s) =>
    `<optgroup label="${esc(s.prefixe)}xxxx — ${esc(s.label)}">${s.comptes.map((c) =>
      opt(c.compte, `${c.compte} — ${c.labelFr}`)).join("")}</optgroup>`).join("");
}

/* ------------------------------- Liste ----------------------------- */
export async function renderListe() {
  setView(`
    <div class="row between">
      <h1 class="page-title">Abonnements</h1>
      ${peutEcrire() ? `<a href="#/nouvelle-recurrence" class="btn btn-primary btn-sm">+ Nouveau</a>` : ""}
    </div>
    <p class="muted" style="margin-top:-10px;font-size:.85rem">Charges récurrentes générées chaque mois en « à contrôler ».</p>
    ${peutEcrire() ? `<button id="rec-gen" class="btn btn-secondary btn-sm mb">⚡ Générer les factures dues maintenant</button>` : ""}
    <div id="rec-liste"><div class="loading-block"><span class="spinner dark"></span></div></div>
  `);

  if (peutEcrire()) $("#rec-gen").onclick = async (e) => {
    busy(e.currentTarget, true, "Génération…");
    try {
      const n = await genererRecurrencesDues();
      toast(n ? `${n} facture(s) générée(s) → à contrôler.` : "Aucune facture due ce mois-ci.", n ? "success" : "info");
    } catch (err) { toast(err.message || "Échec.", "error"); }
    finally { busy(e.currentTarget, false); }
  };

  try {
    const recs = await listerRecurrences();
    $("#rec-liste").innerHTML = recs.length ? `<div class="list">${recs.map((r) => `
      <a class="list-item" href="#/recurrence/${r.id}">
        <div class="li-main">
          <div class="li-title">${esc(r.designation)}${r.actif ? "" : ` <span style="color:var(--danger)">(inactif)</span>`}</div>
          <div class="li-sub">${esc(r.fournisseurs?.nom || "—")} · le ${r.jour} du mois${r.derniere_periode ? ` · dernier : ${esc(r.derniere_periode)}` : ""}</div>
        </div>
        <div class="li-amount">${fcfa(r.montant_ht, r.devise)}</div>
      </a>`).join("")}</div>`
      : emptyState("🔁", "Aucun abonnement", peutEcrire() ? "Touchez « + Nouveau »." : "");
  } catch (e) { $("#rec-liste").innerHTML = emptyState("⚠️", "Erreur", e.message); }
}

/* --------------------------- Formulaire ---------------------------- */
export function renderNouvelle() { return renderForm(null); }

export async function renderForm(id) {
  if (id === "nouvelle") return renderForm(null);
  if (!peutEcrire()) { navigate("#/recurrences"); return; }
  setView(`<div class="loading-block"><span class="spinner dark"></span></div>`);

  let r = null, fournisseurs = [];
  try {
    fournisseurs = await listerFournisseurs();
    if (id) { r = await getRecurrence(id); if (!r) { setView(emptyState("🔍", "Abonnement introuvable")); return; } }
  } catch (e) { setView(emptyState("⚠️", "Erreur", e.message)); return; }

  const v = r || { taux_tva: CONFIG.TVA_DEFAUT, jour: 1, devise: CONFIG.DEVISE_DEFAUT, actif: true };
  setView(`
    <div class="row between"><a href="#/recurrences" class="btn btn-ghost btn-sm">← Abonnements</a></div>
    <h1 class="page-title">${id ? "Modifier l'abonnement" : "Nouvel abonnement"}</h1>
    <div class="card">
      <div class="field"><label for="r-des">Désignation</label>
        <input id="r-des" type="text" value="${esc(v.designation || "")}" placeholder="Ex. Loyer bureau" /></div>
      <div class="field"><label for="r-fourn">Fournisseur</label>
        <select id="r-fourn"><option value="">— Aucun —</option>
          ${fournisseurs.map((f) => `<option value="${esc(f.id)}"${f.id === v.fournisseur_id ? " selected" : ""}>${esc(f.nom)}</option>`).join("")}</select></div>
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="r-ht">Montant HT</label><input id="r-ht" type="number" step="0.01" value="${v.montant_ht ?? 0}" /></div>
        <div class="grow field"><label for="r-tva">Taux TVA (%)</label><input id="r-tva" type="number" step="0.01" value="${v.taux_tva ?? CONFIG.TVA_DEFAUT}" /></div>
        <div class="field" style="max-width:110px"><label for="r-jour">Jour</label><input id="r-jour" type="number" min="1" max="28" value="${v.jour || 1}" /></div>
      </div>
      <div class="field"><label for="r-cat">Compte de charge (IFRS)</label>
        <select id="r-cat">${optionsComptes(v.categorie)}</select></div>
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="r-debut">Début <small>(facultatif)</small></label><input id="r-debut" type="date" value="${v.date_debut || ""}" /></div>
        <div class="grow field"><label for="r-fin">Fin <small>(facultatif)</small></label><input id="r-fin" type="date" value="${v.date_fin || ""}" /></div>
      </div>
      <label class="row" style="gap:8px"><input id="r-actif" type="checkbox" ${v.actif !== false ? "checked" : ""} style="width:auto" /> Actif</label>
    </div>
    <div class="row wrap" style="gap:10px;margin-bottom:24px">
      <a href="#/recurrences" class="btn btn-ghost grow">Annuler</a>
      <button id="r-save" class="btn btn-primary grow">${id ? "Enregistrer" : "Créer l'abonnement"}</button>
      ${id ? `<button id="r-suppr" class="btn btn-danger">Supprimer</button>` : ""}
    </div>
  `);

  $("#r-save").onclick = async (e) => {
    const designation = $("#r-des").value.trim();
    if (!designation) return toast("Indiquez une désignation.", "warn");
    const data = {
      designation, fournisseur_id: $("#r-fourn").value || null,
      montant_ht: toNumber($("#r-ht").value), taux_tva: toNumber($("#r-tva").value),
      categorie: $("#r-cat").value || null, devise: v.devise || CONFIG.DEVISE_DEFAUT,
      jour: Math.min(28, Math.max(1, Math.round(toNumber($("#r-jour").value)) || 1)),
      actif: $("#r-actif").checked, date_debut: $("#r-debut").value || null, date_fin: $("#r-fin").value || null,
    };
    busy(e.currentTarget, true, "Enregistrement…");
    try {
      if (id) { await majRecurrence(id, data); toast("Abonnement mis à jour.", "success"); }
      else { await creerRecurrence(data); toast("Abonnement créé.", "success"); }
      navigate("#/recurrences");
    } catch (err) { busy(e.currentTarget, false); toast(err.message || "Échec.", "error"); }
  };

  const sup = $("#r-suppr");
  if (sup) sup.onclick = async () => {
    if (!confirm("Supprimer cet abonnement ? Les factures déjà générées sont conservées.")) return;
    try { await supprimerRecurrence(id); toast("Abonnement supprimé.", "info"); navigate("#/recurrences"); }
    catch (e) { toast(e.message, "error"); }
  };
}

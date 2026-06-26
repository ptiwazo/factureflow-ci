/* =====================================================================
   Module — Bons de commande & rapprochement facture↔commande
   ---------------------------------------------------------------------
   Création (en-tête + lignes), liste, et détail avec rapprochement PAR MONTANT :
   commandé (total HT) vs déjà facturé (somme HT des factures rattachées, hors
   non conformes) → reste à facturer + écart. Le rapprochement ligne-à-ligne
   n'est pas (encore) géré : seul le montant fait foi.
===================================================================== */
import { $, $$, setView, toast, fcfa, dateFr, esc, emptyState, busy, toNumber } from "../ui.js";
import {
  listerCommandes, getCommande, getCommandeLignes, creerCommandeComplete,
  majStatutCommande, supprimerCommande, facturesParCommande, listerFournisseurs, journaliser,
} from "../store.js";
import { getProfil } from "../auth.js";
import { CONFIG } from "../config.js";
import { navigate } from "../app.js";

const peutEcrire = () => ["admin", "saisie", "controle_gestion"].includes(getProfil()?.role);

const STATUT_CMD = {
  ouverte: { label: "Ouverte", bg: "#FEF3C7", c: "#B45309" },
  soldee: { label: "Soldée", bg: "#DCFCE7", c: "#15803D" },
  annulee: { label: "Annulée", bg: "#FEE2E2", c: "#B91C1C" },
};
const badgeCmd = (s) => {
  const x = STATUT_CMD[s] || STATUT_CMD.ouverte;
  return `<span class="status" style="background:${x.bg};color:${x.c}">${x.label}</span>`;
};

/* ------------------------------- Liste ----------------------------- */
export async function renderListe() {
  setView(`
    <div class="row between">
      <h1 class="page-title">Bons de commande</h1>
      ${peutEcrire() ? `<a href="#/nouvelle-commande" class="btn btn-primary btn-sm">+ Nouvelle</a>` : ""}
    </div>
    <input id="cmd-rech" type="search" placeholder="Rechercher (n°, fournisseur)…" class="mb" />
    <div id="cmd-liste"><div class="loading-block"><span class="spinner dark"></span></div></div>
  `);

  let toutes = [];
  try { toutes = await listerCommandes(); }
  catch (e) { $("#cmd-liste").innerHTML = emptyState("⚠️", "Erreur", e.message); return; }

  const dessiner = (items) => {
    $("#cmd-liste").innerHTML = items.length ? `<div class="list">${items.map((c) => `
      <a class="list-item" href="#/commande/${c.id}">
        <div class="li-main">
          <div class="li-title">${esc(c.fournisseurs?.nom || "Fournisseur inconnu")}</div>
          <div class="li-sub">${esc(c.numero || "sans n°")} · ${dateFr(c.date)} · ${badgeCmd(c.statut)}</div>
        </div>
        <div class="li-amount">${fcfa(c.total_ht, c.devise)}</div>
      </a>`).join("")}</div>`
      : emptyState("📦", "Aucune commande", peutEcrire() ? "Touchez « + Nouvelle »." : "");
  };
  dessiner(toutes);
  $("#cmd-rech").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    dessiner(toutes.filter((c) => `${c.numero || ""} ${c.fournisseurs?.nom || ""}`.toLowerCase().includes(q)));
  });
}

/* ----------------------------- Création ---------------------------- */
export async function renderNouvelle() {
  if (!peutEcrire()) { navigate("#/commandes"); return; }
  setView(`<div class="loading-block"><span class="spinner dark"></span></div>`);
  let fournisseurs = [];
  try { fournisseurs = await listerFournisseurs(); }
  catch (e) { setView(emptyState("⚠️", "Erreur", e.message)); return; }

  setView(`
    <div class="row between"><a href="#/commandes" class="btn btn-ghost btn-sm">← Commandes</a></div>
    <h1 class="page-title">Nouvelle commande</h1>
    <div class="card">
      <div class="field"><label for="c-fourn">Fournisseur</label>
        <select id="c-fourn"><option value="">— Choisir —</option>
          ${fournisseurs.map((f) => `<option value="${esc(f.id)}">${esc(f.nom)}</option>`).join("")}</select></div>
      <div class="row" style="gap:12px">
        <div class="grow field"><label for="c-num">N° commande</label><input id="c-num" type="text" /></div>
        <div class="grow field"><label for="c-date">Date</label><input id="c-date" type="date" /></div>
      </div>
    </div>
    <div class="card">
      <div class="row between"><h3>Lignes</h3><button id="c-add" class="btn btn-secondary btn-sm">+ Ligne</button></div>
      <div style="overflow-x:auto">
        <table class="lignes-table">
          <thead><tr><th class="col-des">Désignation</th><th>Qté</th><th>P.U.</th><th>Montant HT</th><th></th></tr></thead>
          <tbody id="c-body"></tbody>
        </table>
      </div>
      <div class="totaux-box"><div class="totaux-row grand"><span>Total HT</span><strong id="c-total">—</strong></div></div>
    </div>
    <div class="row" style="gap:10px;margin-bottom:24px">
      <a href="#/commandes" class="btn btn-ghost grow">Annuler</a>
      <button id="c-save" class="btn btn-primary grow">Enregistrer la commande</button>
    </div>
  `);

  const body = $("#c-body");
  const addLigne = () => body.appendChild(ligneRow());
  addLigne();
  $("#c-add").onclick = addLigne;
  $("#c-save").onclick = (e) => enregistrer(e.currentTarget);
  recalc();
}

function ligneRow() {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="col-des"><input class="cl-des" type="text" /></td>
    <td><input class="cl-qte" type="number" step="0.001" value="1" style="width:60px" /></td>
    <td><input class="cl-pu" type="number" step="0.01" value="0" style="width:90px" /></td>
    <td><input class="cl-ht" type="number" step="0.01" value="0" style="width:100px" /></td>
    <td><button class="icon-btn cl-del" style="color:var(--danger)" title="Supprimer">✕</button></td>`;
  const qte = tr.querySelector(".cl-qte"), pu = tr.querySelector(".cl-pu"), ht = tr.querySelector(".cl-ht");
  let manuel = false;
  const auto = () => { if (!manuel) ht.value = (toNumber(qte.value) * toNumber(pu.value)).toFixed(2); recalc(); };
  qte.addEventListener("input", auto);
  pu.addEventListener("input", auto);
  ht.addEventListener("input", () => { manuel = true; recalc(); });
  tr.querySelector(".cl-del").addEventListener("click", () => { tr.remove(); recalc(); });
  return tr;
}

function lireLignes() {
  return $$("#c-body tr").map((tr) => ({
    designation: tr.querySelector(".cl-des").value.trim(),
    quantite: toNumber(tr.querySelector(".cl-qte").value),
    prix_unitaire: toNumber(tr.querySelector(".cl-pu").value),
    montant_ht: toNumber(tr.querySelector(".cl-ht").value),
  })).filter((l) => l.designation || l.montant_ht);
}

function recalc() {
  const total = lireLignes().reduce((s, l) => s + l.montant_ht, 0);
  $("#c-total").textContent = fcfa(Math.round(total * 100) / 100);
}

async function enregistrer(btn) {
  const fournisseur_id = $("#c-fourn").value || null;
  if (!fournisseur_id) return toast("Choisissez un fournisseur.", "warn");
  const lignes = lireLignes();
  if (!lignes.length) return toast("Ajoutez au moins une ligne.", "warn");
  const total_ht = Math.round(lignes.reduce((s, l) => s + l.montant_ht, 0) * 100) / 100;

  busy(btn, true, "Enregistrement…");
  try {
    const cmd = await creerCommandeComplete({
      entete: { fournisseur_id, numero: $("#c-num").value.trim(), date: $("#c-date").value || null, devise: CONFIG.DEVISE_DEFAUT, total_ht },
      lignes,
    });
    toast("Commande enregistrée.", "success");
    navigate(`#/commande/${cmd.id}`);
  } catch (e) { busy(btn, false); toast(e.message || "Échec.", "error"); }
}

/* ------------------------------ Détail ----------------------------- */
export async function renderDetail(id) {
  if (id === "nouvelle") return renderNouvelle();
  if (!id) return navigate("#/commandes");
  setView(`<div class="loading-block"><span class="spinner dark"></span></div>`);

  let c, lignes, factures;
  try {
    c = await getCommande(id);
    if (!c) { setView(emptyState("🔍", "Commande introuvable")); return; }
    [lignes, factures] = await Promise.all([getCommandeLignes(id), facturesParCommande(id)]);
  } catch (e) { setView(emptyState("⚠️", "Erreur", e.message)); return; }

  const facture = factures.filter((f) => f.statut !== "non_conforme")
    .reduce((s, f) => s + (Number(f.total_ht) || 0), 0);
  const commande = Number(c.total_ht) || 0;
  const reste = Math.round((commande - facture) * 100) / 100;
  const ecart = Math.round((facture - commande) * 100) / 100;
  const surFacture = ecart > 0.01;
  const ecrit = peutEcrire();

  setView(`
    <div class="row between"><a href="#/commandes" class="btn btn-ghost btn-sm">← Commandes</a>${badgeCmd(c.statut)}</div>
    <h1 class="page-title">${esc(c.fournisseurs?.nom || "Fournisseur inconnu")}</h1>
    <div class="card"><div class="detail-grid">
      <div><div class="dt">N° commande</div><div class="dd">${esc(c.numero || "—")}</div></div>
      <div><div class="dt">Date</div><div class="dd">${dateFr(c.date)}</div></div>
      <div><div class="dt">Total commandé HT</div><div class="dd">${fcfa(commande, c.devise)}</div></div>
    </div></div>

    <div class="card">
      <h3>Rapprochement</h3>
      <div class="kpi-grid">
        <div class="kpi accent-teal"><div class="kpi-label">Commandé HT</div><div class="kpi-value" style="font-size:1.05rem">${fcfa(commande)}</div></div>
        <div class="kpi"><div class="kpi-label">Déjà facturé HT</div><div class="kpi-value" style="font-size:1.05rem">${fcfa(facture)}</div></div>
        <div class="kpi ${surFacture ? "accent-danger" : "accent-teal"}"><div class="kpi-label">${surFacture ? "Sur-facturation" : "Reste à facturer"}</div>
          <div class="kpi-value" style="font-size:1.05rem">${fcfa(surFacture ? ecart : Math.max(0, reste))}</div></div>
      </div>
      ${surFacture ? `<div class="alert alert-danger">⚠️ <div>Le montant facturé dépasse la commande de <strong>${fcfa(ecart)}</strong>. À vérifier.</div></div>`
        : (reste <= 0.01 && commande > 0 ? `<div class="alert alert-info">✅ <div>Commande entièrement facturée.</div></div>` : "")}
      <h4 style="margin:12px 0 6px">Factures rattachées (${factures.length})</h4>
      ${factures.length ? `<div class="list">${factures.map((f) => `
        <a class="list-item" href="#/facture/${f.id}">
          <div class="li-main"><div class="li-title">${esc(f.numero || "sans n°")}</div>
            <div class="li-sub">${dateFr(f.date)} · ${esc(f.statut)}</div></div>
          <div class="li-amount">${fcfa(f.total_ht, c.devise)}</div></a>`).join("")}</div>`
        : `<p class="muted">Aucune facture rattachée. Liez-la depuis le détail d'une facture (« Rapprocher à une commande »).</p>`}
    </div>

    <div class="card">
      <h3>Lignes commandées</h3>
      <div style="overflow-x:auto"><table class="lignes-table">
        <thead><tr><th class="col-des">Désignation</th><th>Qté</th><th>P.U.</th><th>Montant HT</th></tr></thead>
        <tbody>${lignes.map((l) => `<tr><td class="col-des">${esc(l.designation)}</td><td>${l.quantite}</td>
          <td>${fcfa(l.prix_unitaire, c.devise)}</td><td>${fcfa(l.montant_ht, c.devise)}</td></tr>`).join("")
          || `<tr><td colspan="4" class="muted">Aucune ligne</td></tr>`}</tbody>
      </table></div>
    </div>

    ${ecrit ? `<div class="row wrap" style="gap:10px;margin-bottom:24px">
      ${c.statut !== "soldee" ? `<button id="cmd-solder" class="btn btn-secondary">Marquer soldée</button>` : `<button id="cmd-rouvrir" class="btn btn-secondary">Rouvrir</button>`}
      ${c.statut !== "annulee" ? `<button id="cmd-annuler" class="btn btn-ghost">Annuler la commande</button>` : ""}
      <button id="cmd-suppr" class="btn btn-danger">Supprimer</button>
    </div>` : ""}
  `);

  const maj = async (statut, btn) => {
    busy(btn, true, "…");
    try { await majStatutCommande(id, statut); renderDetail(id); }
    catch (e) { busy(btn, false); toast(e.message, "error"); }
  };
  $("#cmd-solder") && ($("#cmd-solder").onclick = (e) => maj("soldee", e.currentTarget));
  $("#cmd-rouvrir") && ($("#cmd-rouvrir").onclick = (e) => maj("ouverte", e.currentTarget));
  $("#cmd-annuler") && ($("#cmd-annuler").onclick = (e) => maj("annulee", e.currentTarget));
  const bs = $("#cmd-suppr");
  if (bs) bs.onclick = async () => {
    if (!confirm("Supprimer cette commande ? Les factures rattachées seront déliées.")) return;
    try { await supprimerCommande(id); toast("Commande supprimée.", "info"); navigate("#/commandes"); }
    catch (e) { toast(e.message, "error"); }
  };
}

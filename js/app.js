/* =====================================================================
   FactureFlow CI — Bootstrap & routeur (hash-based)
   ---------------------------------------------------------------------
   - Enregistre le Service Worker (PWA).
   - Gère l'écran d'authentification ↔ application.
   - Route les vues vers les modules fonctionnels.
   Un "brouillon d'extraction" (résultat IA) transite de capture → vérification
   via le store mémoire `draft` (jamais persisté tant que l'utilisateur n'a pas validé).
===================================================================== */
import { $, $$, toast } from "./ui.js";
import {
  chargerProfil, getProfil, connexion, inscription,
  deconnexion, onAuthChange, creerOrganisation,
} from "./auth.js";

import * as dashboard    from "./modules/dashboard.js";
import * as capture      from "./modules/capture.js";
import * as verification from "./modules/verification.js";
import * as factures     from "./modules/factures.js";
import * as fournisseurs from "./modules/fournisseurs.js";
import * as settings     from "./modules/settings.js";

// Brouillon d'extraction partagé entre capture et vérification.
export const draft = { data: null, fichier: null, apercu: null };

/* ----------------------------- Routeur ----------------------------- */
const routes = {
  dashboard:       (p) => dashboard.render(p),
  capture:         (p) => capture.render(p),
  verification:    (p) => verification.render(p),
  factures:        (p) => factures.renderListe(p),
  facture:         (p) => factures.renderDetail(p),
  fournisseurs:    (p) => fournisseurs.renderListe(p),
  fournisseur:     (p) => fournisseurs.renderDetail(p),
  settings:        (p) => settings.render(p),
};

function parseHash() {
  const raw = (location.hash || "#/dashboard").replace(/^#\/?/, "");
  const [name, param] = raw.split("/");
  return { name: name || "dashboard", param };
}

async function router() {
  // Routage uniquement si une session + org sont présentes.
  const profil = getProfil();
  if (!profil?.org_id) return;

  const { name, param } = parseHash();
  const handler = routes[name] || routes.dashboard;
  marquerOnglet(name);
  try {
    await handler(param);
  } catch (e) {
    console.error(e);
    toast(e.message || "Erreur d'affichage.", "error");
  }
}

function marquerOnglet(name) {
  $$(".tabbar-item").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === name ||
      (name === "facture" && a.dataset.route === "factures") ||
      (name === "fournisseur" && a.dataset.route === "fournisseurs") ||
      (name === "verification" && a.dataset.route === "capture"));
  });
}

export function navigate(hash) { location.hash = hash; }

/* --------------------------- Écran Auth ---------------------------- */
let modeAuth = "login";

function initAuthUI() {
  $$("[data-auth-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      modeAuth = btn.dataset.authTab;
      $$("[data-auth-tab]").forEach((b) => b.classList.toggle("active", b === btn));
      $$(".signup-only").forEach((el) => el.classList.toggle("hidden", modeAuth !== "signup"));
      $("#auth-submit").textContent = modeAuth === "signup" ? "Créer mon compte" : "Se connecter";
      $("#auth-error").textContent = "";
    });
  });

  $("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim();
    const password = $("#password").value;
    const errBox = $("#auth-error");
    const submit = $("#auth-submit");
    errBox.textContent = "";
    submit.disabled = true;

    try {
      if (modeAuth === "signup") {
        const orgNom = $("#org-nom").value.trim();
        const orgNcc = $("#org-ncc").value.trim();
        if (!orgNom) throw new Error("Indiquez le nom de votre entreprise.");
        await inscription(email, password, orgNom, orgNcc);
        toast("Compte créé. Bienvenue !", "success");
      } else {
        await connexion(email, password);
      }
      await demarrerSession();
    } catch (err) {
      errBox.textContent = err.message || "Échec.";
    } finally {
      submit.disabled = false;
    }
  });

  $("#btn-logout").addEventListener("click", async () => {
    await deconnexion();
    afficherAuth();
    toast("Déconnecté.", "info");
  });
}

/* ----------------------- Onboarding (org absente) ------------------ */
// Cas : utilisateur connecté mais pas encore rattaché à une organisation
// (ex. confirmation e-mail différée). On lui propose de la créer.
function afficherOnboarding() {
  basculer({ auth: false, app: true });
  $("#view").innerHTML = `
    <h1 class="page-title">Dernière étape</h1>
    <div class="card">
      <p class="muted mb">Créez votre organisation pour commencer à enregistrer vos factures.</p>
      <div class="field"><label for="ob-nom">Nom de l'entreprise</label>
        <input id="ob-nom" type="text" placeholder="Ex. Établissements Kouassi" /></div>
      <div class="field"><label for="ob-ncc">NCC <small>(facultatif)</small></label>
        <input id="ob-ncc" type="text" placeholder="Numéro de Compte Contribuable" /></div>
      <button id="ob-submit" class="btn btn-primary btn-block">Créer l'organisation</button>
    </div>`;
  $("#ob-submit").addEventListener("click", async () => {
    const nom = $("#ob-nom").value.trim();
    if (!nom) return toast("Le nom est requis.", "warn");
    try {
      await creerOrganisation(nom, $("#ob-ncc").value.trim());
      await demarrerSession();
    } catch (e) { toast(e.message, "error"); }
  });
}

/* ----------------------- Cycle de session -------------------------- */
function basculer({ auth, app }) {
  const a = $("#auth-screen"), s = $("#app-shell");
  a.classList.toggle("hidden", !auth); a.setAttribute("aria-hidden", String(!auth));
  s.classList.toggle("hidden", !app);  s.setAttribute("aria-hidden", String(!app));
}

function afficherAuth() {
  basculer({ auth: true, app: false });
}

async function demarrerSession() {
  const profil = await chargerProfil();
  if (!profil) { afficherAuth(); return; }
  if (!profil.org_id) { afficherOnboarding(); return; }

  // Session complète : on affiche l'app.
  basculer({ auth: false, app: true });
  $("#org-badge").textContent = profil.org_nom || "";
  if (!location.hash || location.hash === "#") location.hash = "#/dashboard";
  router();
}

/* ----------------------------- Boot -------------------------------- */
async function boot() {
  initAuthUI();
  window.addEventListener("hashchange", router);

  // Le SW est facultatif : il améliore le démarrage mais ne doit pas bloquer.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }

  // Rafraîchit l'UI si la session disparaît ailleurs (déconnexion autre onglet,
  // expiration). On ne relance pas la session ici pour éviter les boucles.
  onAuthChange(() => {
    chargerProfil().then((p) => { if (!p) afficherAuth(); });
  });

  await demarrerSession();
}

boot();

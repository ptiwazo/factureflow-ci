/* =====================================================================
   FactureFlow CI — Authentification (Supabase Auth)
   ---------------------------------------------------------------------
   Crée le client Supabase partagé (importé par store.js et ai.js) et
   expose les fonctions de session : connexion, inscription (+ création
   de l'organisation), déconnexion, récupération du profil (org + rôle)
   et du JWT à transmettre au proxy IA.
===================================================================== */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CONFIG } from "./config.js";

// Client Supabase unique pour toute l'application.
export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Profil applicatif courant : { user, org_id, role, org_nom }.
let profilCourant = null;

export function getProfil() {
  return profilCourant;
}

// Connexion par e-mail / mot de passe.
export async function connexion(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(traduireErreur(error.message));
  return data.user;
}

// Inscription : crée le compte Auth puis rattache l'utilisateur à une
// organisation selon `opts.mode` : 'create' (devient admin) ou 'join' (rejoint
// via un code d'invitation, rôle saisie).
// opts = { mode:'create'|'join', orgNom, orgNcc, code }
export async function inscription(email, password, opts = {}) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(traduireErreur(error.message));

  // Selon la config Supabase, une confirmation e-mail peut être requise.
  // Si une session est active immédiatement, on effectue le rattachement.
  const { data: sess } = await supabase.auth.getSession();
  if (sess?.session) {
    const err = await rattacher(opts);
    if (err) throw new Error("Compte créé mais rattachement non finalisé : " + err);
  }
  // needConfirmation = pas de session après inscription (confirmation e-mail exigée).
  return { user: data.user, session: sess?.session || null, needConfirmation: !sess?.session };
}

// Appelle le bon RPC selon le mode. Renvoie un message d'erreur ou null.
async function rattacher({ mode, orgNom, orgNcc, code } = {}) {
  if (mode === "join") {
    const { error } = await supabase.rpc("rejoindre_organisation", { p_code: code });
    return error ? traduireErreur(error.message) : null;
  }
  const { error } = await supabase.rpc("creer_organisation", { p_nom: orgNom, p_ncc: orgNcc || null });
  return error ? traduireErreur(error.message) : null;
}

export async function deconnexion() {
  await supabase.auth.signOut();
  profilCourant = null;
}

// Charge le profil applicatif (org + rôle) pour l'utilisateur connecté.
// Renvoie null si pas de session ou pas encore rattaché à une org.
export async function chargerProfil() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { profilCourant = null; return null; }

  const { data, error } = await supabase
    .from("users")
    .select("org_id, role, organisations(nom)")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !data) {
    // Session valide mais utilisateur non rattaché (ex. confirmation e-mail
    // en attente, ou org non créée). On garde l'user pour permettre l'onboarding.
    profilCourant = { user: session.user, org_id: null, role: null, org_nom: null, erp: "sap" };
    return profilCourant;
  }

  profilCourant = {
    user: session.user,
    org_id: data.org_id,
    role: data.role,
    org_nom: data.organisations?.nom || "Mon organisation",
    erp: "sap",
  };

  // ERP en best-effort : tolère l'absence de la colonne `erp` (migration_erp.sql
  // pas encore appliquée). En cas d'erreur, on conserve le repli 'sap' sans
  // jamais faire échouer le chargement du profil.
  const { data: org } = await supabase
    .from("organisations").select("erp").eq("id", data.org_id).maybeSingle();
  if (org?.erp) profilCourant.erp = org.erp;

  // Super admin de plateforme (best-effort : tolère l'absence de la fonction).
  profilCourant.superAdmin = false;
  const { data: sa } = await supabase.rpc("is_super_admin");
  if (sa === true) profilCourant.superAdmin = true;

  return profilCourant;
}

// Crée l'organisation pour un utilisateur connecté mais non rattaché
// (cas confirmation e-mail différée). Utilisé par l'écran d'onboarding.
export async function creerOrganisation(orgNom, orgNcc) {
  const { error } = await supabase.rpc("creer_organisation", {
    p_nom: orgNom, p_ncc: orgNcc || null,
  });
  if (error) throw new Error(traduireErreur(error.message));
  return chargerProfil();
}

// Rejoint une organisation existante via son code d'invitation (rôle saisie).
export async function rejoindreOrganisation(code) {
  const { error } = await supabase.rpc("rejoindre_organisation", { p_code: code });
  if (error) throw new Error(traduireErreur(error.message));
  return chargerProfil();
}

// Jeton d'accès courant, transmis en Bearer au proxy IA.
export async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// Réagit aux changements de session (login/logout) pour rafraîchir l'UI.
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, _session) => callback());
}

// Messages d'erreur Supabase → français lisible.
function traduireErreur(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "E-mail non confirmé. Cliquez le lien reçu par e-mail, puis connectez-vous.";
  if (m.includes("already registered")) return "Cet e-mail est déjà utilisé.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "Les inscriptions sont désactivées sur le projet Supabase (à activer dans Authentication).";
  if (m.includes("invitation invalide") || m.includes("code d'invitation"))
    return "Code d'invitation invalide. Vérifiez-le auprès de l'administrateur de l'organisation.";
  if (m.includes("déjà rattaché")) return "Ce compte est déjà rattaché à une organisation.";
  if (m.includes("nom d'organisation requis") || m.includes("nom d''organisation"))
    return "Indiquez le nom de l'entreprise.";
  if (m.includes("could not find the function") || m.includes("does not exist"))
    return "Fonctionnalité non encore activée côté serveur (migration à appliquer).";
  if (m.includes("password")) return "Mot de passe trop court (6 caractères minimum).";
  if (m.includes("email")) return "Adresse e-mail invalide.";
  return msg || "Une erreur est survenue.";
}

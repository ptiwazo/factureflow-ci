/* =====================================================================
   FactureFlow CI — Client des notifications du circuit
   ---------------------------------------------------------------------
   Appelle la Netlify Function `notify` (envoi e-mail SMTP). TOUJOURS
   best-effort : un échec de notification ne doit jamais bloquer l'action
   métier (validation, paiement…). Le JWT Supabase authentifie l'appel ;
   les destinataires sont déterminés côté serveur (RLS de l'utilisateur).
===================================================================== */
import { CONFIG } from "./config.js";
import { getAccessToken } from "./auth.js";

// evenement : 'a_controler' | 'a_valider' | 'validee' | 'retards'
export async function notifierCircuit(evenement, factureId) {
  try {
    const token = await getAccessToken();
    if (!token) return;
    await fetch(CONFIG.NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ event: evenement, factureId: factureId || null }),
    });
  } catch { /* best-effort : silencieux */ }
}

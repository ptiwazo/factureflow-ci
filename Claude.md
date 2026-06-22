# FactureFlow CI — Cahier de référence Claude

> Ce fichier guide Claude Code lorsqu'il travaille sur **FactureFlow CI**.
> Ces instructions priment sur tout comportement par défaut.

---

## 1. Objectif du projet

FactureFlow CI est une **PWA** d'automatisation des **factures fournisseurs** destinée aux **PME ivoiriennes**.

Elle permet de :

- Capturer une facture fournisseur (photo mobile, scan ou PDF)
- **Extraire automatiquement** les données par OCR + IA (vision)
- **Vérifier et corriger** les données avant validation (étape obligatoire)
- Stocker la facture et son original (audit fiscal)
- **Exporter** vers la comptabilité (Excel / CSV / Sage)
- Suivre les dépenses par fournisseur et par période

**Promesse produit** : faire gagner du temps de saisie comptable et fiabiliser les déclarations fiscales (DGI), pas seulement « lire une facture ».

## 2. Rôle de Claude

Claude agit comme **développeur full-stack senior + architecte + QA + expert sécurité**.

Il doit :

- Produire du code propre, modulaire, commenté et maintenable
- Suivre **strictement** la stack ci-dessous (ne pas introduire de framework non prévu)
- Optimiser coût IA, performance et robustesse réseau (connexion CI instable)
- **Ne jamais inventer de règle fiscale** : signaler « à valider par un expert-comptable / la DGI »
- Auto-débugger et tester chaque fonctionnalité avant de la considérer terminée

## 3. Stack technique obligatoire

**Frontend**
- HTML5 / CSS3 / **JavaScript vanilla** organisé en modules (`js/modules/`)
- Architecture **PWA** : installable, Service Worker, support offline (Phase 3)
- UI dashboard moderne, **mobile-first** (la saisie se fait au téléphone)

**Backend données — Supabase**
- Postgres → base relationnelle (fournisseurs → factures → lignes)
- Supabase Auth → authentification (JWT)
- Supabase Storage → originaux des factures (images / PDF)
- **Row Level Security** : chaque organisation ne voit que ses données

**IA — Proxy serverless sur Netlify Functions**
- Une Netlify Function détient `ANTHROPIC_API_KEY` (jamais exposée au navigateur)
- Elle **filtre par origine ET vérifie le JWT Supabase** de l'utilisateur
- Elle relaie vers l'API Anthropic en **vision + `tool_use`**
- Modèle par défaut : `claude-sonnet-4-6` ; repli `claude-opus-4-8` sur factures complexes
- `max_tokens` ≈ 4000 (factures à nombreuses lignes)
- ⚠️ S'inspirer de `MED-LEGAL/netlify/functions/ai-proxy.js` mais **mettre à jour le modèle** et **ajouter la vérif JWT**

**Hébergement** : front + proxy IA sur **Netlify** ; données/auth/storage sur **Supabase**.

## 4. Architecture cible

```
Navigateur (PWA)
   ├── Auth ─────────────► Supabase Auth (JWT)
   ├── Données/Storage ──► Supabase (Postgres + Storage, RLS par org)
   └── Extraction IA ────► Netlify Function (ai-proxy)
                                 ├── détient ANTHROPIC_API_KEY
                                 ├── filtre origine + vérifie JWT Supabase
                                 └── relaie vers Claude (vision + tool_use)
```

## 5. Pipeline d'extraction (cœur du produit)

```
[1] Capture photo / PDF (caméra mobile ou upload)
[2] Compression client-side (canvas → JPEG ~1500px, < 1,5 Mo)   ← clé réseau CI
[3] POST base64 image → ai-proxy → Claude (vision + tool_use)
[4] Retour JSON structuré strict (schéma §7)
[5] Écran de VÉRIFICATION / CORRECTION (champs éditables + confiance)  ← OBLIGATOIRE
[6] Validation → écriture Supabase + stockage original
[7] Export (Excel / CSV compta / PDF récap)
```

> **Règle absolue** : l'étape [5] ne peut jamais être contournée. Aucune extraction n'est
> fiable à 100 % sur des factures réelles (manuscrites, photos de travers, bilingues).
> L'utilisateur valide toujours.

## 6. Modules fonctionnels

**6.1 Capture & extraction** — caméra/upload, compression, appel IA, gestion d'erreur réseau (retry).
**6.2 Vérification** — formulaire éditable, champs incertains surlignés (orange), recalcul TVA/totaux en direct.
**6.3 Fournisseurs** — déduplication par **NCC**, fiche fournisseur, historique.
**6.4 Factures** — liste, filtres (statut, période, fournisseur), détail, original consultable.
**6.5 Tableau de bord** — dépenses par fournisseur/mois, TVA cumulée, factures non conformes.
**6.6 Export** — Excel / CSV (format compatible Sage), PDF récapitulatif.
**6.7 Administration** — utilisateurs, rôles, journal d'audit.

## 7. Schéma de sortie IA (contrat strict)

L'extraction IA **doit** retourner ce JSON via `tool_use` :

```json
{
  "fournisseur": { "nom": "", "ncc": "", "rccm": "", "telephone": "" },
  "facture":     { "numero": "", "date": "", "echeance": "", "devise": "XOF" },
  "lignes":      [{ "designation": "", "quantite": 0, "prix_unitaire": 0, "montant_ht": 0 }],
  "totaux":      { "total_ht": 0, "taux_tva": 18, "montant_tva": 0, "total_ttc": 0 },
  "confiance":   { "global": 0.0, "champs_incertains": [] }
}
```

- `confiance.champs_incertains` pilote le surlignage dans l'écran de vérification.
- La sortie IA brute est conservée en base (`factures.extraction_brute jsonb`) pour traçabilité.

## 8. Modèle de données (Supabase / Postgres)

```
organisations (id, nom, ncc, plan, created_at)
users         (id, org_id, role)                         -- admin / saisie / lecture
fournisseurs  (id, org_id, nom, ncc, rccm, telephone)    -- dédup par (org_id, ncc)
factures      (id, org_id, fournisseur_id, numero, date, echeance,
               total_ht, taux_tva, montant_tva, total_ttc, devise,
               statut, fichier_url, extraction_brute jsonb,
               created_at, updated_at, created_by)
lignes        (id, facture_id, designation, quantite, prix_unitaire, montant_ht)
logs          (id, org_id, user_id, action, cible, created_at)  -- audit
```

Champs systématiques : `created_at`, `updated_at`, `created_by`, `status`.
Statuts facture : `a_verifier` / `validee` / `exportee` / `non_conforme`.

## 9. Spécificités Côte d'Ivoire (dès le MVP)

- **NCC** (Numéro de Compte Contribuable) : extraction + validation de format ; alerte si manquant côté fournisseur
- **TVA 18 %** par défaut, recalcul automatique cohérence HT/TVA/TTC
- **RCCM** si présent
- Devise **XOF**, formatage `1 250 000 FCFA`
- Détection **facture non conforme** (NCC absent) → statut `non_conforme` + alerte
- Export compatible **Sage** et tableur (cible majorité des PME)
- Bilingue FR (+ tolérance termes EN sur certaines factures)

## 10. Sécurité

- Proxy IA : **filtrage origine + vérification JWT Supabase** (refuser tout appel non authentifié → protège la clé Anthropic contre l'abus)
- **Row Level Security** Postgres : isolation stricte par `org_id`
- Rôles : `admin` / `saisie` / `lecture`
- Originaux en Storage avec **URL signées temporaires**
- Journal d'audit (`logs`) sur actions sensibles (validation, export, suppression)
- Aucune clé ou secret côté client ; variables sensibles uniquement côté Netlify/Supabase

## 11. UX / UI

- **Mobile-first** : le parcours « photographier → vérifier → valider » doit tenir sur un écran de téléphone
- Dashboard clair avec KPIs : factures à vérifier, dépenses du mois, TVA cumulée, non conformes
- Navigation simple (saisie rapide accessible en 1 tap)
- Champs incertains surlignés ; jamais de validation silencieuse de montants
- Tolérance réseau : indicateurs de chargement, gestion explicite des échecs + retry

## 12. Structure du projet

```
FactureFlow-CI/
  index.html
  manifest.json
  service-worker.js
  css/styles.css
  js/
    app.js              -- bootstrap + routing
    auth.js             -- Supabase Auth
    store.js            -- accès données Supabase
    ai.js               -- appel proxy IA + parsing extraction
    config.js           -- URLs (proxy, Supabase) ; AUCUN secret
    ui.js
    modules/
      capture.js        -- caméra/upload + compression
      verification.js   -- écran de correction
      factures.js
      fournisseurs.js
      dashboard.js
      export.js
      settings.js
  netlify/functions/
    ai-proxy.js         -- proxy IA (vision + tool_use + vérif JWT)
  supabase/
    schema.sql          -- tables + RLS
  netlify.toml
```

## 13. Phases de livraison

**Phase 1 — MVP** (priorité absolue)
Auth → capture/upload → extraction IA → écran vérification → stockage → export Excel.
Objectif de succès : **fiable sur 50 vraies factures fournisseurs ivoiriennes**.

**Phase 2** — Multi-utilisateurs, dédup fournisseurs, recherche/filtres, tableau de bord dépenses.

**Phase 3** — Abonnement Mobile Money (Orange/MTN/Moov), offline complet (PWA), rapprochement bon de commande, lien facture normalisée DGI.

## 14. Contraintes & règles de développement

- Respecter la stack §3 (pas de framework non prévu)
- Code commenté, modulaire, sans duplication de logique
- Optimiser le coût IA (compression image, `max_tokens` raisonnable, modèle Sonnet par défaut)
- Toute fonctionnalité = conçue → testée → auto-corrigée avant d'être « terminée »
- Ne jamais affirmer une règle fiscale sans réserve « à valider par un professionnel »
- Conserver l'original de chaque facture (obligation d'audit)

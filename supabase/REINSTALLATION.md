# Reconstruction de la base Supabase — FactureFlow CI

Le projet Supabase d'origine (`cilceojlmqecqxkfexzk`) **a été supprimé** : son
enregistrement DNS n'existe plus, alors qu'un projet simplement en pause le
conserve. Constaté le 03/09/2026. L'application en production était donc
totalement hors service, et **les données sont perdues** (entreprises,
factures, fournisseurs, comptes, bucket `factures`) — aucune sauvegarde
n'existait dans le dépôt.

Cible retenue : organisation **MEDLOG (PRO)**, région **eu-central-1**.
Le plan gratuit est à proscrire : c'est lui qui a conduit à la suppression.

---

## 1. Créer le projet

Dashboard Supabase → organisation **MEDLOG** → **New project**.

- Nom suggéré : `factureflow-ci`
- Région : **eu-central-1** (Frankfurt)
- Notez le mot de passe Postgres généré, il ne sera plus affiché.

## 2. Créer le schéma

SQL Editor → **New query** → coller l'intégralité de `supabase/schema.sql` →
Run.

**Ne jouez AUCUNE autre migration.** `schema.sql` est consolidé : il contient
déjà l'ensemble des fonctionnalités (workflow contrôle de gestion, invitations,
super admin, commandes, récurrences, lettrages, clôtures, paiements, ERP,
logo…). Les fichiers `migration_*.sql` ne servent qu'à faire évoluer une base
*existante* et échoueraient ou seraient sans effet ici.

Cela évite au passage le piège des `alter type ... add value` de
`migration_workflow.sql`, qui doivent sinon être lancés seuls : `schema.sql`
crée directement les énumérés avec toutes leurs valeurs.

> Si l'éditeur affiche « Unable to find snippet with ID », l'onglet est périmé :
> ouvrez un « New query » vierge. Ce n'est pas une erreur SQL.

## 3. Créer le bucket de stockage

Storage → **New bucket** → nom exactement **`factures`** (valeur de
`CONFIG.BUCKET` dans `js/config.js`), **privé** (non public).

## 4. Récupérer les clés et mettre à jour l'application

Project Settings → API :

- **Project URL** → `SUPABASE_URL` dans `js/config.js`
- **anon public** → `SUPABASE_ANON_KEY` dans `js/config.js`
- **service_role** → variable Netlify `SUPABASE_SERVICE_ROLE_KEY`
  (sans elle, la relance quotidienne des retards `notify-overdue` reste muette)

Puis commit + `git push origin main` pour redéployer.

## 5. Autoriser les redirections d'authentification

Authentication → URL Configuration :

- **Site URL** : `https://factureflow-ci.netlify.app`
- **Redirect URLs** : ajouter `https://factureflow-ci.netlify.app/**`
  et `http://localhost:8888/**` pour le développement local.

## 6. Recréer le compte super administrateur

> **N'utilisez pas le formulaire d'inscription de l'application pour ce
> premier compte.** Il exige un code d'invitation (`js/app.js` ne passe que
> `mode: "join"` et refuse un code vide), or une base neuve ne contient aucune
> entreprise, donc aucun code. Les codes viennent de la console super admin,
> qui exige un compte super admin : la boucle est fermée. S'ajoute le fait que
> `mailer_autoconfirm` vaut `false` et qu'un projet neuf n'a pas de SMTP, donc
> l'e-mail de confirmation n'arrive généralement pas.

1. Authentication → Users → **Add user** → *Create new user* :
   `jocelinsoumahoro@outlook.fr`, un mot de passe, et **cochez « Auto Confirm
   User »**. Cela contourne d'un coup le code d'invitation et l'e-mail de
   confirmation.
   *(Si un compte issu d'une tentative ratée existe déjà : supprimez-le, ou
   ouvrez-le et faites « Confirm email ».)*
2. SQL Editor → jouer l'**ÉTAPE 4** de `supabase/superadmin_acces.sql` pour
   inscrire le compte dans `super_admins`, puis l'**ÉTAPE 6** pour vérifier
   que la colonne `super_admin` vaut bien `true`.
3. Connectez-vous : la console est accessible via Réglages, ou directement sur
   `#/superadmin` même sans entreprise (correctif e91bf33).

Les comptes suivants, eux, s'inscrivent normalement depuis l'application avec
le code d'invitation produit à l'étape 7.

## 7. Recréer les entreprises

Depuis la console super admin : créez chaque entreprise et transmettez son
**code d'invitation**. La première personne qui l'utilise devient l'admin de
l'entreprise ; les suivantes sont en rôle « saisie ».

---

## Éviter que cela se reproduise

- Le projet est désormais sur un plan **PRO** : pas de mise en pause pour
  inactivité.
- Mettre en place une **sauvegarde régulière** (Database → Backups, ou un
  `pg_dump` planifié). Aucune sauvegarde n'existait, d'où la perte totale.

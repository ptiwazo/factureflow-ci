/* =====================================================================
   FactureFlow CI — Plan comptable de charges IFRS / OHADA (référentiel)
   ---------------------------------------------------------------------
   Source : « Manuel Comptes Charges IFRS OHADA.xlsx » (référentiel officiel
   comptable interne). Contexte : Logistique / Transport / Transit /
   Consignation / Usinage — Référentiel IFRS + OHADA — Environnement SAP FI.

   ⚠️ Données de RÉFÉRENCE uniquement (numéros de comptes officiels, libellés,
   nature, exclusions, équivalents OHADA, traitement Opex/Capex). Elles servent
   à proposer/sélectionner un numéro de compte dans les Réglages.
   Les imputations restent à valider par votre expert-comptable.

   Ce fichier est généré depuis l'Excel — ne pas éditer à la main.
===================================================================== */

// Sections du plan, déduites du préfixe à 2 chiffres du numéro de compte.
export const SECTIONS_PLAN = [
  { prefixe: "51", label: "Charges opérationnelles directes (Parc, Logistique, Transport)" },
  { prefixe: "52", label: "Frais douaniers et transit" },
  { prefixe: "58", label: "Frais généraux et administratifs (G&A)" },
  { prefixe: "59", label: "Charges de personnel et fiscales" },
  { prefixe: "60", label: "Gains et pertes de change (opérationnel)" },
  { prefixe: "61", label: "Dotations aux amortissements" },
  { prefixe: "65", label: "Charges financières et change financier" },
  { prefixe: "70", label: "Impôt sur les bénéfices (IS)" },
  { prefixe: "90", label: "Comptes techniques et de clearing" },
];

export const LIBELLE_SECTION = Object.fromEntries(SECTIONS_PLAN.map((s) => [s.prefixe, s.label]));

// Plan comptable complet (103 comptes de charges).
export const PLAN_COMPTABLE_IFRS =
[
    {
        "compte":  "51000070",
        "labelEn":  "Out Security",
        "labelFr":  "Gardiennage / Sécurité externe",
        "section":  "51",
        "nature":  "Charges de sécurité physique externalisée : gardiens, surveillance des sites opérationnels (dépôts, entrepôts, ports)",
        "exemples":  "Factures prestataires gardiennage (ex: G4S, Securitas), rondes de sécurité, surveillance nocturne entrepôts",
        "exclusions":  "Exclure : systèmes d\u0027alarme et caméras (immobilisation), sécurité informatique (58530xxx)",
        "ohada":  "OHADA 624 – Charges externes / Sous-traitance",
        "traitement":  "Opex – Service externe récurrent",
        "centreCout":  "Parc / Logistique / Terminal"
    },
    {
        "compte":  "51000130",
        "labelEn":  "Maint preventive",
        "labelFr":  "Maintenance préventive",
        "section":  "51",
        "nature":  "Entretien planifié et préventif des équipements opérationnels : révisions périodiques, contrats de maintenance préventive",
        "exemples":  "Contrats de maintenance engins de manutention, révisions planifiées groupes électrogènes, entretien préventif grues",
        "exclusions":  "Exclure : réparations curatives (51030000), pièces de rechange stockées (immobilisation)",
        "ohada":  "OHADA 624 – Entretien et réparations",
        "traitement":  "Opex – Maintenance planifiée",
        "centreCout":  "Parc / Maintenance / Logistique"
    },
    {
        "compte":  "51010000",
        "labelEn":  "Subcontractors op",
        "labelFr":  "Sous-traitants opérationnels",
        "section":  "51",
        "nature":  "Charges de sous-traitance directement liées aux opérations : manutention, transport, handling portuaire confiés à des tiers",
        "exemples":  "Facturation manutentionnaire externe, sous-traitance débardage, prestataires de transit opérationnel",
        "exclusions":  "Exclure : sous-traitance administrative (58507000), consultants (58507000), main-d\u0027œuvre temporaire (59070000)",
        "ohada":  "OHADA 621 – Sous-traitance générale",
        "traitement":  "Opex – Coût opérationnel direct",
        "centreCout":  "Opérations / Transport / Terminal"
    },
    {
        "compte":  "51020000",
        "labelEn":  "Fuel Expenses",
        "labelFr":  "Carburant / Combustible",
        "section":  "51",
        "nature":  "Consommation de carburant pour les engins, véhicules et équipements opérationnels (chariots, grues, camions de parc)",
        "exemples":  "Achats gasoil pour chariots élévateurs, essence groupes électrogènes, carburant camions parc interne",
        "exclusions":  "Exclure : carburant véhicules administratifs (58552001), carburant facturable au client (remboursement)",
        "ohada":  "OHADA 604 – Achats de matières consommables",
        "traitement":  "Opex – Consommable direct",
        "centreCout":  "Parc / Transport / Opérations"
    },
    {
        "compte":  "51021000",
        "labelEn":  "Electricity exp",
        "labelFr":  "Électricité",
        "section":  "51",
        "nature":  "Consommation d\u0027électricité des sites opérationnels : entrepôts, terminaux, zones de stockage, ateliers",
        "exemples":  "Factures SODECI/CIE entrepôts, électricité zone de manutention, alimentation électrique grues portiques",
        "exclusions":  "Exclure : électricité bureaux administratifs (à ventiler en 58xxx si séparé), installation électrique neuve (immobilisation)",
        "ohada":  "OHADA 605 – Autres achats (énergie)",
        "traitement":  "Opex – Fluide / Énergie",
        "centreCout":  "Logistique / Terminal / Entrepôt"
    },
    {
        "compte":  "51022000",
        "labelEn":  "Water Expenses",
        "labelFr":  "Eau",
        "section":  "51",
        "nature":  "Consommation d\u0027eau des sites opérationnels : lavage d\u0027engins, nettoyage plateformes, sanitaires sites de production",
        "exemples":  "Factures eau SODECI sites opérationnels, eau lavage véhicules parc, eau nettoyage entrepôts",
        "exclusions":  "Exclure : eau bureaux (58xxx), installation réseau eau (immobilisation)",
        "ohada":  "OHADA 605 – Autres achats (eau)",
        "traitement":  "Opex – Fluide / Consommable",
        "centreCout":  "Parc / Logistique / Terminal"
    },
    {
        "compte":  "51030000",
        "labelEn":  "Mnt, Sp Prts, Rep op",
        "labelFr":  "Maintenance, Pièces détachées, Réparations (opérationnel)",
        "section":  "51",
        "nature":  "Charges de réparations curatives et remplacement de pièces détachées consommées sur équipements opérationnels",
        "exemples":  "Remplacement pneumatiques chariots, réparation moteur grue, pièces d\u0027usure engins de manutention, soudures structures métalliques",
        "exclusions":  "Exclure : maintenance préventive (51000130), pièces améliorant la durée de vie (capex), lubrifiants en gros stock (stock)",
        "ohada":  "OHADA 624 – Entretien et réparations",
        "traitement":  "Opex – Réparation et maintenance",
        "centreCout":  "Parc / Maintenance / Logistique"
    },
    {
        "compte":  "51040000",
        "labelEn":  "Mat/Cons op",
        "labelFr":  "Matériaux et consommables opérationnels",
        "section":  "51",
        "nature":  "Consommation de petits matériaux, fournitures et consommables directement liés à l\u0027activité opérationnelle",
        "exemples":  "Chiffons, sangles d\u0027arrimage, palettes consommées, petit outillage, EPI (casques, gants, chaussures sécu), sacs, étiquettes",
        "exclusions":  "Exclure : pièces détachées engins (51030000), fournitures bureau (58508000), immobilisations (matériels \u003e seuil capex)",
        "ohada":  "OHADA 604 – Achats de matières consommables",
        "traitement":  "Opex – Consommable direct",
        "centreCout":  "Opérations / Logistique / Parc"
    },
    {
        "compte":  "51060000",
        "labelEn":  "Rental Land Op.",
        "labelFr":  "Location de terrains / Foncier (opérationnel)",
        "section":  "51",
        "nature":  "Loyers versés pour l\u0027occupation de terrains à usage opérationnel : zones portuaires, terrains de stockage, aires de stationnement",
        "exemples":  "Loyer concession portuaire, location aire de stockage conteneurs, redevance terrain dépôt hydrocarbures",
        "exclusions":  "Exclure : loyers bureaux (58504100), droits d\u0027entrée capitalisables (capex IFRS 16), terrains achetés (immobilisation)",
        "ohada":  "OHADA 613 – Locations",
        "traitement":  "Opex – Location / IFRS 16 à analyser",
        "centreCout":  "Logistique / Terminal / Parc"
    },
    {
        "compte":  "51060100",
        "labelEn":  "Rental Equ \u0026 Mach",
        "labelFr":  "Location d\u0027équipements et machines",
        "section":  "51",
        "nature":  "Loyers d\u0027équipements et machines opérationnelles : grues, chariots, engins non possédés en propre",
        "exemples":  "Location grue mobile pour chantier ponctuel, location chariot élévateur appoint, location groupe électrogène temporaire",
        "exclusions":  "Exclure : leasing financier (droit d\u0027usage IFRS 16 au bilan), location véhicules administratifs (58552001), location immobilière (51060000)",
        "ohada":  "OHADA 613 – Locations de matériel",
        "traitement":  "Opex – Location courte durée / IFRS 16 si \u003e 12 mois",
        "centreCout":  "Parc / Opérations / Logistique"
    },
    {
        "compte":  "51070000",
        "labelEn":  "Documentation op",
        "labelFr":  "Documentation opérationnelle",
        "section":  "51",
        "nature":  "Frais de documentation liés directement aux opérations : connaissements, documents douaniers, liasses de transport",
        "exemples":  "Frais obtention BL (Bill of Lading), copie manifeste cargo, frais documentation CNUCED, liasses transport multi-modal",
        "exclusions":  "Exclure : documentation administrative générale (58508000), abonnements revues professionnelles (58558000), licences logiciels (58530xxx)",
        "ohada":  "OHADA 626 – Frais postaux et télécommunications",
        "traitement":  "Opex – Frais opérationnels directs",
        "centreCout":  "Opérations / Transit / Douane"
    },
    {
        "compte":  "52030000",
        "labelEn":  "Customs H Brok Exp",
        "labelFr":  "Frais de commissionnaire en douane / Courtage douanier",
        "section":  "52",
        "nature":  "Honoraires et frais versés aux commissionnaires agréés en douane pour les formalités de dédouanement",
        "exemples":  "Honoraires transitaire pour dédouanement importation, frais bureau douane, débours commissionnaire douane",
        "exclusions":  "Exclure : droits et taxes douanières eux-mêmes (à capitaliser ou refacturer client), frais de transit interne (51010000)",
        "ohada":  "OHADA 628 – Divers (Commissionnaires)",
        "traitement":  "Opex – Frais de service / peut être refacturé client",
        "centreCout":  "Douane / Transit / Logistique"
    },
    {
        "compte":  "58504002",
        "labelEn":  "Office clean Exp",
        "labelFr":  "Nettoyage des bureaux",
        "section":  "58",
        "nature":  "Charges de nettoyage et entretien des locaux administratifs : ménage, désinfection, maintenance propreté",
        "exemples":  "Factures société de nettoyage bureaux, produits d\u0027entretien locaux admin, désinsectisation, nettoyage vitres",
        "exclusions":  "Exclure : nettoyage sites opérationnels (51040000), travaux de peinture/rénovation (capex si \u003e seuil)",
        "ohada":  "OHADA 624 – Entretien et réparations",
        "traitement":  "Opex – Service général",
        "centreCout":  "Administration / G\u0026A"
    },
    {
        "compte":  "58504100",
        "labelEn":  "Office rental exp",
        "labelFr":  "Loyer de bureaux",
        "section":  "58",
        "nature":  "Loyers des locaux à usage exclusivement administratif : sièges sociaux, agences commerciales, bureaux",
        "exemples":  "Loyer mensuel siège social, loyer bureau commercial, loyer immeuble administratif, charges locatives refacturées",
        "exclusions":  "Exclure : dépôt de garantie (bilan), droits d\u0027entrée capitalisables, loyers opérationnels (51060000), droit d\u0027usage IFRS 16 (bilan)",
        "ohada":  "OHADA 613 – Locations immobilières",
        "traitement":  "Opex / IFRS 16 : actif droit d\u0027usage si \u003e 12 mois",
        "centreCout":  "Administration / G\u0026A"
    },
    {
        "compte":  "58506000",
        "labelEn":  "Legal Exp",
        "labelFr":  "Frais juridiques",
        "section":  "58",
        "nature":  "Honoraires d\u0027avocats, frais de justice, conseils juridiques pour litiges, contentieux, contrats",
        "exemples":  "Honoraires avocat contentieux client, frais huissier, conseil juridique contrat prestation, frais arbitrage",
        "exclusions":  "Exclure : frais d\u0027audit (58506003), frais notariés liés à acquisition d\u0027actif (capex), amendes (59503001)",
        "ohada":  "OHADA 627 – Services bancaires et assimilés / 628",
        "traitement":  "Opex – Service professionnel",
        "centreCout":  "Juridique / Direction Générale / G\u0026A"
    },
    {
        "compte":  "58506003",
        "labelEn":  "Audit Exp",
        "labelFr":  "Frais d\u0027audit",
        "section":  "58",
        "nature":  "Honoraires des commissaires aux comptes, auditeurs externes, frais d\u0027audit légal et contractuel",
        "exemples":  "Honoraires CAC audit annuel, frais audit Big4 mandaté par groupe, audit des stocks, audit fiscal",
        "exclusions":  "Exclure : conseil comptable courant (58506005), frais de conseil stratégique (58507000), audits IT (58507000)",
        "ohada":  "OHADA 627 – Services extérieurs",
        "traitement":  "Opex – Service professionnel obligatoire",
        "centreCout":  "Finance / Direction Générale / G\u0026A"
    },
    {
        "compte":  "58506005",
        "labelEn":  "Acctg Svce",
        "labelFr":  "Services comptables",
        "section":  "58",
        "nature":  "Honoraires de prestataires comptables externes : tenue de livres, établissement des états financiers, conseil IFRS/fiscal",
        "exemples":  "Honoraires cabinet comptable sous-traitant la paie, conseil établissement liasses fiscales, assistance clôture IFRS",
        "exclusions":  "Exclure : salaires comptables internes (59000000), logiciels comptables (58530204), audit légal (58506003)",
        "ohada":  "OHADA 628 – Divers",
        "traitement":  "Opex – Service professionnel",
        "centreCout":  "Finance / Comptabilité / G\u0026A"
    },
    {
        "compte":  "58507000",
        "labelEn":  "Var Pro Svce",
        "labelFr":  "Services professionnels divers",
        "section":  "58",
        "nature":  "Honoraires de consultants, experts, prestataires de services professionnels non classés ailleurs",
        "exemples":  "Conseil en organisation, étude de marché, consulting RH, expertise technique ponctuelle, coaching management",
        "exclusions":  "Exclure : frais juridiques (58506000), audit (58506003), comptabilité (58506005), marketing (58568000)",
        "ohada":  "OHADA 628 – Divers (Honoraires)",
        "traitement":  "Opex – Service professionnel",
        "centreCout":  "Direction / RH / Stratégie / G\u0026A"
    },
    {
        "compte":  "58508000",
        "labelEn":  "Office Supplies",
        "labelFr":  "Fournitures de bureau",
        "section":  "58",
        "nature":  "Consommables et petites fournitures à usage administratif : papeterie, cartouches, petit matériel de bureau",
        "exemples":  "Rames de papier, stylos, classeurs, cartouches imprimantes, tampons, enveloppes, agrafes, post-it",
        "exclusions":  "Exclure : fournitures opérationnelles (51040000), matériels bureautiques \u003e seuil (ordinateurs = capex), logiciels (58530xxx)",
        "ohada":  "OHADA 606 – Achats de fournitures de bureau",
        "traitement":  "Opex – Consommable administratif",
        "centreCout":  "Administration / G\u0026A / Toutes directions"
    },
    {
        "compte":  "58520200",
        "labelEn":  "Tel \u0026 Oth Com Exp",
        "labelFr":  "Téléphone et autres frais de communication",
        "section":  "58",
        "nature":  "Charges de téléphonie fixe, mobile et autres frais de communication : abonnements, communications, roaming",
        "exemples":  "Factures téléphonie mobile employés, ligne fixe bureau, forfait téléphone siège, frais roaming déplacements",
        "exclusions":  "Exclure : Internet haut débit (58525000), visioconférence (58525000), équipements téléphoniques (capex si \u003e seuil)",
        "ohada":  "OHADA 626 – Frais postaux et de télécommunications",
        "traitement":  "Opex – Frais de communication",
        "centreCout":  "Administration / Toutes directions / G\u0026A"
    },
    {
        "compte":  "58525000",
        "labelEn":  "Internet expenses",
        "labelFr":  "Frais Internet",
        "section":  "58",
        "nature":  "Abonnements et charges liées à la connectivité Internet : fibre, ADSL, VPN, liaisons spécialisées",
        "exemples":  "Abonnement fibre optique bureau, liaison dédiée data center, abonnement VPN entreprise, internet satellite site distant",
        "exclusions":  "Exclure : logiciels cloud/SaaS (58530202 Azure, 58530203), téléphonie IP intégrée (58520200), installation infrastructure réseau (capex)",
        "ohada":  "OHADA 626 – Frais de télécommunications",
        "traitement":  "Opex – Infrastructure réseau",
        "centreCout":  "IT / Administration / G\u0026A"
    },
    {
        "compte":  "58527020",
        "labelEn":  "Var Postal Exp",
        "labelFr":  "Frais postaux divers",
        "section":  "58",
        "nature":  "Affranchissement, envois postaux, courrier express, services de messagerie pour documents administratifs",
        "exemples":  "Affranchissement courrier, envoi DHL documents contractuels, chronopost dossiers clients, frais Colissimo",
        "exclusions":  "Exclure : transport de marchandises (51010000), documentation opérationnelle (51070000), abonnements numériques (58525000)",
        "ohada":  "OHADA 626 – Frais postaux",
        "traitement":  "Opex – Frais administratifs",
        "centreCout":  "Administration / G\u0026A / Toutes directions"
    },
    {
        "compte":  "58530200",
        "labelEn":  "Sware Exp oth",
        "labelFr":  "Logiciels - Autres",
        "section":  "58",
        "nature":  "Licences logicielles et abonnements SaaS non classés dans les sous-comptes spécifiques (hors Azure, Microsoft, SAP)",
        "exemples":  "Licences Adobe, abonnements Salesforce, logiciel de gestion documentaire, antivirus, outils BI non-Microsoft",
        "exclusions":  "Exclure : logiciels capitalisables (développements \u003e seuil IAS 38), Azure (58530202), Microsoft (58530203), SAP (58530204)",
        "ohada":  "OHADA 628 – Divers (Locations immatérielles)",
        "traitement":  "Opex – SaaS / abonnement logiciel (IAS 38 si capex)",
        "centreCout":  "IT / Toutes directions"
    },
    {
        "compte":  "58530202",
        "labelEn":  "Sware Exp Azure",
        "labelFr":  "Logiciels - Microsoft Azure (Cloud)",
        "section":  "58",
        "nature":  "Charges de services cloud Microsoft Azure : IaaS, PaaS, stockage, machines virtuelles, bases de données Azure",
        "exemples":  "Facturation Azure VM, Azure SQL Database, Azure Storage, Azure DevOps, Azure Active Directory",
        "exclusions":  "Exclure : licences Microsoft Office (58530203), développements applicatifs capitalisables sur Azure (capex IAS 38)",
        "ohada":  "OHADA 628 – Locations immatérielles / Services informatiques",
        "traitement":  "Opex – Cloud computing",
        "centreCout":  "IT / Infrastructure / G\u0026A"
    },
    {
        "compte":  "58530203",
        "labelEn":  "Sware Exp Msoft",
        "labelFr":  "Logiciels - Microsoft (hors Azure)",
        "section":  "58",
        "nature":  "Licences et abonnements Microsoft hors Azure : M365, Office, Teams, Exchange, SharePoint, Windows",
        "exemples":  "Abonnements Microsoft 365 Business, licences Office entreprise, Teams Phone, Exchange Online, SharePoint",
        "exclusions":  "Exclure : Azure (58530202), SAP (58530204), matériel informatique (capex), formations Microsoft (58507000)",
        "ohada":  "OHADA 628 – Locations immatérielles",
        "traitement":  "Opex – Licence logicielle",
        "centreCout":  "IT / Administration / Toutes directions"
    },
    {
        "compte":  "58530204",
        "labelEn":  "Sware Exp SAP",
        "labelFr":  "Logiciels - SAP",
        "section":  "58",
        "nature":  "Licences, abonnements et maintenance SAP : modules FI, CO, MM, SD, WM, licences utilisateurs, maintenance annuelle",
        "exemples":  "Maintenance annuelle SAP ECC, licences SAP S/4HANA, abonnement SAP Cloud, support SAP Enterprise",
        "exclusions":  "Exclure : implémentation/customisation SAP (capex IAS 38 si \u003e seuil), formations SAP (58507000), consultants SAP projet (capex)",
        "ohada":  "OHADA 628 – Locations immatérielles / Services informatiques",
        "traitement":  "Opex – Licence ERP (maintenance) / Capex si implémentation",
        "centreCout":  "IT / Finance / G\u0026A"
    },
    {
        "compte":  "58530300",
        "labelEn":  "Hware \u0026 Sware Consu",
        "labelFr":  "Matériel et logiciel – Consommables IT",
        "section":  "58",
        "nature":  "Petits achats de matériel informatique et accessoires en dessous du seuil de capitalisation",
        "exemples":  "Clés USB, souris, claviers, câbles réseau, petits hubs, casques, webcams, supports d\u0027écran \u003c seuil capex",
        "exclusions":  "Exclure : ordinateurs portables/fixes \u003e seuil (capex), serveurs (capex), matériel réseau structurant (capex)",
        "ohada":  "OHADA 606 – Fournitures de bureau / 604",
        "traitement":  "Opex – Consommable IT",
        "centreCout":  "IT / Administration / G\u0026A"
    },
    {
        "compte":  "58540000",
        "labelEn":  "Travel Exp",
        "labelFr":  "Frais de voyage et déplacement",
        "section":  "58",
        "nature":  "Billets d\u0027avion, train, visa, frais de transport liés aux déplacements professionnels hors hébergement",
        "exemples":  "Billets d\u0027avion mission Abidjan-Paris, frais de visa déplacement, taxi aéroport, location voiture mission",
        "exclusions":  "Exclure : hébergement (58540300), repas (à ventiler selon politique), frais de représentation (58566000), déplacements locaux (58554000)",
        "ohada":  "OHADA 625 – Déplacements, missions et réceptions",
        "traitement":  "Opex – Frais de mission",
        "centreCout":  "Toutes directions / Commercial / Direction"
    },
    {
        "compte":  "58540300",
        "labelEn":  "Accomodation expense",
        "labelFr":  "Frais d\u0027hébergement",
        "section":  "58",
        "nature":  "Charges d\u0027hôtel et d\u0027hébergement lors des déplacements professionnels",
        "exemples":  "Nuits d\u0027hôtel en déplacement mission, Airbnb mission longue durée, logement temporaire expatrié (si court terme)",
        "exclusions":  "Exclure : logement expatrié permanent (avantage en nature RH / 59xxx), appartement de fonction capitalisable, voyage d\u0027agrément",
        "ohada":  "OHADA 625 – Déplacements, missions et réceptions",
        "traitement":  "Opex – Frais de mission",
        "centreCout":  "Toutes directions / RH / Direction"
    },
    {
        "compte":  "58552001",
        "labelEn":  "Veh Exp",
        "labelFr":  "Frais de véhicules administratifs",
        "section":  "58",
        "nature":  "Charges d\u0027entretien, carburant, lavage, assurance (hors compte dédié) des véhicules à usage administratif",
        "exemples":  "Vidange véhicule de direction, carburant voiture de service, réparation voiture administrative, contrôle technique",
        "exclusions":  "Exclure : carburant véhicules opérationnels (51020000), location longue durée (IFRS 16), véhicules parc opérationnel (51030000)",
        "ohada":  "OHADA 624 – Entretien et réparations",
        "traitement":  "Opex – Frais véhicule",
        "centreCout":  "Administration / Direction / G\u0026A"
    },
    {
        "compte":  "58552004",
        "labelEn":  "Veh Ins Exp",
        "labelFr":  "Assurance véhicules",
        "section":  "58",
        "nature":  "Primes d\u0027assurance pour les véhicules administratifs et de service",
        "exemples":  "Prime assurance tous risques véhicule direction, assurance flotte véhicules administratifs, vignette et assurance obligatoire",
        "exclusions":  "Exclure : assurance engins opérationnels (59570000), assurance RC professionnelle (58570001), assurance véhicules parc opérationnel",
        "ohada":  "OHADA 625 – Assurances véhicules",
        "traitement":  "Opex – Assurance",
        "centreCout":  "Administration / G\u0026A / Finance"
    },
    {
        "compte":  "58553000",
        "labelEn":  "Stamp tax",
        "labelFr":  "Taxe de timbre",
        "section":  "58",
        "nature":  "Droits de timbre sur documents officiels, contrats, actes administratifs, chèques",
        "exemples":  "Timbres fiscaux sur contrats, droits d\u0027enregistrement documents, timbres chèques, droits de timbre actes notariés",
        "exclusions":  "Exclure : droits d\u0027enregistrement liés à acquisition d\u0027actif (capex), TVA et autres impôts (comptes dédiés), amendes (59503001)",
        "ohada":  "OHADA 635 – Autres impôts, taxes et versements assimilés",
        "traitement":  "Opex – Taxe administrative",
        "centreCout":  "Finance / Direction / G\u0026A"
    },
    {
        "compte":  "58553050",
        "labelEn":  "Oth indirect tax",
        "labelFr":  "Autres taxes indirectes",
        "section":  "58",
        "nature":  "Taxes indirectes non classées ailleurs : redevances diverses, prélèvements sectoriels, contributions obligatoires",
        "exemples":  "Contribution FDFP (formation), taxe d\u0027apprentissage, redevance audiovisuelle, contribution au Fonds routier",
        "exclusions":  "Exclure : IS/IBS (70000000), taxe professionnelle (59500010), droits de douane (à capitaliser ou refacturer), TVA récupérable",
        "ohada":  "OHADA 635 – Autres impôts et taxes",
        "traitement":  "Opex – Charges fiscales",
        "centreCout":  "Finance / RH / G\u0026A"
    },
    {
        "compte":  "58554000",
        "labelEn":  "Local Trspt Exp",
        "labelFr":  "Transport local",
        "section":  "58",
        "nature":  "Frais de transport local ne relevant pas du parc propre : taxis, VTC, transports en commun, navettes",
        "exemples":  "Courses taxi collaborateurs, VTC déplacements internes ville, navette aéroport, frais transport courrier urgent local",
        "exclusions":  "Exclure : transport opérationnel marchandises (51010000), location véhicule longue durée (IFRS 16), transport missions (58540000)",
        "ohada":  "OHADA 624 – Transports",
        "traitement":  "Opex – Frais de déplacement local",
        "centreCout":  "Administration / Opérations / Toutes directions"
    },
    {
        "compte":  "58558000",
        "labelEn":  "Subs \u0026 Mbshp Exp",
        "labelFr":  "Abonnements et cotisations",
        "section":  "58",
        "nature":  "Cotisations à des associations professionnelles, syndicats patronaux, chambres de commerce, abonnements revues",
        "exemples":  "Cotisation CGECI, adhésion chambre de commerce franco-ivoirienne, abonnement revue Transport \u0026 Logistique, cotisation OACI",
        "exclusions":  "Exclure : abonnements logiciels (58530xxx), abonnements internet (58525000), dons et mécénat (compte spécifique)",
        "ohada":  "OHADA 628 – Divers",
        "traitement":  "Opex – Charges associatives / représentation",
        "centreCout":  "Direction / G\u0026A / Juridique"
    },
    {
        "compte":  "58562000",
        "labelEn":  "Int. Meetings Exp.",
        "labelFr":  "Frais de réunions internes",
        "section":  "58",
        "nature":  "Charges liées à l\u0027organisation de réunions internes : salle, restauration, matériel de présentation, pause-café",
        "exemples":  "Location salle réunion externe, repas réunion comité de direction, café/collation réunion interne, vidéoprojecteur location",
        "exclusions":  "Exclure : frais de réceptions clients (58566000), séminaires avec clients (58566010), formations (58507000)",
        "ohada":  "OHADA 625 – Réceptions et séminaires internes",
        "traitement":  "Opex – Frais de fonctionnement interne",
        "centreCout":  "Direction / RH / Toutes directions"
    },
    {
        "compte":  "58566000",
        "labelEn":  "Entertainment Expens",
        "labelFr":  "Frais de représentation / Réception",
        "section":  "58",
        "nature":  "Charges d\u0027accueil et de représentation envers des tiers externes : clients, partenaires, autorités",
        "exemples":  "Dîner client prospect, cocktail partenaire commercial, réception inauguration, accueil délégation officielle",
        "exclusions":  "Exclure : réunions internes (58562000), cadeaux clients (58568003), événements internes (58566010), voyages d\u0027agrément",
        "ohada":  "OHADA 625 – Déplacements, missions et réceptions",
        "traitement":  "Opex – Représentation commerciale",
        "centreCout":  "Commercial / Direction / G\u0026A"
    },
    {
        "compte":  "58566010",
        "labelEn":  "Entert. int. events",
        "labelFr":  "Événements internes",
        "section":  "58",
        "nature":  "Charges liées à des événements festifs ou fédérateurs à destination du personnel : séminaires, team building, fêtes de fin d\u0027année",
        "exemples":  "Repas annuel personnel, journée team building, séminaire cohésion équipe, fête de Noël entreprise",
        "exclusions":  "Exclure : formations professionnelles (58507000), réceptions clients (58566000), déplacements mission (58540000)",
        "ohada":  "OHADA 625 – Réceptions internes",
        "traitement":  "Opex – Bien-être et culture d\u0027entreprise",
        "centreCout":  "RH / Direction / G\u0026A"
    },
    {
        "compte":  "58568000",
        "labelEn":  "Advg Exp",
        "labelFr":  "Frais de publicité / Marketing",
        "section":  "58",
        "nature":  "Charges de communication externe et publicité : campagnes media, supports publicitaires, sponsoring",
        "exemples":  "Achat espace publicitaire TV/radio, campagne presse, bannières web, affiches publicitaires, sponsoring événement",
        "exclusions":  "Exclure : cadeaux clients (58568003), frais de représentation (58566000), relations publiques (58507000)",
        "ohada":  "OHADA 627 – Publicité, publications, relations publiques",
        "traitement":  "Opex – Marketing",
        "centreCout":  "Commercial / Communication / G\u0026A"
    },
    {
        "compte":  "58568003",
        "labelEn":  "Advert./client gift",
        "labelFr":  "Publicité / Cadeaux clients",
        "section":  "58",
        "nature":  "Achats de cadeaux d\u0027affaires et goodies destinés aux clients et partenaires dans un cadre commercial",
        "exemples":  "Agendas logotés clients, bouteilles de vin pour clients VIP, stylos/USB personnalisés, paniers garnis Noël clients",
        "exclusions":  "Exclure : cadeaux au personnel (59035000), frais de représentation (58566000), don caritatif (compte spécifique)",
        "ohada":  "OHADA 627 – Publicité et cadeaux",
        "traitement":  "Opex – Marketing commercial",
        "centreCout":  "Commercial / Direction / G\u0026A"
    },
    {
        "compte":  "58570000",
        "labelEn":  "Pro Indemn Ins-ITIC",
        "labelFr":  "Assurance RC Professionnelle - ITIC",
        "section":  "58",
        "nature":  "Prime d\u0027assurance Responsabilité Civile Professionnelle type ITIC (transporteurs, transitaires, commissionnaires)",
        "exemples":  "Prime annuelle assurance RC transitaire, assurance ITIC commissionnaire de transport, couverture erreurs professionnelles",
        "exclusions":  "Exclure : assurance RC générale (58570001), assurance véhicules (58552004), cautionnement douanier (bilan)",
        "ohada":  "OHADA 625 – Assurances diverses",
        "traitement":  "Opex – Assurance professionnelle obligatoire",
        "centreCout":  "Direction / Finance / Opérations / Transit"
    },
    {
        "compte":  "58570001",
        "labelEn":  "Ins Civil Res",
        "labelFr":  "Assurance Responsabilité Civile Générale",
        "section":  "58",
        "nature":  "Prime d\u0027assurance RC générale de l\u0027entreprise : couverture dommages causés à des tiers dans le cadre de l\u0027activité",
        "exemples":  "Prime assurance RC exploitation, assurance RC employeur, couverture accidents tiers sur site",
        "exclusions":  "Exclure : assurance RC Pro ITIC (58570000), assurance véhicules (58552004), assurance incendie/bâtiment (capex ou frais)",
        "ohada":  "OHADA 625 – Assurances",
        "traitement":  "Opex – Assurance générale",
        "centreCout":  "Finance / Direction / G\u0026A"
    },
    {
        "compte":  "59000000",
        "labelEn":  "Sal Exp",
        "labelFr":  "Charges salariales – Salaires bruts",
        "section":  "59",
        "nature":  "Salaires bruts mensuels versés aux employés permanents : traitement de base, primes fixes contractuelles",
        "exemples":  "Salaire de base employés CDI, prime d\u0027ancienneté, prime de poste, salaire brut chargé hors patronal",
        "exclusions":  "Exclure : charges patronales (59014000), bonus (59002000), heures sup (59002200), travailleurs temporaires (59070000)",
        "ohada":  "OHADA 661 – Rémunérations du personnel",
        "traitement":  "Opex – Charge de personnel",
        "centreCout":  "RH / Toutes directions / Centre de profit"
    },
    {
        "compte":  "59000001",
        "labelEn":  "Director attend Fee",
        "labelFr":  "Jetons de présence administrateurs",
        "section":  "59",
        "nature":  "Rémunérations versées aux membres du Conseil d\u0027Administration ou Conseil de Surveillance pour leur participation",
        "exemples":  "Jetons de présence réunion CA, indemnités administrateurs non-exécutifs, rémunération membres comité audit",
        "exclusions":  "Exclure : salaires dirigeants exécutifs (59000000), remboursements de frais administrateurs (58540000)",
        "ohada":  "OHADA 663 – Rémunérations d\u0027administrateurs",
        "traitement":  "Opex – Gouvernance",
        "centreCout":  "Direction Générale / G\u0026A / Finance"
    },
    {
        "compte":  "59000050",
        "labelEn":  "Sal - Payroll Emplr",
        "labelFr":  "Charges patronales sur salaires",
        "section":  "59",
        "nature":  "Cotisations sociales patronales obligatoires : CNPS, retraite complémentaire, fonds de formation",
        "exemples":  "CNPS employeur, cotisation retraite complémentaire patronale, contribution FDFP patronale, cotisation mutuelle patronale",
        "exclusions":  "Exclure : cotisations salariales (retenues sur fiche de paie / passif), IS (70000000), charges 13ème/14ème (59000060)",
        "ohada":  "OHADA 664 – Charges sociales",
        "traitement":  "Opex – Charge patronale",
        "centreCout":  "RH / Finance / G\u0026A"
    },
    {
        "compte":  "59000060",
        "labelEn":  "Sal - Chge 13\u002614th",
        "labelFr":  "13ème et 14ème mois de salaire",
        "section":  "59",
        "nature":  "Charges correspondant aux gratifications contractuelles ou conventionnelles de 13ème et 14ème mois",
        "exemples":  "Provision 13ème mois personnel convention collective, gratification de fin d\u0027année, prime conventionnelle annuelle",
        "exclusions":  "Exclure : bonus performance (59002000), prime de départ (59006000), provision congés (59004000)",
        "ohada":  "OHADA 661 – Rémunérations / Gratifications",
        "traitement":  "Opex – Charge de personnel",
        "centreCout":  "RH / Toutes directions"
    },
    {
        "compte":  "59000080",
        "labelEn":  "Sal - Hday Cpsation",
        "labelFr":  "Indemnités compensatrices de jours fériés",
        "section":  "59",
        "nature":  "Charges liées à la compensation des jours fériés travaillés ou indemnités de jours fériés légaux",
        "exemples":  "Paiement majoration jour férié travaillé, indemnité fête nationale pour équipes en poste continu",
        "exclusions":  "Exclure : heures supplémentaires hors jours fériés (59002200), congés payés (59004000)",
        "ohada":  "OHADA 661 – Rémunérations",
        "traitement":  "Opex – Charge de personnel",
        "centreCout":  "RH / Opérations / Logistique"
    },
    {
        "compte":  "59002000",
        "labelEn":  "Bonus Exp",
        "labelFr":  "Primes de performance / Bonus",
        "section":  "59",
        "nature":  "Charges de primes variables et bonus liés aux performances individuelles ou collectives",
        "exemples":  "Prime annuelle de performance DG, bonus commercial lié au CA, prime d\u0027objectifs encadrement",
        "exclusions":  "Exclure : 13ème mois (59000060), salaire de base (59000000), intéressement (compte spécifique selon régime)",
        "ohada":  "OHADA 661 – Rémunérations variables",
        "traitement":  "Opex – Rémunération variable",
        "centreCout":  "RH / Direction / Commercial"
    },
    {
        "compte":  "59002200",
        "labelEn":  "Empl Otime Exp",
        "labelFr":  "Heures supplémentaires",
        "section":  "59",
        "nature":  "Majorations salariales pour les heures de travail effectuées au-delà de la durée légale ou contractuelle",
        "exemples":  "Paiement heures sup à 25% ou 50%, majoration nuit/week-end dock workers, décompte HS mensuels",
        "exclusions":  "Exclure : astreintes (à définir selon politique), primes de poste (59000000), jours fériés (59000080)",
        "ohada":  "OHADA 661 – Heures supplémentaires",
        "traitement":  "Opex – Charge de personnel",
        "centreCout":  "Opérations / Logistique / Parc"
    },
    {
        "compte":  "59004000",
        "labelEn":  "Prov Hday",
        "labelFr":  "Provision congés payés",
        "section":  "59",
        "nature":  "Dotation à la provision pour congés payés à acquitter : charge de l\u0027exercice au titre des droits acquis",
        "exemples":  "Provision mensuelle congés annuels personnel, ajustement provision congés en clôture annuelle IFRS",
        "exclusions":  "Exclure : prise effective de congés (solde de provision), charges sociales sur congés (59004001)",
        "ohada":  "OHADA 194 / Provision pour charges de personnel",
        "traitement":  "Opex – Provision IAS 19",
        "centreCout":  "RH / Finance / Comptabilité"
    },
    {
        "compte":  "59004001",
        "labelEn":  "Prov Soc Chge Hday",
        "labelFr":  "Provision charges sociales sur congés payés",
        "section":  "59",
        "nature":  "Dotation à la provision pour charges patronales afférentes aux droits à congés payés provisionnés",
        "exemples":  "Provision charges CNPS sur provision congés, cotisations patronales provisionnées sur droits congés acquis",
        "exclusions":  "Exclure : provision congés bruts (59004000), charges sociales courantes (59000050)",
        "ohada":  "OHADA 194 / Provision charges patronales sur congés",
        "traitement":  "Opex – Provision IAS 19",
        "centreCout":  "Finance / RH / Comptabilité"
    },
    {
        "compte":  "59006000",
        "labelEn":  "End Ben",
        "labelFr":  "Indemnités de fin de carrière / Départ",
        "section":  "59",
        "nature":  "Charges au titre des avantages de fin d\u0027emploi : indemnités de retraite, de licenciement, de départ volontaire",
        "exemples":  "Indemnité légale de licenciement, provision IAS 19 indemnités départ retraite, solde tout compte départ négocié",
        "exclusions":  "Exclure : salaires courants (59000000), provision congés (59004000), frais juridiques licenciement (58506000)",
        "ohada":  "OHADA 661 / IAS 19 – Avantages postérieurs à l\u0027emploi",
        "traitement":  "Opex / Actuariel IAS 19 si régime à prestations définies",
        "centreCout":  "RH / Finance / Direction"
    },
    {
        "compte":  "59014000",
        "labelEn":  "Soc Chge",
        "labelFr":  "Charges sociales générales",
        "section":  "59",
        "nature":  "Cotisations sociales d\u0027ensemble (employeur) non ventilées sur un sous-compte spécifique",
        "exemples":  "Cotisations CNPS globalisation, charges retraite complémentaire non détaillées, autres charges sociales légales",
        "exclusions":  "Exclure : charges patronales sur paie détaillées (59000050), mutuelle (59026000), accidents de travail (59026000)",
        "ohada":  "OHADA 664 – Charges sociales",
        "traitement":  "Opex – Charge patronale",
        "centreCout":  "RH / Finance / G\u0026A"
    },
    {
        "compte":  "59016002",
        "labelEn":  "Prov Soc Chge 13 Sal",
        "labelFr":  "Provision charges sociales 13ème salaire",
        "section":  "59",
        "nature":  "Dotation à la provision pour charges patronales afférentes à la gratification de 13ème mois provisionnée",
        "exemples":  "Provision charges CNPS sur 13ème mois, cotisations retraite provisionnées sur prime annuelle",
        "exclusions":  "Exclure : provision 13ème mois brut (59000060), charges sociales courantes mensuelles (59000050)",
        "ohada":  "OHADA 194 / Provision charges patronales",
        "traitement":  "Opex – Provision de charges sociales",
        "centreCout":  "Finance / RH / Comptabilité"
    },
    {
        "compte":  "59026000",
        "labelEn":  "Accidt \u0026 Health Ins",
        "labelFr":  "Assurance accidents et santé / Mutuelle",
        "section":  "59",
        "nature":  "Primes d\u0027assurance maladie complémentaire, mutuelle entreprise, couverture accident du travail",
        "exemples":  "Prime mutuelle santé part patronale, assurance accidents du travail, couverture maladie complémentaire groupe",
        "exclusions":  "Exclure : assurance RC Pro (58570000), cotisations CNPS (59000050), remboursements soins (59028000)",
        "ohada":  "OHADA 664 – Charges sociales / Assurance",
        "traitement":  "Opex – Avantages sociaux",
        "centreCout":  "RH / Finance / G\u0026A"
    },
    {
        "compte":  "59028000",
        "labelEn":  "Medical Exp",
        "labelFr":  "Frais médicaux",
        "section":  "59",
        "nature":  "Remboursements directs de frais médicaux aux employés ou prise en charge directe de soins non couverts par l\u0027assurance",
        "exemples":  "Remboursement consultation médicale non couverte, prise en charge chirurgie urgente, visite médicale d\u0027embauche",
        "exclusions":  "Exclure : prime d\u0027assurance maladie (59026000), médecine du travail (prestation externe en 58507000)",
        "ohada":  "OHADA 664 / Avantages en nature santé",
        "traitement":  "Opex – Avantage social",
        "centreCout":  "RH / Direction / G\u0026A"
    },
    {
        "compte":  "59034000",
        "labelEn":  "Trspt Allo",
        "labelFr":  "Indemnité de transport",
        "section":  "59",
        "nature":  "Allocations forfaitaires ou remboursements de transport domicile-travail versés aux employés",
        "exemples":  "Indemnité transport mensuelle forfaitaire, remboursement titre de transport collectif, navette entreprise",
        "exclusions":  "Exclure : transport missions (58540000), transport local professionnel (58554000), véhicule de fonction (avantage en nature)",
        "ohada":  "OHADA 661 – Indemnités diverses",
        "traitement":  "Opex – Avantage salarial",
        "centreCout":  "RH / Toutes directions"
    },
    {
        "compte":  "59035000",
        "labelEn":  "Other employee gift/",
        "labelFr":  "Cadeaux et dons aux employés",
        "section":  "59",
        "nature":  "Charges de cadeaux offerts au personnel : fêtes, naissances, mariages, médailles du travail",
        "exemples":  "Panier de Noël personnel, cadeau mariage collaborateur, bon d\u0027achat naissance, médaille du travail",
        "exclusions":  "Exclure : bonus et primes (59002000), événements internes (58566010), cadeaux clients (58568003)",
        "ohada":  "OHADA 661 – Avantages divers personnel",
        "traitement":  "Opex – Avantage social",
        "centreCout":  "RH / Direction / G\u0026A"
    },
    {
        "compte":  "59070000",
        "labelEn":  "Temp Labor Exp",
        "labelFr":  "Main-d\u0027œuvre temporaire",
        "section":  "59",
        "nature":  "Charges de personnel intérimaire et temporaire facturé par des agences de travail temporaire",
        "exemples":  "Factures agence intérim, mise à disposition temporaire opérateurs logistique, personnel saisonnier agence",
        "exclusions":  "Exclure : sous-traitants opérationnels (51010000), dock workers (59070100), salariés permanents (59000000)",
        "ohada":  "OHADA 621 – Sous-traitance / Personnel extérieur",
        "traitement":  "Opex – Flexibilité RH",
        "centreCout":  "Opérations / Logistique / RH"
    },
    {
        "compte":  "59070100",
        "labelEn":  "Dock Workers - Salar",
        "labelFr":  "Dock Workers – Salaires",
        "section":  "59",
        "nature":  "Salaires bruts versés aux dockers (ouvriers portuaires) directement employés ou gérés via bureau des dockers",
        "exemples":  "Salaires mensuels dockers CDI, rémunération dockers BUID (Bureau Ivoirien des Dockers), vacation dockers",
        "exclusions":  "Exclure : charges sociales dockers (59070101), heures sup dockers (59002200), sous-traitance manutention (51010000)",
        "ohada":  "OHADA 661 – Rémunérations du personnel portuaire",
        "traitement":  "Opex – Coût de main-d\u0027œuvre directe",
        "centreCout":  "Opérations Portuaires / Terminal / Logistique"
    },
    {
        "compte":  "59070101",
        "labelEn":  "Dock Workers - Socia",
        "labelFr":  "Dock Workers – Charges sociales",
        "section":  "59",
        "nature":  "Cotisations sociales patronales spécifiques aux dockers : CNPS, fonds de prévoyance dockers",
        "exemples":  "Charges CNPS employeur dockers, contribution fonds prévoyance portuaire, charges retraite spécifique dockers",
        "exclusions":  "Exclure : salaires dockers (59070100), charges sociales personnel administratif (59000050)",
        "ohada":  "OHADA 664 – Charges sociales dockers",
        "traitement":  "Opex – Charge patronale portuaire",
        "centreCout":  "Finance / RH / Opérations Portuaires"
    },
    {
        "compte":  "59070103",
        "labelEn":  "Dock Workers - Misce",
        "labelFr":  "Dock Workers – Divers",
        "section":  "59",
        "nature":  "Charges diverses et accessoires liées aux dockers non classées dans les sous-comptes salaires et charges sociales",
        "exemples":  "Indemnités spéciales dockers, frais de médecine du travail portuaire, tenues de travail dockers, primes de danger",
        "exclusions":  "Exclure : salaires (59070100), charges sociales (59070101), sous-traitance (51010000)",
        "ohada":  "OHADA 661 / 664 – Divers personnel portuaire",
        "traitement":  "Opex – Charges diverses personnel",
        "centreCout":  "Opérations Portuaires / RH"
    },
    {
        "compte":  "59080000",
        "labelEn":  "Misc empl expenses",
        "labelFr":  "Frais divers du personnel",
        "section":  "59",
        "nature":  "Charges diverses liées au personnel ne pouvant être rattachées à un poste spécifique",
        "exemples":  "Frais de recrutement, annonces emploi, headhunter, bilan de compétences, frais déménagement expatrié",
        "exclusions":  "Exclure : formations (58507000), cadeaux (59035000), médecine (59028000), transport (59034000)",
        "ohada":  "OHADA 661 – Autres charges de personnel",
        "traitement":  "Opex – Charge RH diverse",
        "centreCout":  "RH / Direction / G\u0026A"
    },
    {
        "compte":  "59500010",
        "labelEn":  "Prof Tax",
        "labelFr":  "Taxe professionnelle / Patente",
        "section":  "59",
        "nature":  "Impôt annuel dû au titre de l\u0027exercice d\u0027une activité professionnelle : patente, taxe professionnelle unique",
        "exemples":  "Patente annuelle entreprise de transit, taxe professionnelle unique (TPU) Côte d\u0027Ivoire",
        "exclusions":  "Exclure : IS (70000000), taxes douanières, TVA, taxe foncière (59500040)",
        "ohada":  "OHADA 635 – Patente et taxes professionnelles",
        "traitement":  "Opex – Charge fiscale obligatoire",
        "centreCout":  "Finance / Direction / G\u0026A"
    },
    {
        "compte":  "59500040",
        "labelEn":  "Pty Tax",
        "labelFr":  "Taxe foncière / Impôt sur la propriété",
        "section":  "59",
        "nature":  "Impôts annuels dus au titre de la détention de biens immobiliers : taxe foncière, contribution foncière",
        "exemples":  "Taxe foncière sur bureaux, contribution foncière terrain dépôt, impôt sur propriété bâtie",
        "exclusions":  "Exclure : taxe professionnelle (59500010), loyers (58504100), investissements immobiliers (capex)",
        "ohada":  "OHADA 635 – Contributions foncières",
        "traitement":  "Opex – Charge fiscale foncière",
        "centreCout":  "Finance / G\u0026A"
    },
    {
        "compte":  "59500070",
        "labelEn":  "Tax OP Income",
        "labelFr":  "Taxe sur revenus d\u0027exploitation",
        "section":  "59",
        "nature":  "Taxe ou prélèvement assis sur les revenus ou résultats opérationnels (hors IS principal)",
        "exemples":  "Contribution sur bénéfice secteur transport, prélèvement sur chiffre d\u0027affaires portuaire, redevance sectorielle",
        "exclusions":  "Exclure : IS principal (70000000), TVA, droits de douane, taxe professionnelle (59500010)",
        "ohada":  "OHADA 635 – Taxes sectorielles",
        "traitement":  "Opex – Charge fiscale sectorielle",
        "centreCout":  "Finance / Direction"
    },
    {
        "compte":  "59502002",
        "labelEn":  "Mgt Fee Exp",
        "labelFr":  "Frais de management / Management fees",
        "section":  "59",
        "nature":  "Refacturation de charges de services de gestion par la maison mère ou entité holding du groupe",
        "exemples":  "Redevances management fees siège groupe, quote-part frais groupe pour services partagés (IT, RH, Finance, Juridique)",
        "exclusions":  "Exclure : dividendes (résultat), redevances de marque/licence (compte spécifique), achats de prestations tiers (58507000)",
        "ohada":  "OHADA 628 – Charges refacturées par le groupe",
        "traitement":  "Opex – Charges inter-compagnies (à documenter transfer pricing)",
        "centreCout":  "Direction / Finance / G\u0026A"
    },
    {
        "compte":  "59503001",
        "labelEn":  "Var Fines",
        "labelFr":  "Amendes et pénalités diverses (déductibles)",
        "section":  "59",
        "nature":  "Pénalités contractuelles, amendes déductibles fiscalement, pénalités de retard",
        "exemples":  "Pénalités de retard client, amendes contractuelles fournisseur, pénalités retard livraison, indemnités rupture contrat",
        "exclusions":  "Exclure : amendes non déductibles (59504070), pénalités fiscales (compte spécifique), litiges (58506000)",
        "ohada":  "OHADA 671 – Pénalités et amendes",
        "traitement":  "Opex – Charge exceptionnelle / non récurrente",
        "centreCout":  "Direction / Juridique / Finance"
    },
    {
        "compte":  "59504070",
        "labelEn":  "Var Fines Ndduct",
        "labelFr":  "Amendes et pénalités non déductibles",
        "section":  "59",
        "nature":  "Pénalités et amendes fiscalement non déductibles : infractions, pénalités fiscales, amendes administratives",
        "exemples":  "Amende fiscale DGI, pénalités TVA pour retard déclaration, amendes pénales, sanctions OHADA",
        "exclusions":  "Exclure : pénalités déductibles (59503001), provisions pour litiges (bilan), frais juridiques (58506000)",
        "ohada":  "OHADA 671 – Pénalités non déductibles",
        "traitement":  "Opex – Non déductible (retraitement fiscal obligatoire)",
        "centreCout":  "Finance / Fiscalité / Direction"
    },
    {
        "compte":  "59510040",
        "labelEn":  "Loss on claims",
        "labelFr":  "Pertes sur sinistres",
        "section":  "59",
        "nature":  "Charges nettes de sinistres non couvertes par l\u0027assurance : vol, casse, détérioration de marchandises ou équipements",
        "exemples":  "Perte sur vol de carburant non remboursé assurance, perte marchandise avariée non couverte, franchise sinistre incendie",
        "exclusions":  "Exclure : charges d\u0027assurance (58570000/58570001), provision pour dépréciation (bilan), pertes de change (60xxx)",
        "ohada":  "OHADA 673 – Pertes sur sinistres",
        "traitement":  "Opex – Charge de sinistre",
        "centreCout":  "Finance / Opérations / Direction"
    },
    {
        "compte":  "59900000",
        "labelEn":  "Rental non op exp",
        "labelFr":  "Charges locatives non opérationnelles",
        "section":  "59",
        "nature":  "Loyers et charges de location sur actifs non liés à l\u0027exploitation principale (propriétés données en sous-location, etc.)",
        "exemples":  "Loyer résidence mise à disposition expatrié, location appartement de fonction dirigeant, location salle non opérationnelle",
        "exclusions":  "Exclure : loyers opérationnels (51060000/51060100), loyers bureaux (58504100), IFRS 16 droit d\u0027usage (bilan)",
        "ohada":  "OHADA 613 – Locations diverses",
        "traitement":  "Opex – Charge accessoire",
        "centreCout":  "Direction / RH / G\u0026A"
    },
    {
        "compte":  "60500000",
        "labelEn":  "FxGain Rcvbl/Asst Un",
        "labelFr":  "Gain de change – Créances/Actifs non réalisé",
        "section":  "60",
        "nature":  "Gain latent de change sur créances clients et actifs monétaires non encore encaissés à la date d\u0027évaluation",
        "exemples":  "Réévaluation créance client USD au cours de clôture supérieur au cours initial, gain latent devises sur bilan",
        "exclusions":  "Exclure : gain de change réalisé (60502000), gain de change sur dettes (60504000), écarts de conversion (bilan OHADA)",
        "ohada":  "OHADA 476 – Écarts de conversion actif (latent)",
        "traitement":  "IFRS – IAS 21 : gain latent P\u0026L",
        "centreCout":  "Finance / Comptabilité / Trésorerie"
    },
    {
        "compte":  "60501000",
        "labelEn":  "FxLoss Rcvbl/Asst Un",
        "labelFr":  "Perte de change – Créances/Actifs non réalisée",
        "section":  "60",
        "nature":  "Perte latente de change sur créances clients et actifs monétaires non encore encaissés",
        "exemples":  "Réévaluation créance USD au cours de clôture inférieur au cours initial, perte latente sur actifs en devises",
        "exclusions":  "Exclure : perte réalisée (60503000), perte sur dettes (60505000), OHADA traitement différé",
        "ohada":  "OHADA 478 – Écarts de conversion passif (latent)",
        "traitement":  "IFRS – IAS 21 : perte latente P\u0026L",
        "centreCout":  "Finance / Comptabilité / Trésorerie"
    },
    {
        "compte":  "60502000",
        "labelEn":  "FxGain Rcvbl/Asst Re",
        "labelFr":  "Gain de change – Créances/Actifs réalisé",
        "section":  "60",
        "nature":  "Gain effectif de change sur encaissement de créances en devises étrangères",
        "exemples":  "Encaissement créance USD à cours supérieur au cours de comptabilisation, gain réalisé virement devise",
        "exclusions":  "Exclure : gain latent (60500000), gain sur dettes payées (60508000)",
        "ohada":  "OHADA 776 – Gains de change",
        "traitement":  "Opex/Financier – IAS 21 réalisé",
        "centreCout":  "Finance / Trésorerie / Comptabilité"
    },
    {
        "compte":  "60503000",
        "labelEn":  "FxLoss Rcvbl/Asst Re",
        "labelFr":  "Perte de change – Créances/Actifs réalisée",
        "section":  "60",
        "nature":  "Perte effective de change sur encaissement de créances en devises étrangères à cours défavorable",
        "exemples":  "Encaissement créance EUR à cours inférieur au cours de comptabilisation, perte réalisée transfert devise",
        "exclusions":  "Exclure : perte latente (60501000), perte sur règlement dettes (60509000)",
        "ohada":  "OHADA 676 – Pertes de change",
        "traitement":  "Opex/Financier – IAS 21 réalisé",
        "centreCout":  "Finance / Trésorerie / Comptabilité"
    },
    {
        "compte":  "60504000",
        "labelEn":  "FxGain Payb\u0026Liab Un",
        "labelFr":  "Gain de change – Dettes/Passifs non réalisé",
        "section":  "60",
        "nature":  "Gain latent sur dettes fournisseurs et passifs en devises : baisse du cours de la devise de la dette",
        "exemples":  "Réévaluation dette fournisseur USD à cours de clôture inférieur au cours initial (gain pour l\u0027entreprise débitrice)",
        "exclusions":  "Exclure : gain réalisé sur paiement (60508000), gains sur créances (60500000)",
        "ohada":  "OHADA 476 – Écarts conversion actif latent dettes",
        "traitement":  "IFRS – IAS 21 : gain latent P\u0026L",
        "centreCout":  "Finance / Comptabilité / Trésorerie"
    },
    {
        "compte":  "60505000",
        "labelEn":  "FxLoss Payb\u0026Liab Un",
        "labelFr":  "Perte de change – Dettes/Passifs non réalisée",
        "section":  "60",
        "nature":  "Perte latente sur dettes fournisseurs et passifs en devises : hausse du cours de la devise de la dette",
        "exemples":  "Réévaluation dette fournisseur USD à cours de clôture supérieur (perte pour entreprise débitrice)",
        "exclusions":  "Exclure : perte réalisée sur paiement (60509000), pertes sur créances (60501000)",
        "ohada":  "OHADA 478 – Écarts conversion passif latent",
        "traitement":  "IFRS – IAS 21 : perte latente P\u0026L",
        "centreCout":  "Finance / Comptabilité / Trésorerie"
    },
    {
        "compte":  "60508000",
        "labelEn":  "FxGain Payb\u0026Liab Re",
        "labelFr":  "Gain de change – Dettes/Passifs réalisé",
        "section":  "60",
        "nature":  "Gain effectif de change lors du règlement de dettes en devises à cours inférieur au cours d\u0027enregistrement",
        "exemples":  "Paiement fournisseur USD à cours plus bas que cours d\u0027origine, économie réalisée sur remboursement emprunt devises",
        "exclusions":  "Exclure : gain latent (60504000), gains sur créances (60502000)",
        "ohada":  "OHADA 776 – Gains de change réalisés",
        "traitement":  "IFRS – IAS 21 réalisé",
        "centreCout":  "Finance / Trésorerie / Comptabilité"
    },
    {
        "compte":  "60509000",
        "labelEn":  "FxLoss Payb\u0026Liab Re",
        "labelFr":  "Perte de change – Dettes/Passifs réalisée",
        "section":  "60",
        "nature":  "Perte effective de change lors du règlement de dettes en devises à cours supérieur au cours d\u0027enregistrement",
        "exemples":  "Paiement fournisseur EUR à cours plus élevé que cours d\u0027origine, surcoût remboursement emprunt",
        "exclusions":  "Exclure : perte latente (60505000), pertes sur créances (60503000)",
        "ohada":  "OHADA 676 – Pertes de change réalisées",
        "traitement":  "IFRS – IAS 21 réalisé",
        "centreCout":  "Finance / Trésorerie / Comptabilité"
    },
    {
        "compte":  "61512050",
        "labelEn":  "Dep Land - RoU",
        "labelFr":  "Amortissement Terrain – Droit d\u0027usage (IFRS 16)",
        "section":  "61",
        "nature":  "Dotation aux amortissements de l\u0027actif droit d\u0027usage relatif aux terrains loués comptabilisés selon IFRS 16",
        "exemples":  "Amortissement linéaire droit d\u0027usage terrain concession portuaire sur durée du bail, amortissement RoU terrain dépôt",
        "exclusions":  "Exclure : loyer terrain en Opex (51060000 si contrat court), amortissement bâtiments (61513000), charges financières lease (65012040)",
        "ohada":  "OHADA : sans équivalent direct / IAS 16 + IFRS 16",
        "traitement":  "IFRS 16 – Actif droit d\u0027usage / Capex bilan",
        "centreCout":  "Finance / Comptabilité / Logistique"
    },
    {
        "compte":  "61513000",
        "labelEn":  "Dep Building",
        "labelFr":  "Amortissement des bâtiments",
        "section":  "61",
        "nature":  "Dotation aux amortissements des immeubles et constructions inscrits à l\u0027actif (en propre ou droit d\u0027usage)",
        "exemples":  "Amortissement entrepôt sur 20 ans, amortissement bureaux siège sur 30 ans, amortissement hangar logistique",
        "exclusions":  "Exclure : loyers (58504100/51060000), amortissement terrain (61512050), réparations bâtiment (Opex)",
        "ohada":  "OHADA 681 – Dotations aux amortissements immobilisations corporelles",
        "traitement":  "Opex non cash – IAS 16",
        "centreCout":  "Finance / Comptabilité / G\u0026A"
    },
    {
        "compte":  "61519000",
        "labelEn":  "Dep Equipment op",
        "labelFr":  "Amortissement équipements opérationnels",
        "section":  "61",
        "nature":  "Dotation aux amortissements des équipements de manutention et opérationnels : chariots, grues, matériel de parc",
        "exemples":  "Amortissement chariot élévateur sur 5 ans, amortissement grue portique sur 15 ans, amortissement convoyeur",
        "exclusions":  "Exclure : entretien et réparations (51030000), location équipements (51060100), amortissement véhicules (61521000)",
        "ohada":  "OHADA 681 – Dotations amortissements matériel",
        "traitement":  "Opex non cash – IAS 16",
        "centreCout":  "Parc / Logistique / Opérations"
    },
    {
        "compte":  "61520000",
        "labelEn":  "Dep Furn, Fittings",
        "labelFr":  "Amortissement mobilier et agencements",
        "section":  "61",
        "nature":  "Dotation aux amortissements du mobilier de bureau, agencements et installations fixes",
        "exemples":  "Amortissement bureaux, chaises, armoires, cloisons, faux plafonds, éclairage intégré",
        "exclusions":  "Exclure : fournitures de bureau consommables (58508000), rénovation lourde (capex), mobilier de moins d\u0027un an",
        "ohada":  "OHADA 681 – Dotations amortissements mobilier",
        "traitement":  "Opex non cash – IAS 16",
        "centreCout":  "Administration / G\u0026A"
    },
    {
        "compte":  "61520120",
        "labelEn":  "Dep Furniture",
        "labelFr":  "Amortissement mobilier (sous-compte)",
        "section":  "61",
        "nature":  "Dotation spécifique aux amortissements du mobilier de bureau stricto sensu (distinct des agencements)",
        "exemples":  "Amortissement bureaux dirigeants, mobilier open space, fauteuils de réunion, tables de réunion",
        "exclusions":  "Exclure : agencements (61520000), matériel informatique (sous-compte IT), mobilier opérationnel parc",
        "ohada":  "OHADA 681 – Dotations amortissements mobilier",
        "traitement":  "Opex non cash – IAS 16",
        "centreCout":  "Administration / Direction / G\u0026A"
    },
    {
        "compte":  "61521000",
        "labelEn":  "Dep Vehicle Op",
        "labelFr":  "Amortissement véhicules opérationnels",
        "section":  "61",
        "nature":  "Dotation aux amortissements des véhicules affectés à l\u0027exploitation : camions, remorques, tracteurs de parc",
        "exemples":  "Amortissement tracteur portuaire sur 7 ans, amortissement semi-remorque sur 8 ans, amortissement camion livraison",
        "exclusions":  "Exclure : véhicules administratifs (61522000), engins de manutention (61519000), véhicules en IFRS 16 (61512050)",
        "ohada":  "OHADA 681 – Dotations amortissements matériel de transport",
        "traitement":  "Opex non cash – IAS 16",
        "centreCout":  "Transport / Logistique / Parc"
    },
    {
        "compte":  "61522000",
        "labelEn":  "Dep Vehicle Adm",
        "labelFr":  "Amortissement véhicules administratifs",
        "section":  "61",
        "nature":  "Dotation aux amortissements des véhicules de direction et de service à usage administratif",
        "exemples":  "Amortissement voiture de direction sur 4 ans, amortissement pick-up de service sur 5 ans",
        "exclusions":  "Exclure : véhicules opérationnels (61521000), entretien véhicules (58552001), location véhicules (IFRS 16)",
        "ohada":  "OHADA 681 – Dotations amortissements véhicules",
        "traitement":  "Opex non cash – IAS 16",
        "centreCout":  "Direction / Administration / G\u0026A"
    },
    {
        "compte":  "65008000",
        "labelEn":  "Inter Exp Bwings FI",
        "labelFr":  "Charges d\u0027intérêts – Emprunts",
        "section":  "65",
        "nature":  "Intérêts sur emprunts bancaires et obligataires : intérêts courus, charges financières sur crédits à moyen/long terme",
        "exemples":  "Intérêts emprunt bancaire investissement, charges financières crédit syndiqué, coupon obligations émises",
        "exclusions":  "Exclure : charges d\u0027intérêts leasing IFRS 16 (65012040), frais bancaires (65518000), pertes de change (60xxx)",
        "ohada":  "OHADA 671 – Charges d\u0027intérêts",
        "traitement":  "IFRS – IAS 23 / Financement",
        "centreCout":  "Finance / Trésorerie / Direction"
    },
    {
        "compte":  "65010000",
        "labelEn":  "Inter Exp Bank O\u0026CP",
        "labelFr":  "Charges d\u0027intérêts – Découverts bancaires",
        "section":  "65",
        "nature":  "Agios et intérêts sur facilités de caisse, découverts autorisés, crédits à court terme et crédits de campagne",
        "exemples":  "Agios découvert bancaire, intérêts facilité de caisse, intérêts crédit trésorerie court terme",
        "exclusions":  "Exclure : frais bancaires fixes (65518000), intérêts emprunts LT (65008000), commissions bancaires (65518000)",
        "ohada":  "OHADA 671 – Agios bancaires",
        "traitement":  "IFRS – Charge financière",
        "centreCout":  "Finance / Trésorerie"
    },
    {
        "compte":  "65012040",
        "labelEn":  "Inter fi lease-RoU",
        "labelFr":  "Charges financières – Leasing IFRS 16 (Droit d\u0027usage)",
        "section":  "65",
        "nature":  "Composante financière des paiements de loyers IFRS 16 : intérêts sur la dette locative capitalisée",
        "exemples":  "Charge d\u0027intérêt sur dette locative bail bureaux, intérêts passifs IFRS 16 sur contrat location engin",
        "exclusions":  "Exclure : amortissement droit d\u0027usage (61512050 / 61519000), loyers court terme (Opex 51060000)",
        "ohada":  "OHADA : sans équivalent / IFRS 16 spécifique",
        "traitement":  "IFRS 16 – Charge financière sur passif locatif",
        "centreCout":  "Finance / Comptabilité"
    },
    {
        "compte":  "65518000",
        "labelEn":  "Bank Chge \u0026 Comm",
        "labelFr":  "Frais et commissions bancaires",
        "section":  "65",
        "nature":  "Frais fixes bancaires : commissions de tenue de compte, frais de virement, commissions documentaires",
        "exemples":  "Commissions de tenue de compte, frais Swift virement international, commission crédit documentaire, frais SEPA",
        "exclusions":  "Exclure : intérêts (65008000/65010000), pertes de change (60xxx), garanties bancaires (bilan passif)",
        "ohada":  "OHADA 627 – Services bancaires",
        "traitement":  "Opex – Charge financière",
        "centreCout":  "Finance / Trésorerie"
    },
    {
        "compte":  "65526000",
        "labelEn":  "FxGain Fin Asst Un",
        "labelFr":  "Gain de change – Actifs financiers non réalisé",
        "section":  "65",
        "nature":  "Gain latent de change sur actifs financiers (prêts, placements, dépôts) libellés en devises",
        "exemples":  "Réévaluation prêt groupe USD en gain latent, placement devises valorisé en hausse de cours à la clôture",
        "exclusions":  "Exclure : gain réalisé (65528000), gain sur créances commerciales (60500000)",
        "ohada":  "OHADA 476 – Écarts conversion latents",
        "traitement":  "IFRS – IAS 21 / IFRS 9 : P\u0026L ou OCI selon classification",
        "centreCout":  "Finance / Trésorerie"
    },
    {
        "compte":  "65526100",
        "labelEn":  "FxLoss Fin Asst Un",
        "labelFr":  "Perte de change – Actifs financiers non réalisée",
        "section":  "65",
        "nature":  "Perte latente de change sur actifs financiers libellés en devises à la date d\u0027évaluation",
        "exemples":  "Réévaluation prêt groupe EUR en perte latente, dépôt à terme devises valorisé en baisse de cours",
        "exclusions":  "Exclure : perte réalisée (65528100), perte sur créances commerciales (60501000)",
        "ohada":  "OHADA 478 – Écarts conversion latents passif",
        "traitement":  "IFRS – IAS 21 / IFRS 9",
        "centreCout":  "Finance / Trésorerie"
    },
    {
        "compte":  "65528000",
        "labelEn":  "FxGain Fin Asst Re",
        "labelFr":  "Gain de change – Actifs financiers réalisé",
        "section":  "65",
        "nature":  "Gain effectif de change sur remboursement ou cession d\u0027actifs financiers en devises",
        "exemples":  "Remboursement prêt groupe en USD à cours favorable, gain réalisé cession placement devises",
        "exclusions":  "Exclure : gain latent (65526000), gains sur créances commerciales (60502000)",
        "ohada":  "OHADA 776 – Gains de change réalisés",
        "traitement":  "IFRS – IAS 21 / IFRS 9 réalisé",
        "centreCout":  "Finance / Trésorerie"
    },
    {
        "compte":  "65528100",
        "labelEn":  "FxLoss Fin Asst Re",
        "labelFr":  "Perte de change – Actifs financiers réalisée",
        "section":  "65",
        "nature":  "Perte effective de change sur remboursement ou cession d\u0027actifs financiers en devises à cours défavorable",
        "exemples":  "Remboursement prêt groupe en EUR à cours défavorable, perte réalisée cession dépôt devises",
        "exclusions":  "Exclure : perte latente (65526100), pertes sur créances commerciales (60503000)",
        "ohada":  "OHADA 676 – Pertes de change réalisées",
        "traitement":  "IFRS – IAS 21 / IFRS 9 réalisé",
        "centreCout":  "Finance / Trésorerie"
    },
    {
        "compte":  "65530010",
        "labelEn":  "FxGain Fin Liab Un",
        "labelFr":  "Gain de change – Passifs financiers non réalisé",
        "section":  "65",
        "nature":  "Gain latent de change sur dettes financières en devises : baisse de la devise d\u0027emprunt à la clôture",
        "exemples":  "Réévaluation emprunt USD en gain latent (devise USD baisse vs FCFA), gain latent sur obligation devises",
        "exclusions":  "Exclure : gain réalisé sur remboursement (voir comptes réalisés), gains sur dettes commerciales (60504000)",
        "ohada":  "OHADA 476 – Écarts conversion actif latent",
        "traitement":  "IFRS – IAS 21 : P\u0026L",
        "centreCout":  "Finance / Trésorerie"
    },
    {
        "compte":  "65530110",
        "labelEn":  "FxLoss Fin Liab Un",
        "labelFr":  "Perte de change – Passifs financiers non réalisée",
        "section":  "65",
        "nature":  "Perte latente sur dettes financières en devises : hausse de la devise d\u0027emprunt à la clôture",
        "exemples":  "Réévaluation emprunt EUR en perte latente (EUR monte vs FCFA), perte latente obligation libellée en dollars",
        "exclusions":  "Exclure : perte réalisée sur remboursement, pertes sur dettes commerciales (60505000)",
        "ohada":  "OHADA 478 – Écarts conversion passif latent",
        "traitement":  "IFRS – IAS 21 : P\u0026L",
        "centreCout":  "Finance / Trésorerie"
    },
    {
        "compte":  "65590000",
        "labelEn":  "Rounding Gain",
        "labelFr":  "Gain d\u0027arrondi",
        "section":  "65",
        "nature":  "Gain technique résultant des arrondis comptables lors du traitement automatique des transactions",
        "exemples":  "Écart d\u0027arrondi sur paiements, gain centimes sur conversion devises, différence d\u0027arrondi règlement massé",
        "exclusions":  "Exclure : gains de change réels (60508000), ajustements prix (note de crédit)",
        "ohada":  "OHADA : Divers gains techniques",
        "traitement":  "Opex – Technique comptable",
        "centreCout":  "Finance / Comptabilité / SAP"
    },
    {
        "compte":  "65591100",
        "labelEn":  "Clearing Loss",
        "labelFr":  "Perte de solde / Clearing",
        "section":  "65",
        "nature":  "Charge résultant de l\u0027impossibilité d\u0027imputer un solde résiduel ou d\u0027un compte de contrepartie non soldé",
        "exemples":  "Perte de solde compte de clearing SAP non lettré, écart de règlement compte intermédiaire, solde résiduel non récupérable",
        "exclusions":  "Exclure : pertes de change (60503000), différences de caisse (compte spécifique), erreurs de saisie à corriger",
        "ohada":  "OHADA 671 – Charges diverses",
        "traitement":  "Opex – Charge technique / à minimiser",
        "centreCout":  "Finance / Comptabilité / SAP"
    },
    {
        "compte":  "70000000",
        "labelEn":  "CIT exp Period",
        "labelFr":  "Impôt sur les bénéfices de la période",
        "section":  "70",
        "nature":  "Charge d\u0027impôt sur les sociétés (IS) de l\u0027exercice courant : IS exigible et variation d\u0027IS différé",
        "exemples":  "Acompte IS trimestriel, régularisation IS final exercice, activation/extinction IS différé, charge IS consolidé",
        "exclusions":  "Exclure : taxes professionnelles (59500010), TVA, droits de douane, impôts et taxes opérationnels (59500xxx)",
        "ohada":  "OHADA 891 – Impôts sur le résultat",
        "traitement":  "IAS 12 – IS courant + IS différé",
        "centreCout":  "Finance / Direction / Comptabilité"
    },
    {
        "compte":  "90002000",
        "labelEn":  "Contr Log-Clearing",
        "labelFr":  "Compte de clearing logistique / Contrepartie",
        "section":  "90",
        "nature":  "Compte technique de contrepartie pour les mouvements de charges opérationnelles logistiques en attente d\u0027imputation définitive",
        "exemples":  "Écritures de refacturation inter-entités logistiques, contrepartie charges en transit comptable, clearing opérations en cours",
        "exclusions":  "Exclure : charges définitivement imputées, produits refacturés (compte de revenus), solde doit être nul en clôture",
        "ohada":  "OHADA : Compte de passage / technique",
        "traitement":  "IFRS – Compte d\u0027attente (à apurer)",
        "centreCout":  "Finance / Comptabilité / Opérations"
    },
    {
        "compte":  "90003000",
        "labelEn":  "Group - Clearing",
        "labelFr":  "Compte de clearing groupe",
        "section":  "90",
        "nature":  "Compte technique inter-compagnies pour les transactions intra-groupe en attente de lettrage et confirmation",
        "exemples":  "Refacturation services groupe en transit, management fees en cours de validation, dividendes intra-groupe en attente",
        "exclusions":  "Exclure : charges groupe définitives (59502002), créances/dettes intragroupes définitives (bilan)",
        "ohada":  "OHADA : Compte de passage intercompany",
        "traitement":  "IFRS – Élimination consolidation / à apurer",
        "centreCout":  "Finance / Comptabilité / Groupe"
    },
    {
        "compte":  "90005000",
        "labelEn":  "Custom house Br Rev",
        "labelFr":  "Produit commissionnaire douane / Revenus transit",
        "section":  "90",
        "nature":  "Revenus générés par l\u0027activité de commissionnaire en douane : honoraires de transit, commissions de dédouanement",
        "exemples":  "Facturation honoraires transit client, commissions dédouanement importation, fees commissionnaire agréé en douane",
        "exclusions":  "Exclure : refacturations de débours (comptes dédiés), charges de transit (52030000), produits logistiques autres",
        "ohada":  "OHADA 706 / 707 – Produits des services",
        "traitement":  "Opex/Produit – Revenu opérationnel core",
        "centreCout":  "Transit / Douane / Commercial"
    },
    {
        "compte":  "90006000",
        "labelEn":  "Disb Cust house Brok",
        "labelFr":  "Débours commissionnaire en douane",
        "section":  "90",
        "nature":  "Avances et débours consentis par le commissionnaire pour le compte du client : droits payés pour tiers",
        "exemples":  "Droits de douane avancés pour client, TVA à l\u0027importation avancée, frais portuaires avancés pour compte client",
        "exclusions":  "Exclure : charges propres de transit (52030000), honoraires propres (90005000), créances clients (bilan)",
        "ohada":  "OHADA 409 – Fournisseurs débiteurs / Compte client avances",
        "traitement":  "IFRS – Passif/Actif (refacturable) non P\u0026L propre",
        "centreCout":  "Transit / Douane / Finance"
    }
];

// Règles de contrôle interne SAP (anti-erreur de saisie).
export const REGLES_CONTROLE =
[
    {
        "regle":  "R2 – Séparation charges propres / refacturation",
        "description":  "Les débours refacturés clients (ex: droits de douane avancés 90006000) ne sont pas des charges définitives. Vérifier le flux."
    },
    {
        "regle":  "R3 – Change latent vs réalisé",
        "description":  "Distinguer systématiquement gain/perte latent (non réalisé, réévaluation bilan) vs réalisé (encaissement/paiement effectif)."
    },
    {
        "regle":  "R4 – IFRS 16 (Leases)",
        "description":  "Tout contrat de location \u003e 12 mois ou \u003e seuil bas de gamme doit être analysé IFRS 16 : actif droit d\u0027usage au bilan, pas en Opex."
    },
    {
        "regle":  "R5 – Personnel vs Sous-traitance",
        "description":  "Main-d\u0027œuvre directe permanente (59xxx) ≠ Sous-traitants/intérimaires (51010000/59070000). Vérifier le contrat."
    },
    {
        "regle":  "R6 – Amendes déductibles vs non déductibles",
        "description":  "59503001 (déductible) et 59504070 (non déductible) ne sont pas interchangeables. Impact fiscal direct."
    },
    {
        "regle":  "R7 – Comptes de clearing à apurer",
        "description":  "90002000 et 90003000 doivent avoir un solde nul en clôture. Tout solde résiduel doit être justifié et régularisé."
    },
    {
        "regle":  "R8 – IAS 19 Provisions RH",
        "description":  "59004000, 59004001, 59006000, 59016002 : provisions actuarielles. Valider avec DRH et/ou actuaire en clôture annuelle."
    },
    {
        "regle":  "R9 – Logiciels : Opex vs Capex",
        "description":  "Maintenance/abonnement = Opex (58530xxx). Développement/implémentation \u003e seuil = Capex IAS 38 à immobiliser."
    },
    {
        "regle":  "R10 – Management Fees",
        "description":  "59502002 doit être documenté par convention de prestations intra-groupe conforme aux règles de prix de transfert."
    }
];

// Index { numéro de compte -> entrée } pour résolution rapide du libellé.
export const COMPTES_PAR_NUMERO = Object.fromEntries(PLAN_COMPTABLE_IFRS.map((c) => [c.compte, c]));

// Comptes regroupés par section, dans l'ordre des sections.
export const PLAN_PAR_SECTION = SECTIONS_PLAN
  .map((s) => ({ ...s, comptes: PLAN_COMPTABLE_IFRS.filter((c) => c.section === s.prefixe) }))
  .filter((s) => s.comptes.length);

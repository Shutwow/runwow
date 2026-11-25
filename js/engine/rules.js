/* Texte des règles affiché dans l'appli : tout ce que fait le moteur est écrit ici. */
(function (RP) {
  RP.RULES = [
    {
      group: 'Construction du plan',
      items: [
        ['Phases', 'Le plan suit 4 phases : Base (environ 40 %), Construction (30 %), Spécifique (30 %), puis Affûtage. Si la préparation est plus longue que la durée idéale, c\'est la phase de base qui s\'allonge.'],
        ['Affûtage', '1 semaine pour 5 km, 10 km et trail court ; 2 semaines pour semi et trail long ; 3 semaines pour marathon et ultra. Volume : 80 % → 65 % → 45 % du pic (marathon), 70 % → 45 % (semi), 55 % (5-10 km). Une semaine de moins si la préparation est trop courte.'],
        ['Progression du volume', 'Une semaine de charge ne dépasse jamais la précédente de plus de 10 % (au moins +2 km pour les petits volumes, jamais plus de +15 %). Le plan démarre à ton volume actuel, jamais au-dessus.'],
        ['Semaines allégées', 'Après 3 semaines de charge, 1 semaine allégée à 70 % du volume, sans séance de qualité. La semaine qui précède l\'affûtage n\'est jamais allégée.'],
        ['Volume visé', 'Pic conseillé selon la distance et le niveau (ex. marathon : 45 / 65 / 90 km). Il n\'est atteint que si la règle des 10 % le permet ; sinon l\'appli te prévient.'],
        ['Polarisation 80/20', 'Environ 80 % du temps de course en endurance facile. Au maximum 2 séances de qualité par semaine (1 si tu cours 3 jours ou moins, 1 pour un débutant en phase de base).'],
      ],
    },
    {
      group: 'Mode entraînement (sans course)',
      items: [
        ['Cycles', 'Le plan avance par cycles de 8, 12 ou 16 semaines (ou en continu, par cycles de 12). Chaque cycle enchaîne base, construction et spécifique, avec la même progression de 10 % et les mêmes semaines allégées.'],
        ['Orientation', 'La distance choisie (5 km, 10 km, semi, marathon, trail…) oriente les séances de qualité, sans affûtage ni course.'],
        ['Semaine test', 'La dernière semaine de chaque cycle est allégée et comporte un test chrono (5 km, ou 3 km pour un débutant ; 30 min sur parcours de référence en trail). Reporte le chrono dans ton profil : les allures du cycle suivant sont recalculées.'],
      ],
    },
    {
      group: 'Placement dans la semaine',
      items: [
        ['Séances dures', 'Jamais deux séances dures (qualité ou sortie longue) deux jours de suite. Jamais de séance de qualité la veille de la sortie longue. Le lendemain de la sortie longue est évité. Les séances dures sont espacées au maximum.'],
        ['Sortie longue', 'Environ 27 à 45 % du volume selon le nombre de jours de course, plafonnée en durée (ex. 1h55 pour un semi, 3h pour un marathon, 32 km maximum). Elle progresse de 10 % (ou 1,5 km) maximum d\'une semaine de charge à l\'autre.'],
        ['Footings', 'Le volume restant est réparti sur les autres jours. Un footing qui ferait moins de 20-25 min est supprimé (jour de repos), en commençant par le lendemain de la sortie longue.'],
        ['Débutants', 'Si tu débutes avec moins de 15 km par semaine, les footings de la phase de base alternent course et marche.'],
        ['Ultra', 'En phase spécifique, si tu cours la veille de ta sortie longue, les deux sorties s\'enchaînent (week-end choc).'],
      ],
    },
    {
      group: 'Renforcement et mobilité',
      items: [
        ['Périodisation du renfo', 'Le type de renfo suit les phases de course : fondations en base, force en construction, puissance (pliométrie) en spécifique, entretien en affûtage et en semaine allégée.'],
        ['Placement du renfo', 'Jamais le jour ni la veille d\'une sortie longue, jamais la veille d\'une séance de qualité, jamais deux jours de suite. On le place de préférence le même jour qu\'une séance de qualité (après la course), puis un jour de repos, puis un jour de footing.'],
        ['Avant la course', 'Pas de renfo dans les 3 jours qui précèdent la course. Une seule séance d\'entretien pendant l\'affûtage.'],
        ['Prévention ciblée', 'Chaque séance de renfo et de mobilité ajoute des exercices pour tes zones fragiles déclarées (Achille, genou, hanche…).'],
        ['Mobilité', 'Une routine de récupération après chaque sortie longue, plus 1 à 2 routines (ou une par jour selon ton choix), de préférence les jours de repos.'],
        ['Trail', 'Volumes exprimés en km-effort (1 km-effort = 1 km à plat ou 100 m de D+). Exercices excentriques (descentes) ajoutés au renfo, sortie longue exprimée en durée et en D+.'],
      ],
    },
    {
      group: 'Allures',
      items: [
        ['VMA', 'Estimée à partir d\'une course récente, d\'après le pourcentage de VMA tenable selon la durée (100 % sur 6 min, 87 % sur 1 h, 80 % sur 2h30…). À défaut, une valeur par défaut selon le niveau.'],
        ['Objectif de temps', 'Si ton objectif demande plus de 3 % de vitesse que ce que prédit ta forme actuelle, les allures sont plafonnées à +3 % et l\'appli te prévient. On ne s\'entraîne pas à une allure qu\'on ne tient pas encore.'],
      ],
    },
    {
      group: 'Recalcul quand la réalité s\'écarte du plan',
      items: [
        ['R1 · Semaine réussie', 'Dès que toutes les séances de course d\'une semaine sont renseignées : si au moins 80 % du volume est réalisé, rien ne change.'],
        ['R2 · Semaine incomplète', 'Entre 50 et 80 % réalisé : la semaine suivante est plafonnée au volume réalisé + 10 %. On ne rattrape jamais les séances manquées.'],
        ['R3 · Semaine ratée', 'Moins de 50 % réalisé : la semaine suivante devient une semaine de reprise, sans séance de qualité.'],
        ['R4 · Coupure', 'Moins de 4 jours : rien ne change. 4 à 7 jours : reprise à 70 % du volume. 8 à 14 jours : 50 %. 15 à 28 jours : 40 % et 2 semaines sans qualité. Au-delà : 30 %, et l\'objectif est à revoir. La progression de 10 % repart ensuite de ce nouveau volume.'],
        ['R5 · Déplacer une séance', 'Une séance ne peut être déplacée que dans la même semaine, sur un jour où elle respecte les règles de placement. Jamais deux courses le même jour.'],
        ['R6 · Pas à 100 %', 'Une séance de qualité ou une sortie longue peut être remplacée par un footing facile de 25 à 35 min. Elle n\'est pas rattrapée.'],
        ['Semaine de course', 'La semaine de course n\'est jamais modifiée par le recalcul.'],
      ],
    },
    {
      group: 'Personnalisation par l\'historique Strava',
      items: [
        ['Source', 'Tes sorties de course des 6 derniers mois, lues via Strava connecté ou depuis l\'export Strava (.zip ou activities.csv). Le fichier est lu sur ton appareil.'],
        ['Volume actuel', 'Moyenne des 4 dernières semaines complètes.'],
        ['Plus longue sortie', 'La plus longue des 8 dernières semaines.'],
        ['Jours habituels', 'Les jours où tu as couru au moins 3 semaines sur les 8 dernières (2 jours minimum). Jour de sortie longue : celui où tombe le plus souvent ta plus longue sortie de la semaine.'],
        ['VMA', 'D\'après ta dernière sortie marquée « course » dans Strava si elle existe ; sinon d\'après ta 2e meilleure sortie plate de plus de 3 km (la meilleure est écartée pour éviter une erreur GPS). Une sortie d\'entraînement sous-estime un peu la VMA : c\'est volontairement prudent.'],
        ['Niveau', 'Débutant sous 15 km/semaine ou 11,5 km/h de VMA ; confirmé avec au moins 40 km/semaine et 15 km/h de VMA (ou 60 km/semaine, ou 17 km/h) ; intermédiaire entre les deux.'],
        ['Contrôle', 'Les valeurs sont seulement reportées dans le formulaire : tu les vérifies avant de générer le plan.'],
      ],
    },
    {
      group: 'Ajustement automatique des allures (avec Strava)',
      items: [
        ['R8 · Course', 'Une sortie marquée « Course » dans Strava (au moins 3 km, terrain plat) qui donne une VMA plus haute que la tienne met ta VMA à jour : toutes les allures du plan sont recalculées. Une course plus lente ne baisse jamais ta VMA automatiquement.'],
        ['R9 · Séances de qualité', '3 séances de qualité de suite courues au moins 5 % plus vite que prévu : VMA +2 %. 3 séances de suite au moins 7 % plus lentes : l\'appli te propose -2 %, sans l\'appliquer d\'elle-même. Seules les séances réalisées à 80 % au moins et sur terrain plat comptent, et seulement depuis le dernier changement de VMA.'],
        ['R10 · Footings', 'Si 2 de tes 3 derniers footings sont plus rapides que le haut de ta zone d\'endurance fondamentale (+3 %), un conseil s\'affiche pour ralentir. Le plan ne change pas.'],
        ['Trail et dénivelé', 'Les sorties avec plus de 15 m de D+ par km sont ignorées, et R9 et R10 ne s\'appliquent pas aux plans trail : l\'allure y dépend trop du terrain.'],
      ],
    },
    {
      group: 'Synchronisation Strava et montre',
      items: [
        ['R7 · Sortie Strava', 'Une sortie de course (route, trail, tapis) coche la séance prévue le même jour ; à défaut, une séance de la veille ou du lendemain dans la même semaine. Plusieurs sorties le même jour s\'additionnent.'],
        ['R7 · Fait ou partiel', 'Au moins 80 % de la distance prévue : fait. Entre 40 et 80 % : partiel. Moins de 40 % : la sortie ne compte pas. En trail, on compare les km-effort (km + D+ / 100).'],
        ['R7 · Séance ratée', 'Une séance sans sortie Strava 2 jours après sa date est marquée ratée (seulement à partir du jour où tu as connecté Strava). Tu peux toujours corriger : ta saisie manuelle n\'est jamais écrasée par la synchro.'],
        ['Recalcul', 'Les statuts venus de Strava déclenchent les mêmes règles R1 à R3 que ta saisie manuelle.'],
        ['Montre', 'Chaque séance de course s\'exporte en entraînement structuré : échauffement, répétitions, récupérations, retour au calme, avec une fourchette d\'allure (± 2 % pour l\'allure course). Côtes, descentes et footings en trail : sans allure cible, à l\'effort.'],
      ],
    },
  ];
  RP.DISCLAIMER = 'Cette appli applique des principes d\'entraînement généraux. Elle ne remplace ni un avis médical ni un coach. En cas de douleur qui persiste ou s\'aggrave pendant l\'effort, arrête et consulte.';
})(window.RP);

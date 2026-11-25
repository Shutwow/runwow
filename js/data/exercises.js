/* Bibliothèque d'exercices : renforcement, pliométrie, gainage, prévention, mobilité.
   eq = matériel minimum : aucun < elastique < halteres < salle */
(function (RP) {
  RP.EQUIP_LEVELS = ['aucun', 'elastique', 'halteres', 'salle'];
  RP.EQUIP_LABELS = {
    aucun: 'Aucun (poids du corps)',
    elastique: 'Élastiques',
    halteres: 'Haltères / kettlebell',
    salle: 'Salle de sport',
  };

  RP.INJURY_ZONES = {
    achille: "Tendon d'Achille / mollet",
    genou: 'Genou (rotule, syndrome rotulien)',
    hanche: 'Hanche / bandelette (TFL)',
    ischios: 'Ischio-jambiers',
    dos: 'Bas du dos',
    cheville: 'Cheville (entorses)',
    pied: 'Pied / aponévrose plantaire',
    tibia: 'Tibia (périostite)',
  };

  RP.SLOT_LABELS = {
    genou: 'Jambes (squat)',
    hanche: 'Chaîne postérieure',
    unilateral: 'Unilatéral',
    mollet: 'Mollets',
    gainage_ant: 'Gainage',
    gainage_lat: 'Gainage latéral',
    plio_basse: 'Pliométrie',
    plio_haute: 'Pliométrie',
    excentrique: 'Excentrique (descentes)',
    prev: 'Prévention',
  };

  // cat : force | gainage | plio | prev  — sert à choisir le dosage.
  RP.EXERCISES = [
    // Jambes (dominante genou)
    { id: 'squat_bulgare', name: 'Squat bulgare', slot: 'genou', cat: 'force', eq: 'aucun', per: 'par jambe',
      how: "Pied arrière posé sur une chaise ou un banc. Descends en contrôle jusqu'à cuisse avant parallèle au sol, genou dans l'axe du pied, buste légèrement penché." },
    { id: 'squat_pdc', name: 'Squat au poids du corps', slot: 'genou', cat: 'force', eq: 'aucun',
      how: 'Pieds largeur de hanches, descends hanches sous les genoux en gardant les talons au sol et le dos droit.' },
    { id: 'bulgare_halteres', name: 'Squat bulgare avec haltères', slot: 'genou', cat: 'force', eq: 'halteres', per: 'par jambe',
      how: 'Comme le squat bulgare, un haltère dans chaque main. Monte la charge quand les dernières répétitions deviennent faciles.' },
    { id: 'squat_goblet', name: 'Squat goblet', slot: 'genou', cat: 'force', eq: 'halteres',
      how: 'Haltère ou kettlebell tenu contre la poitrine, coudes entre les genoux en bas du mouvement.' },
    { id: 'squat_barre', name: 'Squat barre ou presse à cuisses', slot: 'genou', cat: 'force', eq: 'salle',
      how: "Charge lourde, descente contrôlée, remontée dynamique. Garde toujours 1 à 2 répétitions en réserve." },

    // Chaîne postérieure (dominante hanche)
    { id: 'sdt_uni', name: 'Soulevé de terre roumain sur une jambe', slot: 'hanche', cat: 'force', eq: 'aucun', per: 'par jambe',
      how: "Bascule le buste vers l'avant en tendant la jambe libre derrière toi, dos plat, genou d'appui légèrement fléchi. Excellent pour l'équilibre et les ischios." },
    { id: 'pont_uni', name: 'Pont fessier sur une jambe', slot: 'hanche', cat: 'force', eq: 'aucun', per: 'par jambe',
      how: 'Allongé sur le dos, un pied au sol, monte le bassin en serrant le fessier, pause 2 s en haut.' },
    { id: 'sdt_halteres', name: 'Soulevé de terre roumain haltères', slot: 'hanche', cat: 'force', eq: 'halteres',
      how: 'Haltères le long des cuisses, pousse les hanches en arrière, dos plat, descends jusqu\'à mi-tibia puis remonte en serrant les fessiers.' },
    { id: 'hip_thrust', name: 'Hip thrust à la barre', slot: 'hanche', cat: 'force', eq: 'salle',
      how: 'Haut du dos sur un banc, barre sur les hanches, monte jusqu\'à l\'alignement épaules-hanches-genoux.' },

    // Unilatéral / stabilité
    { id: 'step_up', name: 'Montée sur banc (step-up)', slot: 'unilateral', cat: 'force', eq: 'aucun', per: 'par jambe',
      how: 'Monte sur une marche haute ou un banc solide en poussant uniquement avec la jambe du haut, redescends lentement.' },
    { id: 'fente_arriere', name: 'Fente arrière', slot: 'unilateral', cat: 'force', eq: 'aucun', per: 'par jambe',
      how: 'Recule une jambe et descends le genou arrière près du sol, buste droit, puis reviens en poussant sur la jambe avant.' },
    { id: 'step_up_halteres', name: 'Step-up avec haltères', slot: 'unilateral', cat: 'force', eq: 'halteres', per: 'par jambe',
      how: 'Comme le step-up, haltères en main. Contrôle la descente sur 2 à 3 secondes.' },

    // Mollets
    { id: 'mollet_tendu', name: 'Montées sur pointes, genou tendu', slot: 'mollet', cat: 'force', eq: 'aucun', per: 'par jambe',
      how: "Sur une marche, sur une seule jambe : monte haut sur la pointe, descends lentement le talon sous le niveau de la marche." },
    { id: 'mollet_flechi', name: 'Montées sur pointes, genou fléchi (soléaire)', slot: 'mollet', cat: 'force', eq: 'aucun', per: 'par jambe',
      how: 'Même mouvement genou fléchi à 30-40° : cible le soléaire, très sollicité en course.' },
    { id: 'mollet_leste', name: 'Montées sur pointes lestées', slot: 'mollet', cat: 'force', eq: 'halteres', per: 'par jambe',
      how: 'Sur une jambe avec un haltère dans la main du même côté. Descente lente (3 s).' },
    { id: 'mollet_machine', name: 'Mollets à la machine', slot: 'mollet', cat: 'force', eq: 'salle',
      how: 'Charge lourde, amplitude complète, pause 1 s en haut.' },

    // Gainage
    { id: 'planche', name: 'Planche', slot: 'gainage_ant', cat: 'gainage', eq: 'aucun',
      how: 'Sur les avant-bras, corps aligné, fessiers et abdos serrés, respire normalement.' },
    { id: 'dead_bug', name: 'Dead bug', slot: 'gainage_ant', cat: 'gainage', eq: 'aucun',
      how: "Sur le dos, bras et jambes en l'air : allonge bras et jambe opposés sans décoller le bas du dos du sol." },
    { id: 'planche_laterale', name: 'Planche latérale', slot: 'gainage_lat', cat: 'gainage', eq: 'aucun', per: 'par côté',
      how: 'Sur un avant-bras, corps aligné, hanches hautes. Version difficile : lève la jambe du dessus.' },
    { id: 'copenhagen', name: 'Planche Copenhague', slot: 'gainage_lat', cat: 'gainage', eq: 'aucun', per: 'par côté', minLevel: 'intermediaire', dose: '3 × 15-25 s par côté',
      how: 'Planche latérale avec la jambe du dessus posée sur un banc (genou pour débuter, pied ensuite). Renforce les adducteurs.' },

    // Pliométrie
    { id: 'pogo', name: 'Pogo jumps', slot: 'plio_basse', cat: 'plio', eq: 'aucun',
      how: 'Petits rebonds rapides sur l\'avant-pied, chevilles raides, temps de contact au sol le plus court possible.' },
    { id: 'corde', name: 'Corde à sauter', slot: 'plio_basse', cat: 'plio', eq: 'aucun',
      how: 'Sauts légers sur l\'avant-pied, buste droit. Sans corde : mime le geste.' },
    { id: 'bonds', name: 'RunwoWs bondissantes', slot: 'plio_haute', cat: 'plio', eq: 'aucun',
      how: 'Sur 20-30 m, bondis d\'un pied sur l\'autre en cherchant amplitude et temps de vol. Récupère complètement entre les séries.' },
    { id: 'sauts_box', name: 'Sauts sur box', slot: 'plio_haute', cat: 'plio', eq: 'aucun',
      how: 'Saute à pieds joints sur une marche haute ou un box stable, réception souple, redescends en marchant.' },
    { id: 'sauts_uni', name: 'Sauts sur une jambe', slot: 'plio_haute', cat: 'plio', eq: 'aucun', per: 'par jambe', minLevel: 'intermediaire',
      how: 'Petits sauts vers l\'avant sur une jambe, réception stable et silencieuse.' },

    // Excentrique (trail : descentes)
    { id: 'step_down', name: 'Descente de marche lente (step-down)', slot: 'excentrique', cat: 'force', eq: 'aucun', per: 'par jambe',
      how: 'Debout sur une marche, descends lentement (4 s) le talon de l\'autre jambe vers le sol, genou dans l\'axe.' },
    { id: 'squat_excentrique', name: 'Squat excentrique 4 secondes', slot: 'excentrique', cat: 'force', eq: 'aucun',
      how: 'Descente du squat en 4 secondes, remontée normale. Prépare les quadriceps aux descentes.' },

    // Prévention ciblée
    { id: 'alfredson', name: 'Excentrique mollets (protocole Alfredson)', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['achille'], per: 'par jambe',
      how: 'Monte sur les deux pointes, puis descends lentement sur une seule jambe, talon sous la marche. Genou tendu puis genou fléchi.' },
    { id: 'iso_mollet', name: 'Isométrie mollet', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['achille', 'tibia'], per: 'par jambe', dose: '4 × 30-45 s',
      how: 'Tiens la position sur la pointe d\'un pied, à mi-hauteur. Effet antalgique reconnu sur les tendons.' },
    { id: 'wall_sit', name: 'Chaise contre le mur', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['genou'], dose: '4 × 30-45 s',
      how: 'Dos au mur, genoux à 60-90°. Isométrie utile en cas de douleur de rotule.' },
    { id: 'spanish_squat', name: 'Squat espagnol (élastique)', slot: 'prev', cat: 'prev', eq: 'elastique', zones: ['genou'], dose: '4 × 30-45 s',
      how: 'Élastique solide derrière les genoux, accroché devant toi : assieds-toi en arrière, tibias verticaux.' },
    { id: 'abduction_couche', name: 'Abduction de hanche couché', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['genou', 'hanche'], per: 'par côté',
      how: 'Couché sur le côté, jambe du dessus tendue et légèrement en arrière, monte-la lentement sans rouler le bassin.' },
    { id: 'monster_walk', name: 'Marche latérale élastique', slot: 'prev', cat: 'prev', eq: 'elastique', zones: ['genou', 'hanche'], dose: '3 × 12 pas par côté',
      how: 'Élastique autour des chevilles ou au-dessus des genoux, mi-squat, pas latéraux sans relâcher la tension.' },
    { id: 'nordic', name: 'Nordic hamstring curl', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['ischios'], dose: '3 × 4-6',
      how: 'À genoux, chevilles bloquées (sous un canapé ou tenues). Descends le buste le plus lentement possible, rattrape-toi avec les mains.' },
    { id: 'pont_ischio', name: 'Pont ischios talon sur banc', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['ischios'], per: 'par jambe',
      how: 'Talon posé sur un banc, jambe presque tendue, monte le bassin. Version unipodale quand c\'est facile.' },
    { id: 'bird_dog', name: 'Bird dog', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['dos'], per: 'par côté',
      how: 'À quatre pattes, tends bras et jambe opposés sans bouger le bassin, tiens 3 s.' },
    { id: 'mcgill', name: 'Curl-up McGill', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['dos'], dose: '3 × 8 (tenue 8 s)',
      how: 'Sur le dos, une jambe pliée, mains sous le bas du dos : décolle à peine tête et épaules, tiens 8 s.' },
    { id: 'equilibre', name: 'Équilibre sur une jambe', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['cheville', 'pied'], per: 'par jambe', dose: '3 × 30 s',
      how: 'Debout sur une jambe, pied nu. Progresse : yeux fermés, puis sur coussin.' },
    { id: 'tibialis', name: 'Relevés de pointes (tibial antérieur)', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['tibia', 'cheville'], dose: '3 × 15-20',
      how: 'Dos au mur, talons à 30 cm du mur : relève les pointes de pied le plus haut possible.' },
    { id: 'rathleff', name: 'Montées sur pointes, serviette sous les orteils', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['pied'], per: 'par jambe', dose: '3 × 8-12 (3 s montée, 2 s pause, 3 s descente)',
      how: 'Serviette roulée sous les orteils pour les mettre en extension : sollicite l\'aponévrose plantaire.' },
    { id: 'short_foot', name: 'Pied court (short foot)', slot: 'prev', cat: 'prev', eq: 'aucun', zones: ['pied', 'cheville'], dose: '3 × 10 (tenue 5 s)',
      how: 'Pied à plat, rapproche la tête du 1er métatarse du talon sans recroqueviller les orteils : la voûte se creuse.' },
  ];

  RP.MOBILITY = [
    { id: 'cheville_mur', name: 'Mobilité cheville genou au mur', zones: ['cheville', 'achille'], dose: '2 × 10 par jambe',
      how: 'Pied à 10 cm du mur, amène le genou toucher le mur sans décoller le talon. Recule le pied quand c\'est facile.' },
    { id: 'hanche_9090', name: 'Rotations de hanche 90/90', zones: ['hanche'], dose: '2 × 6 par côté',
      how: 'Assis, les deux jambes pliées à 90°, bascule les genoux d\'un côté puis de l\'autre en gardant le buste droit.' },
    { id: 'fente_basse', name: 'Étirement des fléchisseurs de hanche (fente basse)', zones: ['hanche', 'dos'], dose: '2 × 40 s par côté',
      how: 'Genou arrière au sol, bascule le bassin vers l\'arrière et serre le fessier : l\'étirement se sent à l\'avant de la hanche.' },
    { id: 'open_book', name: 'Ouverture thoracique (open book)', zones: ['dos'], dose: '2 × 8 par côté',
      how: 'Couché sur le côté, genoux pliés, ouvre le bras du dessus vers l\'arrière en suivant la main du regard.' },
    { id: 'wgs', name: 'Fente avec rotation (world\'s greatest stretch)', zones: ['hanche', 'dos'], dose: '5 par côté',
      how: 'Fente avant, main opposée au sol, coude vers la cheville puis rotation du buste bras vers le ciel.' },
    { id: 'chat_vache', name: 'Chat-vache', zones: ['dos'], dose: '10 lents',
      how: 'À quatre pattes, enroule puis creuse le dos vertèbre par vertèbre en respirant.' },
    { id: 'pigeon', name: 'Posture du pigeon', zones: ['hanche', 'genou'], dose: '2 × 45 s par côté',
      how: 'Jambe avant pliée devant toi, jambe arrière tendue : penche le buste au-dessus de la jambe avant.' },
    { id: 'balancier', name: 'Balanciers de jambe', zones: ['ischios', 'hanche'], dose: '10 avant-arrière + 10 latéraux par jambe',
      how: 'En appui sur un mur, balance la jambe de façon souple et progressive.' },
    { id: 'couch_stretch', name: 'Étirement du quadriceps (couch stretch)', zones: ['genou', 'hanche'], dose: '2 × 45 s par côté',
      how: 'Genou au sol contre un mur ou un canapé, pied relevé derrière toi, buste vertical, fessier serré.' },
    { id: 'grenouille', name: 'Grenouille (adducteurs)', zones: ['hanche'], dose: '2 × 40 s',
      how: 'À quatre pattes, écarte les genoux et recule doucement le bassin vers les talons.' },
    { id: 'mollet_mur', name: 'Étirement des mollets au mur', zones: ['achille', 'tibia'], dose: '2 × 30 s par jambe (tendue puis fléchie)',
      how: 'Mains au mur, jambe arrière tendue talon au sol, puis genou fléchi pour le soléaire.' },
    { id: 'ischio_doux', name: 'Étirement doux des ischios', zones: ['ischios'], dose: '2 × 40 s par jambe',
      how: 'Allongé, jambe tendue vers le ciel avec une sangle, sans forcer.' },
    { id: 'balle_pied', name: 'Massage plantaire à la balle', zones: ['pied'], dose: '1 min par pied',
      how: 'Fais rouler une balle sous la voûte plantaire avec une pression modérée.' },
    { id: 'enfant', name: "Posture de l'enfant", zones: ['dos'], dose: '1 min',
      how: 'Assis sur les talons, bras allongés devant, respire lentement dans le dos.' },
    { id: 'rotation_lombaire', name: 'Rotation lombaire allongé', zones: ['dos'], dose: '2 × 30 s par côté',
      how: 'Sur le dos, laisse tomber les genoux pliés d\'un côté, épaules au sol.' },
    { id: 'jambes_mur', name: 'Jambes au mur', zones: [], dose: '3 min',
      how: 'Allongé, jambes reposées à la verticale contre le mur, respiration lente. Idéal après une sortie longue.' },
  ];

  RP.EX_BY_ID = Object.fromEntries(RP.EXERCISES.map((e) => [e.id, e]));
  RP.MOB_BY_ID = Object.fromEntries(RP.MOBILITY.map((e) => [e.id, e]));
})(window.RP);

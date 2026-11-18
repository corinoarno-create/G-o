# Rapport des données Monde

> Généré par `npm run data:world`. Ne pas modifier à la main : corriger `data/sources/overrides-monde.json` puis relancer.

**252 entités** : 193 × état membre de l'onu, 46 × territoire rattaché, 1 × autre, 4 × état à reconnaissance limitée, 5 × région d'outre-mer, 2 × état observateur à l'onu, 1 × territoire au statut disputé.

## Choix à valider

- Frontières : Natural Earth « de facto », sauf la **Crimée** (rattachée à l'Ukraine) et le **Sahara occidental** (territoire entier, y compris la partie administrée par le Maroc), qui suivent les frontières reconnues par l'ONU.
- Zones laissées neutres (grises, jamais demandées) : Bir Tawil, zone tampon de Chypre, bases britanniques de Chypre, glacier de Siachen, champ de glace Sud de Patagonie, île Brésilienne, Spratleys, Paracels, récifs disputés des Caraïbes et de Scarborough, Guantánamo, îles Ashmore-et-Cartier et de la mer de Corail, Clipperton.
- Capitales multiples : la première est celle qu'on place sur la carte ; les autres sont acceptées en saisie (Bolivie, Afrique du Sud, Malaisie, Sri Lanka, Eswatini, Palestine, Montserrat, Géorgie du Sud).
- Guinée équatoriale : la capitale est **Ciudad de la Paz** depuis le décret de janvier 2026 ; Malabo, où le transfert est encore en cours, reste acceptée en saisie.
- Sous-régions de l'ONU (M49), sauf l'**Iran**, rangé en Asie de l'Ouest avec le Moyen-Orient plutôt qu'en Asie du Sud. L'Amérique est un seul continent, découpé en Amérique du Nord, Amérique centrale, Caraïbes et Amérique du Sud.
- Pas de capitale demandée pour : Antarctique, Hong Kong, Macao, Tokelau, île Bouvet, îles Heard-et-MacDonald, îles mineures éloignées des États-Unis.
- Les DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte) sont des entités à part. Les territoires dont le drapeau est celui de leur État (signalés « = fr », « = no »…) seront exclus du mode Drapeaux.

## Points à vérifier

- Aucun.

## Afrique (60)

| Id | Nom | Autres noms | Capitale | Sous-région | Statut | Population | Drapeau |
|---|---|---|---|---|---|---|---|
| za | Afrique du Sud |  | Pretoria (+ Le Cap, Bloemfontein) | Afrique australe | État membre de l'ONU | 64 747 319 (2025, world-bank) | ✓ |
| bw | Botswana |  | Gaborone | Afrique australe | État membre de l'ONU | 2 562 122 (2025, world-bank) | ✓ |
| sz | Eswatini | Swaziland | Mbabane (+ Lobamba) | Afrique australe | État membre de l'ONU | 1 256 174 (2025, world-bank) | ✓ |
| ls | Lesotho |  | Maseru | Afrique australe | État membre de l'ONU | 2 363 325 (2025, world-bank) | ✓ |
| na | Namibie |  | Windhoek | Afrique australe | État membre de l'ONU | 3 092 816 (2025, world-bank) | ✓ |
| ao | Angola |  | Luanda | Afrique centrale | État membre de l'ONU | 39 040 039 (2025, world-bank) | ✓ |
| cm | Cameroun |  | Yaoundé | Afrique centrale | État membre de l'ONU | 29 879 337 (2025, world-bank) | ✓ |
| ga | Gabon |  | Libreville | Afrique centrale | État membre de l'ONU | 2 593 130 (2025, world-bank) | ✓ |
| gq | Guinée équatoriale |  | Ciudad de la Paz (+ Malabo) | Afrique centrale | État membre de l'ONU | 1 938 431 (2025, world-bank) | ✓ |
| cf | République centrafricaine | Centrafrique | Bangui | Afrique centrale | État membre de l'ONU | 5 513 282 (2025, world-bank) | ✓ |
| cd | République démocratique du Congo | RDC, RD Congo, Congo-Kinshasa, Congo (RDC), Congo démocratique | Kinshasa | Afrique centrale | État membre de l'ONU | 112 832 473 (2025, world-bank) | ✓ |
| cg | République du Congo | Congo, Congo-Brazzaville | Brazzaville | Afrique centrale | État membre de l'ONU | 6 484 437 (2025, world-bank) | ✓ |
| st | Sao Tomé-et-Principe | São Tomé-et-Príncipe, Sao Tomé et Principe | São Tomé | Afrique centrale | État membre de l'ONU | 240 254 (2025, world-bank) | ✓ |
| ss | Soudan du Sud |  | Djouba | Afrique centrale | État membre de l'ONU | 12 188 788 (2025, world-bank) | ✓ |
| td | Tchad |  | N'Djaména | Afrique centrale | État membre de l'ONU | 21 003 705 (2025, world-bank) | ✓ |
| bi | Burundi |  | Gitega | Afrique de l'Est | État membre de l'ONU | 14 390 003 (2025, world-bank) | ✓ |
| km | Comores |  | Moroni | Afrique de l'Est | État membre de l'ONU | 882 847 (2025, world-bank) | ✓ |
| dj | Djibouti |  | Djibouti | Afrique de l'Est | État membre de l'ONU | 1 184 076 (2025, world-bank) | ✓ |
| er | Érythrée |  | Asmara | Afrique de l'Est | État membre de l'ONU | 3 607 003 (2025, world-bank) | ✓ |
| et | Éthiopie |  | Addis-Abeba | Afrique de l'Est | État membre de l'ONU | 135 472 051 (2025, world-bank) | ✓ |
| ke | Kenya |  | Nairobi | Afrique de l'Est | État membre de l'ONU | 57 532 493 (2025, world-bank) | ✓ |
| re | La Réunion | Réunion | Saint-Denis | Afrique de l'Est | Région d'outre-mer (fr) | 889 679 (2023, wikidata) | = fr |
| mg | Madagascar |  | Antananarivo | Afrique de l'Est | État membre de l'ONU | 32 740 678 (2025, world-bank) | ✓ |
| mw | Malawi |  | Lilongwe | Afrique de l'Est | État membre de l'ONU | 22 216 120 (2025, world-bank) | ✓ |
| mu | Maurice | Île Maurice | Port-Louis | Afrique de l'Est | État membre de l'ONU | 1 243 741 (2025, world-bank) | ✓ |
| yt | Mayotte |  | Mamoudzou | Afrique de l'Est | Région d'outre-mer (fr) | 320 901 (2024, wikidata) | = fr |
| mz | Mozambique |  | Maputo | Afrique de l'Est | État membre de l'ONU | 35 631 653 (2025, world-bank) | ✓ |
| ug | Ouganda |  | Kampala | Afrique de l'Est | État membre de l'ONU | 51 384 894 (2025, world-bank) | ✓ |
| rw | Rwanda |  | Kigali | Afrique de l'Est | État membre de l'ONU | 14 569 341 (2025, world-bank) | ✓ |
| sc | Seychelles |  | Victoria | Afrique de l'Est | État membre de l'ONU | 122 730 (2025, world-bank) | ✓ |
| so | Somalie |  | Mogadiscio | Afrique de l'Est | État membre de l'ONU | 19 654 739 (2025, world-bank) | ✓ |
| sol | Somaliland |  | Hargeisa | Afrique de l'Est | État à reconnaissance limitée | 6 500 000 (2024, wikidata) | ✓ |
| tz | Tanzanie |  | Dodoma | Afrique de l'Est | État membre de l'ONU | 70 545 865 (2025, world-bank) | ✓ |
| io | Territoire britannique de l'océan Indien | Archipel des Chagos, Chagos | Diego Garcia | Afrique de l'Est | Territoire rattaché (gb) | 3 000 (2018, wikidata) | ✓ |
| zm | Zambie |  | Lusaka | Afrique de l'Est | État membre de l'ONU | 21 913 874 (2025, world-bank) | ✓ |
| zw | Zimbabwe |  | Harare | Afrique de l'Est | État membre de l'ONU | 16 950 795 (2025, world-bank) | ✓ |
| bj | Bénin |  | Porto-Novo | Afrique de l'Ouest | État membre de l'ONU | 14 814 460 (2025, world-bank) | ✓ |
| bf | Burkina Faso |  | Ouagadougou | Afrique de l'Ouest | État membre de l'ONU | 24 074 580 (2025, world-bank) | ✓ |
| cv | Cap-Vert | Îles du Cap-Vert, Cabo Verde | Praia | Afrique de l'Ouest | État membre de l'ONU | 527 326 (2025, world-bank) | ✓ |
| ci | Côte d'Ivoire |  | Yamoussoukro | Afrique de l'Ouest | État membre de l'ONU | 32 711 547 (2025, world-bank) | ✓ |
| gm | Gambie |  | Banjul | Afrique de l'Ouest | État membre de l'ONU | 2 822 093 (2025, world-bank) | ✓ |
| gh | Ghana |  | Accra | Afrique de l'Ouest | État membre de l'ONU | 35 064 272 (2025, world-bank) | ✓ |
| gn | Guinée |  | Conakry | Afrique de l'Ouest | État membre de l'ONU | 15 099 727 (2025, world-bank) | ✓ |
| gw | Guinée-Bissau |  | Bissau | Afrique de l'Ouest | État membre de l'ONU | 2 249 515 (2025, world-bank) | ✓ |
| lr | Liberia |  | Monrovia | Afrique de l'Ouest | État membre de l'ONU | 5 731 206 (2025, world-bank) | ✓ |
| ml | Mali |  | Bamako | Afrique de l'Ouest | État membre de l'ONU | 25 198 821 (2025, world-bank) | ✓ |
| mr | Mauritanie |  | Nouakchott | Afrique de l'Ouest | État membre de l'ONU | 5 315 065 (2025, world-bank) | ✓ |
| ne | Niger |  | Niamey | Afrique de l'Ouest | État membre de l'ONU | 27 917 831 (2025, world-bank) | ✓ |
| ng | Nigeria | Nigéria | Abuja | Afrique de l'Ouest | État membre de l'ONU | 237 527 782 (2025, world-bank) | ✓ |
| sh | Sainte-Hélène | Sainte-Hélène, Ascension et Tristan da Cunha | Jamestown | Afrique de l'Ouest | Territoire rattaché (gb) | 5 633 (2016, wikidata) | ✓ |
| sn | Sénégal |  | Dakar | Afrique de l'Ouest | État membre de l'ONU | 18 931 966 (2025, world-bank) | ✓ |
| sl | Sierra Leone |  | Freetown | Afrique de l'Ouest | État membre de l'ONU | 8 819 794 (2025, world-bank) | ✓ |
| tg | Togo |  | Lomé | Afrique de l'Ouest | État membre de l'ONU | 8 591 626 (2025, world-bank) | ✓ |
| dz | Algérie |  | Alger | Afrique du Nord | État membre de l'ONU | 47 435 312 (2025, world-bank) | ✓ |
| eg | Égypte |  | Le Caire | Afrique du Nord | État membre de l'ONU | 118 365 995 (2025, world-bank) | ✓ |
| ly | Libye |  | Tripoli | Afrique du Nord | État membre de l'ONU | 7 458 555 (2025, world-bank) | ✓ |
| ma | Maroc |  | Rabat | Afrique du Nord | État membre de l'ONU | 38 430 770 (2025, world-bank) | ✓ |
| eh | Sahara occidental |  | Laâyoune | Afrique du Nord | Territoire au statut disputé | 612 000 (2021, wikidata) | ✓ |
| sd | Soudan |  | Khartoum | Afrique du Nord | État membre de l'ONU | 51 662 147 (2025, world-bank) | ✓ |
| tn | Tunisie |  | Tunis | Afrique du Nord | État membre de l'ONU | 12 348 573 (2025, world-bank) | ✓ |

## Amérique (56)

| Id | Nom | Autres noms | Capitale | Sous-région | Statut | Population | Drapeau |
|---|---|---|---|---|---|---|---|
| bz | Belize |  | Belmopan | Amérique centrale | État membre de l'ONU | 422 924 (2025, world-bank) | ✓ |
| cr | Costa Rica |  | San José | Amérique centrale | État membre de l'ONU | 5 152 950 (2025, world-bank) | ✓ |
| gt | Guatemala |  | Guatemala | Amérique centrale | État membre de l'ONU | 18 687 881 (2025, world-bank) | ✓ |
| hn | Honduras |  | Tegucigalpa | Amérique centrale | État membre de l'ONU | 11 005 850 (2025, world-bank) | ✓ |
| ni | Nicaragua |  | Managua | Amérique centrale | État membre de l'ONU | 7 007 502 (2025, world-bank) | ✓ |
| pa | Panama |  | Panama | Amérique centrale | État membre de l'ONU | 4 571 189 (2025, world-bank) | ✓ |
| sv | Salvador |  | San Salvador | Amérique centrale | État membre de l'ONU | 6 365 503 (2025, world-bank) | ✓ |
| bm | Bermudes |  | Hamilton | Amérique du Nord | Territoire rattaché (gb) | 64 555 (2025, world-bank) | ✓ |
| ca | Canada |  | Ottawa | Amérique du Nord | État membre de l'ONU | 41 651 653 (2025, world-bank) | ✓ |
| us | États-Unis | États-Unis d'Amérique, USA | Washington | Amérique du Nord | État membre de l'ONU | 341 784 857 (2025, world-bank) | ✓ |
| gl | Groenland |  | Nuuk | Amérique du Nord | Territoire rattaché (dk) | 56 831 (2025, world-bank) | ✓ |
| um | Îles mineures éloignées des États-Unis |  | — | Amérique du Nord | Territoire rattaché (us) | 190 (2010, wikidata) | = us |
| mx | Mexique |  | Mexico | Amérique du Nord | État membre de l'ONU | 131 946 900 (2025, world-bank) | ✓ |
| pm | Saint-Pierre-et-Miquelon |  | Saint-Pierre | Amérique du Nord | Territoire rattaché (fr) | 5 974 (2019, wikidata) | = fr |
| ar | Argentine |  | Buenos Aires | Amérique du Sud | État membre de l'ONU | 45 851 378 (2025, world-bank) | ✓ |
| bo | Bolivie |  | Sucre (+ La Paz) | Amérique du Sud | État membre de l'ONU | 12 581 843 (2025, world-bank) | ✓ |
| br | Brésil |  | Brasilia | Amérique du Sud | État membre de l'ONU | 212 812 405 (2025, world-bank) | ✓ |
| cl | Chili |  | Santiago | Amérique du Sud | État membre de l'ONU | 19 859 921 (2025, world-bank) | ✓ |
| co | Colombie |  | Bogota | Amérique du Sud | État membre de l'ONU | 53 425 635 (2025, world-bank) | ✓ |
| ec | Équateur |  | Quito | Amérique du Sud | État membre de l'ONU | 18 289 896 (2025, world-bank) | ✓ |
| gy | Guyana |  | Georgetown | Amérique du Sud | État membre de l'ONU | 835 986 (2025, world-bank) | ✓ |
| gf | Guyane | Guyane française | Cayenne | Amérique du Sud | Région d'outre-mer (fr) | 293 996 (2023, wikidata) | = fr |
| fk | Îles Malouines | Malouines, Îles Falkland, Falkland | Port Stanley | Amérique du Sud | Territoire rattaché (gb) | 3 662 (2021, wikidata) | ✓ |
| py | Paraguay |  | Asunción | Amérique du Sud | État membre de l'ONU | 7 013 078 (2025, world-bank) | ✓ |
| pe | Pérou |  | Lima | Amérique du Sud | État membre de l'ONU | 34 576 665 (2025, world-bank) | ✓ |
| sr | Suriname | Surinam | Paramaribo | Amérique du Sud | État membre de l'ONU | 639 850 (2025, world-bank) | ✓ |
| uy | Uruguay |  | Montevideo | Amérique du Sud | État membre de l'ONU | 3 384 688 (2025, world-bank) | ✓ |
| ve | Venezuela |  | Caracas | Amérique du Sud | État membre de l'ONU | 28 516 896 (2025, world-bank) | ✓ |
| ai | Anguilla |  | The Valley | Caraïbes | Territoire rattaché (gb) | 16 293 (2025, wikidata) | ✓ |
| ag | Antigua-et-Barbuda | Antigua, Antigua et Barbuda | Saint John's | Caraïbes | État membre de l'ONU | 94 209 (2025, world-bank) | ✓ |
| aw | Aruba |  | Oranjestad | Caraïbes | Territoire rattaché (nl) | 108 785 (2025, world-bank) | ✓ |
| bs | Bahamas |  | Nassau | Caraïbes | État membre de l'ONU | 403 033 (2025, world-bank) | ✓ |
| bb | Barbade |  | Bridgetown | Caraïbes | État membre de l'ONU | 282 623 (2025, world-bank) | ✓ |
| cu | Cuba |  | La Havane | Caraïbes | État membre de l'ONU | 10 937 203 (2025, world-bank) | ✓ |
| cw | Curaçao |  | Willemstad | Caraïbes | Territoire rattaché (nl) | 156 263 (2025, world-bank) | ✓ |
| dm | Dominique |  | Roseau | Caraïbes | État membre de l'ONU | 65 871 (2025, world-bank) | ✓ |
| gd | Grenade |  | Saint-Georges | Caraïbes | État membre de l'ONU | 117 303 (2025, world-bank) | ✓ |
| gp | Guadeloupe |  | Basse-Terre | Caraïbes | Région d'outre-mer (fr) | 384 160 (2023, wikidata) | = fr |
| ht | Haïti |  | Port-au-Prince | Caraïbes | État membre de l'ONU | 11 906 095 (2025, world-bank) | ✓ |
| ky | Îles Caïmans |  | George Town | Caraïbes | Territoire rattaché (gb) | 75 844 (2025, world-bank) | ✓ |
| tc | Îles Turques-et-Caïques |  | Cockburn Town | Caraïbes | Territoire rattaché (gb) | 46 855 (2025, world-bank) | ✓ |
| vg | Îles Vierges britanniques |  | Road Town | Caraïbes | Territoire rattaché (gb) | 39 732 (2025, world-bank) | ✓ |
| vi | Îles Vierges des États-Unis |  | Charlotte-Amélie | Caraïbes | Territoire rattaché (us) | 103 792 (2025, world-bank) | ✓ |
| jm | Jamaïque |  | Kingston | Caraïbes | État membre de l'ONU | 2 837 077 (2025, world-bank) | ✓ |
| mq | Martinique |  | Fort-de-France | Caraïbes | Région d'outre-mer (fr) | 360 630 (2023, wikidata) | ✓ |
| ms | Montserrat |  | Brades (+ Plymouth) | Caraïbes | Territoire rattaché (gb) | 5 440 (2023, wikidata) | ✓ |
| bq | Pays-Bas caribéens | Bonaire, Saint-Eustache et Saba, Bonaire | Kralendijk | Caraïbes | Territoire rattaché (nl) | 29 418 (2023, wikidata) | ✓ |
| pr | Porto Rico |  | San Juan | Caraïbes | Territoire rattaché (us) | 3 184 835 (2025, world-bank) | ✓ |
| do | République dominicaine |  | Saint-Domingue | Caraïbes | État membre de l'ONU | 11 520 487 (2025, world-bank) | ✓ |
| bl | Saint-Barthélemy |  | Gustavia | Caraïbes | Territoire rattaché (fr) | 10 124 (2018, wikidata) | = fr |
| kn | Saint-Christophe-et-Niévès |  | Basseterre | Caraïbes | État membre de l'ONU | 46 922 (2025, world-bank) | ✓ |
| mf | Saint-Martin | Saint-Martin (partie française) | Marigot | Caraïbes | Territoire rattaché (fr) | 24 941 (2025, world-bank) | = fr |
| vc | Saint-Vincent-et-les-Grenadines |  | Kingstown | Caraïbes | État membre de l'ONU | 99 924 (2025, world-bank) | ✓ |
| lc | Sainte-Lucie |  | Castries | Caraïbes | État membre de l'ONU | 180 149 (2025, world-bank) | ✓ |
| sx | Sint Maarten | Saint-Martin (partie néerlandaise) | Philipsburg | Caraïbes | Territoire rattaché (nl) | 43 923 (2025, world-bank) | ✓ |
| tt | Trinité-et-Tobago |  | Port-d'Espagne | Caraïbes | État membre de l'ONU | 1 367 764 (2025, world-bank) | ✓ |

## Antarctique (5)

| Id | Nom | Autres noms | Capitale | Sous-région | Statut | Population | Drapeau |
|---|---|---|---|---|---|---|---|
| aq | Antarctique |  | — | Antarctique | Autre | — | ✓ |
| gs | Géorgie du Sud-et-les Îles Sandwich du Sud | Géorgie du Sud | King Edward Point (+ Grytviken) | Antarctique | Territoire rattaché (gb) | 35 (2019, wikidata) | ✓ |
| bv | Île Bouvet |  | — | Antarctique | Territoire rattaché (no) | 0 (2025, manual) | = no |
| hm | Îles Heard-et-MacDonald |  | — | Antarctique | Territoire rattaché (au) | 0 (2025, manual) | = au |
| tf | Terres australes et antarctiques françaises | TAAF, Terres australes françaises | Port-aux-Français | Antarctique | Territoire rattaché (fr) | 196 (2012, wikidata) | ✓ |

## Asie (50)

| Id | Nom | Autres noms | Capitale | Sous-région | Statut | Population | Drapeau |
|---|---|---|---|---|---|---|---|
| kz | Kazakhstan |  | Astana | Asie centrale | État membre de l'ONU | 20 843 754 (2025, world-bank) | ✓ |
| kg | Kirghizistan | Kirghizstan | Bichkek | Asie centrale | État membre de l'ONU | 7 343 064 (2025, world-bank) | ✓ |
| uz | Ouzbékistan |  | Tachkent | Asie centrale | État membre de l'ONU | 37 053 428 (2025, world-bank) | ✓ |
| tj | Tadjikistan |  | Douchanbé | Asie centrale | État membre de l'ONU | 10 786 734 (2025, world-bank) | ✓ |
| tm | Turkménistan |  | Achgabat | Asie centrale | État membre de l'ONU | 7 618 847 (2025, world-bank) | ✓ |
| cn | Chine |  | Pékin | Asie de l'Est | État membre de l'ONU | 1 406 585 000 (2025, world-bank) | ✓ |
| kp | Corée du Nord |  | Pyongyang | Asie de l'Est | État membre de l'ONU | 26 571 036 (2025, world-bank) | ✓ |
| kr | Corée du Sud |  | Séoul | Asie de l'Est | État membre de l'ONU | 51 684 564 (2025, world-bank) | ✓ |
| hk | Hong Kong | Hongkong | — | Asie de l'Est | Territoire rattaché (cn) | 7 498 900 (2025, world-bank) | ✓ |
| jp | Japon |  | Tokyo | Asie de l'Est | État membre de l'ONU | 123 366 734 (2025, world-bank) | ✓ |
| mo | Macao | Macau | — | Asie de l'Est | Territoire rattaché (cn) | 685 900 (2025, world-bank) | ✓ |
| mn | Mongolie |  | Oulan-Bator | Asie de l'Est | État membre de l'ONU | 3 568 978 (2025, world-bank) | ✓ |
| tw | Taïwan |  | Taipei | Asie de l'Est | État à reconnaissance limitée | 23 262 544 (2026, wikidata) | ✓ |
| sa | Arabie saoudite |  | Riyad | Asie de l'Ouest | État membre de l'ONU | 36 973 555 (2025, world-bank) | ✓ |
| am | Arménie |  | Erevan | Asie de l'Ouest | État membre de l'ONU | 3 086 700 (2025, world-bank) | ✓ |
| az | Azerbaïdjan |  | Bakou | Asie de l'Ouest | État membre de l'ONU | 10 246 996 (2025, world-bank) | ✓ |
| bh | Bahreïn |  | Manama | Asie de l'Ouest | État membre de l'ONU | 1 600 366 (2025, world-bank) | ✓ |
| ae | Émirats arabes unis | Émirats, EAU | Abou Dabi | Asie de l'Ouest | État membre de l'ONU | 11 513 149 (2025, world-bank) | ✓ |
| ge | Géorgie |  | Tbilissi | Asie de l'Ouest | État membre de l'ONU | 3 935 766 (2025, world-bank) | ✓ |
| iq | Irak |  | Bagdad | Asie de l'Ouest | État membre de l'ONU | 47 020 774 (2025, world-bank) | ✓ |
| ir | Iran |  | Téhéran | Asie de l'Ouest | État membre de l'ONU | 92 417 681 (2025, world-bank) | ✓ |
| il | Israël |  | Jérusalem | Asie de l'Ouest | État membre de l'ONU | 10 122 800 (2025, world-bank) | ✓ |
| jo | Jordanie |  | Amman | Asie de l'Ouest | État membre de l'ONU | 11 520 684 (2025, world-bank) | ✓ |
| kw | Koweït |  | Koweït | Asie de l'Ouest | État membre de l'ONU | 4 865 298 (2025, world-bank) | ✓ |
| lb | Liban |  | Beyrouth | Asie de l'Ouest | État membre de l'ONU | 5 849 421 (2025, world-bank) | ✓ |
| om | Oman |  | Mascate | Asie de l'Ouest | État membre de l'ONU | 5 494 691 (2025, world-bank) | ✓ |
| ps | Palestine | État de Palestine | Ramallah (+ Jérusalem-Est) | Asie de l'Ouest | État observateur à l'ONU | 5 413 596 (2025, world-bank) | ✓ |
| qa | Qatar |  | Doha | Asie de l'Ouest | État membre de l'ONU | 2 972 215 (2025, world-bank) | ✓ |
| sy | Syrie |  | Damas | Asie de l'Ouest | État membre de l'ONU | 25 620 427 (2025, world-bank) | ✓ |
| tr | Turquie | Türkiye | Ankara | Asie de l'Ouest | État membre de l'ONU | 85 878 556 (2025, world-bank) | ✓ |
| ye | Yémen |  | Sanaa | Asie de l'Ouest | État membre de l'ONU | 41 773 878 (2025, world-bank) | ✓ |
| af | Afghanistan |  | Kaboul | Asie du Sud | État membre de l'ONU | 43 844 111 (2025, world-bank) | ✓ |
| bd | Bangladesh |  | Dacca | Asie du Sud | État membre de l'ONU | 175 686 899 (2025, world-bank) | ✓ |
| bt | Bhoutan |  | Thimphou | Asie du Sud | État membre de l'ONU | 796 682 (2025, world-bank) | ✓ |
| in | Inde |  | New Delhi | Asie du Sud | État membre de l'ONU | 1 463 865 525 (2025, world-bank) | ✓ |
| mv | Maldives |  | Malé | Asie du Sud | État membre de l'ONU | 529 676 (2025, world-bank) | ✓ |
| np | Népal |  | Katmandou | Asie du Sud | État membre de l'ONU | 29 618 118 (2025, world-bank) | ✓ |
| pk | Pakistan |  | Islamabad | Asie du Sud | État membre de l'ONU | 255 219 554 (2025, world-bank) | ✓ |
| lk | Sri Lanka |  | Sri Jayawardenapura Kotte (+ Colombo) | Asie du Sud | État membre de l'ONU | 21 756 000 (2025, world-bank) | ✓ |
| mm | Birmanie | Myanmar | Naypyidaw | Asie du Sud-Est | État membre de l'ONU | 54 850 648 (2025, world-bank) | ✓ |
| bn | Brunei |  | Bandar Seri Begawan | Asie du Sud-Est | État membre de l'ONU | 466 330 (2025, world-bank) | ✓ |
| kh | Cambodge |  | Phnom Penh | Asie du Sud-Est | État membre de l'ONU | 17 847 982 (2025, world-bank) | ✓ |
| id | Indonésie |  | Jakarta | Asie du Sud-Est | État membre de l'ONU | 285 721 236 (2025, world-bank) | ✓ |
| la | Laos |  | Vientiane | Asie du Sud-Est | État membre de l'ONU | 7 873 046 (2025, world-bank) | ✓ |
| my | Malaisie |  | Kuala Lumpur (+ Putrajaya) | Asie du Sud-Est | État membre de l'ONU | 35 977 838 (2025, world-bank) | ✓ |
| ph | Philippines |  | Manille | Asie du Sud-Est | État membre de l'ONU | 116 786 962 (2025, world-bank) | ✓ |
| sg | Singapour |  | Singapour | Asie du Sud-Est | État membre de l'ONU | 6 111 175 (2025, world-bank) | ✓ |
| th | Thaïlande |  | Bangkok | Asie du Sud-Est | État membre de l'ONU | 71 619 863 (2025, world-bank) | ✓ |
| tl | Timor oriental | Timor-Leste, Timor | Dili | Asie du Sud-Est | État membre de l'ONU | 1 418 517 (2025, world-bank) | ✓ |
| vn | Viêt Nam | Vietnam | Hanoï | Asie du Sud-Est | État membre de l'ONU | 101 598 527 (2025, world-bank) | ✓ |

## Europe (54)

| Id | Nom | Autres noms | Capitale | Sous-région | Statut | Population | Drapeau |
|---|---|---|---|---|---|---|---|
| at | Autriche |  | Vienne | Europe centrale | État membre de l'ONU | 9 208 163 (2025, world-bank) | ✓ |
| hu | Hongrie |  | Budapest | Europe centrale | État membre de l'ONU | 9 514 251 (2025, world-bank) | ✓ |
| pl | Pologne |  | Varsovie | Europe centrale | État membre de l'ONU | 36 435 861 (2025, world-bank) | ✓ |
| sk | Slovaquie |  | Bratislava | Europe centrale | État membre de l'ONU | 5 413 813 (2025, world-bank) | ✓ |
| si | Slovénie |  | Ljubljana | Europe centrale | État membre de l'ONU | 2 130 986 (2025, world-bank) | ✓ |
| cz | Tchéquie | République tchèque | Prague | Europe centrale | État membre de l'ONU | 10 886 878 (2025, world-bank) | ✓ |
| by | Biélorussie | Bélarus | Minsk | Europe de l'Est | État membre de l'ONU | 9 085 991 (2025, world-bank) | ✓ |
| md | Moldavie |  | Chișinău | Europe de l'Est | État membre de l'ONU | 2 360 527 (2025, world-bank) | ✓ |
| ru | Russie |  | Moscou | Europe de l'Est | État membre de l'ONU | 143 513 328 (2025, world-bank) | ✓ |
| ua | Ukraine |  | Kiev | Europe de l'Est | État membre de l'ONU | 38 980 376 (2025, world-bank) | ✓ |
| de | Allemagne |  | Berlin | Europe de l'Ouest | État membre de l'ONU | 83 491 249 (2025, world-bank) | ✓ |
| be | Belgique |  | Bruxelles | Europe de l'Ouest | État membre de l'ONU | 11 941 781 (2025, world-bank) | ✓ |
| fr | France |  | Paris | Europe de l'Ouest | État membre de l'ONU | 68 720 337 (2025, world-bank) | ✓ |
| li | Liechtenstein |  | Vaduz | Europe de l'Ouest | État membre de l'ONU | 41 024 (2025, world-bank) | ✓ |
| lu | Luxembourg |  | Luxembourg | Europe de l'Ouest | État membre de l'ONU | 686 970 (2025, world-bank) | ✓ |
| mc | Monaco |  | Monaco | Europe de l'Ouest | État membre de l'ONU | 38 341 (2025, world-bank) | ✓ |
| nl | Pays-Bas | Hollande | Amsterdam | Europe de l'Ouest | État membre de l'ONU | 18 087 633 (2025, world-bank) | ✓ |
| ch | Suisse |  | Berne | Europe de l'Ouest | État membre de l'ONU | 9 092 436 (2025, world-bank) | ✓ |
| ax | Åland | Îles Åland, Ahvenanmaa | Mariehamn | Europe du Nord | Territoire rattaché (fi) | 30 836 (2025, wikidata) | ✓ |
| dk | Danemark |  | Copenhague | Europe du Nord | État membre de l'ONU | 6 009 169 (2025, world-bank) | ✓ |
| ee | Estonie |  | Tallinn | Europe du Nord | État membre de l'ONU | 1 366 475 (2025, world-bank) | ✓ |
| fi | Finlande |  | Helsinki | Europe du Nord | État membre de l'ONU | 5 646 436 (2025, world-bank) | ✓ |
| gg | Guernesey |  | Saint-Pierre-Port | Europe du Nord | Territoire rattaché (gb) | 67 787 (2024, wikidata) | ✓ |
| im | Île de Man |  | Douglas | Europe du Nord | Territoire rattaché (gb) | 84 118 (2025, world-bank) | ✓ |
| fo | Îles Féroé |  | Tórshavn | Europe du Nord | Territoire rattaché (dk) | 54 900 (2025, world-bank) | ✓ |
| ie | Irlande |  | Dublin | Europe du Nord | État membre de l'ONU | 5 484 367 (2025, world-bank) | ✓ |
| is | Islande |  | Reykjavik | Europe du Nord | État membre de l'ONU | 392 404 (2025, world-bank) | ✓ |
| je | Jersey |  | Saint-Hélier | Europe du Nord | Territoire rattaché (gb) | 103 267 (2021, wikidata) | ✓ |
| lv | Lettonie |  | Riga | Europe du Nord | État membre de l'ONU | 1 847 785 (2025, world-bank) | ✓ |
| lt | Lituanie |  | Vilnius | Europe du Nord | État membre de l'ONU | 2 888 774 (2025, world-bank) | ✓ |
| no | Norvège |  | Oslo | Europe du Nord | État membre de l'ONU | 5 610 870 (2025, world-bank) | ✓ |
| gb | Royaume-Uni | Grande-Bretagne | Londres | Europe du Nord | État membre de l'ONU | 69 487 000 (2025, world-bank) | ✓ |
| se | Suède |  | Stockholm | Europe du Nord | État membre de l'ONU | 10 596 620 (2025, world-bank) | ✓ |
| sj | Svalbard et Jan Mayen |  | Longyearbyen | Europe du Nord | Territoire rattaché (no) | 2 905 (2022, wikidata) | = no |
| ad | Andorre |  | Andorre-la-Vieille | Europe du Sud | État membre de l'ONU | 82 904 (2025, world-bank) | ✓ |
| cy | Chypre |  | Nicosie | Europe du Sud | État membre de l'ONU | 1 370 754 (2025, world-bank) | ✓ |
| cyn | Chypre du Nord | République turque de Chypre du Nord, RTCN | Nicosie-Nord | Europe du Sud | État à reconnaissance limitée | 489 308 (2024, wikidata) | ✓ |
| es | Espagne |  | Madrid | Europe du Sud | État membre de l'ONU | 49 355 143 (2025, world-bank) | ✓ |
| gi | Gibraltar |  | Gibraltar | Europe du Sud | Territoire rattaché (gb) | 40 126 (2025, world-bank) | ✓ |
| gr | Grèce |  | Athènes | Europe du Sud | État membre de l'ONU | 10 413 962 (2025, world-bank) | ✓ |
| it | Italie |  | Rome | Europe du Sud | État membre de l'ONU | 58 915 656 (2025, world-bank) | ✓ |
| mt | Malte |  | La Valette | Europe du Sud | État membre de l'ONU | 579 704 (2025, world-bank) | ✓ |
| pt | Portugal |  | Lisbonne | Europe du Sud | État membre de l'ONU | 10 804 871 (2025, world-bank) | ✓ |
| sm | Saint-Marin |  | Saint-Marin | Europe du Sud | État membre de l'ONU | 34 109 (2025, world-bank) | ✓ |
| va | Vatican | Cité du Vatican, Saint-Siège | Vatican | Europe du Sud | État observateur à l'ONU | 949 (2024, wikidata) | ✓ |
| al | Albanie |  | Tirana | Europe du Sud-Est | État membre de l'ONU | 2 349 580 (2025, world-bank) | ✓ |
| ba | Bosnie-Herzégovine | Bosnie | Sarajevo | Europe du Sud-Est | État membre de l'ONU | 3 140 095 (2025, world-bank) | ✓ |
| bg | Bulgarie |  | Sofia | Europe du Sud-Est | État membre de l'ONU | 6 433 302 (2025, world-bank) | ✓ |
| hr | Croatie |  | Zagreb | Europe du Sud-Est | État membre de l'ONU | 3 876 200 (2025, world-bank) | ✓ |
| xk | Kosovo |  | Pristina | Europe du Sud-Est | État à reconnaissance limitée | 1 576 876 (2025, world-bank) | ✓ |
| mk | Macédoine du Nord | Macédoine | Skopje | Europe du Sud-Est | État membre de l'ONU | 1 820 909 (2025, world-bank) | ✓ |
| me | Monténégro |  | Podgorica | Europe du Sud-Est | État membre de l'ONU | 623 129 (2025, world-bank) | ✓ |
| ro | Roumanie |  | Bucarest | Europe du Sud-Est | État membre de l'ONU | 19 020 271 (2025, world-bank) | ✓ |
| rs | Serbie |  | Belgrade | Europe du Sud-Est | État membre de l'ONU | 6 549 143 (2025, world-bank) | ✓ |

## Océanie (27)

| Id | Nom | Autres noms | Capitale | Sous-région | Statut | Population | Drapeau |
|---|---|---|---|---|---|---|---|
| au | Australie |  | Canberra | Australie et Nouvelle-Zélande | État membre de l'ONU | 27 614 411 (2025, world-bank) | ✓ |
| cx | Île Christmas |  | Flying Fish Cove | Australie et Nouvelle-Zélande | Territoire rattaché (au) | 1 692 (2021, wikidata) | ✓ |
| nf | Île Norfolk |  | Kingston | Australie et Nouvelle-Zélande | Territoire rattaché (au) | 2 188 (2021, wikidata) | ✓ |
| cc | Îles Cocos |  | West Island | Australie et Nouvelle-Zélande | Territoire rattaché (au) | 602 (2021, wikidata) | ✓ |
| nz | Nouvelle-Zélande |  | Wellington | Australie et Nouvelle-Zélande | État membre de l'ONU | 5 324 700 (2025, world-bank) | ✓ |
| fj | Fidji |  | Suva | Mélanésie | État membre de l'ONU | 933 154 (2025, world-bank) | ✓ |
| sb | Îles Salomon | Salomon | Honiara | Mélanésie | État membre de l'ONU | 838 645 (2025, world-bank) | ✓ |
| nc | Nouvelle-Calédonie |  | Nouméa | Mélanésie | Territoire rattaché (fr) | 295 333 (2025, world-bank) | ✓ |
| pg | Papouasie-Nouvelle-Guinée |  | Port Moresby | Mélanésie | État membre de l'ONU | 10 762 817 (2025, world-bank) | ✓ |
| vu | Vanuatu |  | Port-Vila | Mélanésie | État membre de l'ONU | 335 169 (2025, world-bank) | ✓ |
| gu | Guam |  | Hagåtña | Micronésie | Territoire rattaché (us) | 168 999 (2025, world-bank) | ✓ |
| mp | Îles Mariannes du Nord |  | Saïpan | Micronésie | Territoire rattaché (us) | 43 541 (2025, world-bank) | ✓ |
| mh | Îles Marshall |  | Majuro | Micronésie | État membre de l'ONU | 36 282 (2025, world-bank) | ✓ |
| ki | Kiribati |  | Tarawa-Sud | Micronésie | État membre de l'ONU | 136 488 (2025, world-bank) | ✓ |
| fm | Micronésie | États fédérés de Micronésie | Palikir | Micronésie | État membre de l'ONU | 113 683 (2025, world-bank) | ✓ |
| nr | Nauru |  | Yaren | Micronésie | État membre de l'ONU | 12 025 (2025, world-bank) | ✓ |
| pw | Palaos | Palau | Ngerulmud | Micronésie | État membre de l'ONU | 17 663 (2025, world-bank) | ✓ |
| ck | Îles Cook |  | Avarua | Polynésie | Territoire rattaché (nz) | 14 222 (2023, wikidata) | ✓ |
| pn | Îles Pitcairn |  | Adamstown | Polynésie | Territoire rattaché (gb) | 47 (2021, wikidata) | ✓ |
| nu | Niue |  | Alofi | Polynésie | Territoire rattaché (nz) | 1 821 (2025, wikidata) | ✓ |
| pf | Polynésie française | Polynésie | Papeete | Polynésie | Territoire rattaché (fr) | 282 465 (2025, world-bank) | ✓ |
| ws | Samoa |  | Apia | Polynésie | État membre de l'ONU | 219 306 (2025, world-bank) | ✓ |
| as | Samoa américaines |  | Pago Pago | Polynésie | Territoire rattaché (us) | 46 029 (2025, world-bank) | ✓ |
| tk | Tokelau |  | — | Polynésie | Territoire rattaché (nz) | 1 499 (2016, wikidata) | ✓ |
| to | Tonga |  | Nukuʻalofa | Polynésie | État membre de l'ONU | 103 742 (2025, world-bank) | ✓ |
| tv | Tuvalu |  | Funafuti | Polynésie | État membre de l'ONU | 9 492 (2025, world-bank) | ✓ |
| wf | Wallis-et-Futuna |  | Mata Utu | Polynésie | Territoire rattaché (fr) | 11 558 (2018, wikidata) | = fr |

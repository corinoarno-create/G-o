# Créer le projet Firebase (une seule fois, ~5 minutes)

La synchronisation entre appareils passe par Firebase (Google), formule gratuite « Spark », sans carte bancaire.
Ces étapes se font avec ton compte Google, dans la console : https://console.firebase.google.com

## 1. Le projet
1. **Créer un projet** → nom : `geo` (ou ce que tu veux).
2. Google Analytics : **désactivé** (inutile ici).
3. Attendre la fin de la création, puis **Continuer**.

## 2. L'application web
1. Menu de gauche : **Paramètres → Paramètres du projet**, onglet **Général**. En bas, section **Vos applications** :
   clique sur l'icône **`</>`** (« Web »), ou sur **Ajouter une application** puis **Web**.
   (La page d'accueil du projet, avec les suggestions de Gemini, ne propose plus ce bouton.)
2. Surnom : `Géo`. **Ne coche pas** « Firebase Hosting » (l'app reste sur GitHub Pages).
3. **Enregistrer l'application** : un bloc `const firebaseConfig = { apiKey: …, authDomain: …, projectId: … }` s'affiche.
4. **Copie ce bloc et envoie-le moi dans le chat.** Il n'est pas secret (il dit seulement à quel projet parler) :
   je le mets dans `src/sync/firebase-config.ts`.

## 3. La connexion Google
1. Menu de gauche : **Créer → Authentication → Commencer**.
2. Onglet **Méthode de connexion** → **Google** → **Activer**.
3. « Adresse e-mail d'assistance » : ton adresse → **Enregistrer**.
4. Onglet **Paramètres** → **Domaines autorisés** → **Ajouter un domaine** : `corinoarno-create.github.io`
   (`localhost` y est déjà, pour les essais).

## 4. La base de données
1. Menu de gauche : **Créer → Firestore Database → Créer une base de données**.
2. Édition **Standard**, emplacement : **`europe-west9` (Paris)** (ou un autre en Europe ; on ne peut plus le changer ensuite).
3. Mode : **production**.
4. Une fois créée, onglet **Règles** : remplace tout par le contenu du fichier [`firestore.rules`](../firestore.rules), puis **Publier**.

C'est tout. Ensuite, dans l'app : pied de l'accueil → **Se connecter avec Google**, sur le PC puis sur le téléphone.

## Bon à savoir
- **Gratuit** : 50 000 lectures et 20 000 écritures par jour. Une synchronisation en coûte une vingtaine : à deux joueurs, on en est très loin.
- **Tes données** sont chez Google, visibles seulement par ton compte (les règles ci-dessus y veillent).
- **Hors ligne**, l'app marche comme avant ; tout part au retour du réseau.
- L'**export JSON** reste là, comme sauvegarde.

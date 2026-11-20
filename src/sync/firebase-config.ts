// Identifiants du projet Firebase de l'app (console Firebase → Paramètres du projet → Vos applications).
// Ils ne sont pas secrets : ils disent seulement à quel projet parler. Ce qui protège les données,
// ce sont les règles de sécurité (firestore.rules) : chacun ne lit et n'écrit que sa progression.
// Tant qu'ils valent null, la synchronisation est simplement absente de l'app.
import type { FirebaseOptions } from 'firebase/app';

export const FIREBASE_CONFIG: FirebaseOptions | null = {
  apiKey: 'AIzaSyASQBgLr7_TYIvuG9vMMekuEN981-_XcLk',
  authDomain: 'geography-7915c.firebaseapp.com',
  projectId: 'geography-7915c',
  storageBucket: 'geography-7915c.firebasestorage.app',
  messagingSenderId: '159973715581',
  appId: '1:159973715581:web:21788b0cbb752c56a6cb14',
};

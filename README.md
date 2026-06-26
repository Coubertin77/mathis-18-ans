# 🎂 Mathis 18 ans — Qui le connaît le mieux ?

Appli de bracket : Mathis joue ses vraies préférences, les invités devinent.  
**+1 pt** par bon duel · **+10 pts** bonus si le favori final est trouvé.

**Technos : Firebase** (données + photos, gratuit) · **GitHub Desktop** (publication) · **GitHub Pages** (site sur téléphone)

---

## Pourquoi Firebase + GitHub Desktop ?

GitHub Pages héberge uniquement des fichiers statiques (HTML/JS). Il faut donc un service externe pour stocker les scores et les photos en temps réel.

| Service | Multi-joueurs sur téléphone | Gratuit | Avec GitHub Pages |
|---------|----------------------------|---------|-------------------|
| **Firebase** ✅ | Oui | Oui (anniversaire) | Oui |
| Supabase | Oui | Oui | Oui |
| Rien (localStorage) | Non (1 seul téléphone) | — | Oui |

**Firebase** est la solution la plus simple si Supabase n'est pas disponible.

---

## 1. Créer le projet Firebase (15 min)

1. Allez sur [console.firebase.google.com](https://console.firebase.google.com) avec un compte **Google**.
2. **Créer un projet** → nom : `mathis-18-ans`.
3. **Firestore Database** → Créer → mode **test**.
4. ~~Storage~~ **Pas besoin de Storage** — les photos sont dans le dossier `images/` (gratuit, via GitHub).
5. **Paramètres** (engrenage) → **Vos applications** → icône Web `</>` :
   - Nom : `mathis-18`
   - Copiez la configuration.

6. Collez dans `js/firebase-config.js` :

```javascript
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

7. Changez les mots de passe dans le même fichier :

```javascript
export const ADMIN_PASSWORD = "votre-mot-de-passe";
export const MATHIS_CODE = "MATHIS18";
```

### Photos gratuites (sans payer Firebase Storage)

1. Copiez vos photos dans :
   - `images/musiques/`
   - `images/sports/`
   - `images/voyages/`
2. **GitHub Desktop** → Commit → Push (pour les mettre en ligne).
3. Dans l'admin, pour chaque choix, indiquez le chemin, ex. :  
   `images/musiques/stromae.jpg`

Les images sont hébergées sur **GitHub Pages** avec le site — **0 €**.

---

## 2. Publier avec GitHub Desktop

### Première fois

1. Téléchargez [GitHub Desktop](https://desktop.github.com/).
2. **File** → **Add local repository** → dossier `App mathis 18 ans`.
3. Si besoin : **create a repository** (nom : `mathis-18-ans`).
4. Message de commit → **Commit to main** → **Publish repository** (Public).

### Activer GitHub Pages

1. Sur [github.com](https://github.com), ouvrez le dépôt.
2. **Settings** → **Pages**.
3. Source : branche **main**, dossier **/ (root)** → **Save**.
4. Votre site : `https://VOTRE-PSEUDO.github.io/mathis-18-ans/`

Partagez ce lien aux invités le soir J.

### Mettre à jour

GitHub Desktop → cochez les fichiers → **Commit** → **Push origin**.

---

## Déroulé de la soirée

1. **Admin** : 16 choix + photos par catégorie (🎵 Musiques, ⚽ Sports, ✈️ Voyages).
2. **Admin** : lancer la partie.
3. **Mathis** : code `MATHIS18` · **Invités** : prénom seulement.
4. Chacun joue sur son téléphone ; les tours suivants se débloquent quand Mathis finit le tour précédent.
5. **Classement** à la fin.

---

## Structure

```
App mathis 18 ans/
├── index.html
├── css/style.css
├── js/
│   ├── app.js
│   ├── bracket.js
│   ├── firebase.js
│   └── firebase-config.js   ← ⚠️ À configurer
├── firestore.rules
└── README.md
```

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Boutons grisés | Remplir `firebase-config.js` |
| « Aucune partie en cours » | Admin → Lancer la catégorie |
| Photos invisibles | Vérifier le chemin (`images/musiques/photo.jpg`) + Push GitHub Desktop |
| Page 404 | GitHub → Settings → Pages |

Bon anniversaire Mathis ! 🎉🎂

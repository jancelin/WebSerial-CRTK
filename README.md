# Centipede-RTK Web Serial

Outil web minimaliste pour **configurer des récepteurs GNSS** (ex. Unicore **UM980/UM982**) et des modules **Bluetooth Feasycom** (ex. **FSC-BT836B**) via **Web Serial API** (navigateur Chrome/Edge/Chromium).
Deux interfaces au choix :

* **Débutant** : sélection guidée d’une **configuration prête à l’emploi**
* **Avancé** : chargement et envoi d’un **fichier .cfg** (multi-commandes) depuis `conf_files/advanced` ou un fichier local.

> ℹ️ Le site démo GitHub Pages nécessite **HTTPS** (Web Serial) ; en **local** `http://localhost` est autorisé.

---

## Sommaire

* [Prérequis](#prérequis)
* [Arborescence du projet](#arborescence-du-projet)
* [Démarrage rapide (local)](#démarrage-rapide-local)
* [Interface Débutant : mode guidé](#interface-débutant--mode-guidé)
* [Interface Avancé : mode manuel](#interface-avancé--mode-manuel)
* [Format des fichiers .cfg](#format-des-fichiers-cfg)
* [Manifest débutant (avec emoji)](#manifest-débutant-avec-emoji)
* [Bonnes pratiques & dépannage](#bonnes-pratiques--dépannage)
* [Crédits](#crédits)
* [Licence](#licence)

---

## Prérequis

* **Navigateur** : Chrome / Edge / Chromium récent (Web Serial).
* **Connexion** :

  * **HTTPS** obligatoire sur le web (GitHub Pages, domaine perso avec TLS).
  * **Local** accepté via `http://localhost` (développement/test).
* **Câble/port série** : l’interface série du module GNSS/BT doit être accessible (USB CDC / convertisseur USB-UART).
* **Droits OS** : autoriser l’accès au port série lors de la demande du navigateur.

---

## Arborescence du projet

```
.
├── index.html                  # Interface Débutant
├── index_advanced.html         # Interface Avancé
├── conf_files/
│   ├── user/                   # Configs guidées (débutant)
│   │   ├── manifest.json       # Libellés + emoji -> fichiers .cfg
│   │   ├── NavX_GNSS_Openfield.cfg
│   │   ├── NavX_GNSS_Mixed.cfg
│   │   ├── NavX_GNSS_Town.cfg
│   │   └── NavX_bluetooth.cfg
│   └── advanced/               # Configs contributives (avancé)
│       ├── NavX_GNSS_Openfield.cfg
│       ├── NavX_GNSS_Mixed.cfg
│       ├── NavX_GNSS_Town.cfg
│       └── NavX_bluetooth.cfg
└── static/
    ├── css/
    │   ├── styles.css
    │   └── index-styles.css
    ├── js/
    │   ├── script.js                 # logique partagée
    │   ├── index-script.js           # logique page Débutant
    │   └── index-advanced-script.js  # logique page Avancé
    └── logo.png
```

* `conf_files/user` : piloté par **manifest.json** (libellés + emoji) pour les débutants.
* `conf_files/advanced` : **noms de fichiers** affichés tels quels (contributions communautaires facilitées).

---

## Démarrage rapide (local)

```bash
# à la racine du projet
python3 -m http.server 8001
# ouvrir http://localhost:8001
```

* Page **Débutant** : `index.html`
* Page **Avancé** : `index_advanced.html`
* Le **switch** en haut-droite bascule entre les deux interfaces.

---

## Interface Débutant : mode guidé

1. **Connecter**

   * Cliquer **🔌 Connecter** → choisir le **port série** du module (ex. USB-Serial).
   * La **Vitesse de transmission** (baud) par défaut est `115200`.

2. **Choisir une configuration**

   * Menu **Configurations** → sélectionner une entrée lisible **avec emoji** (ex. `🌲_📍 ROVER • NavX Openfield`).
   * Un panneau affiche la **description** extraite de l’en-tête du `.cfg`.

3. **Paramètres avancés (⚙️)**

   * **Fin de ligne = CRLF** (par défaut) — requis par de nombreux firmwares GNSS.
   * **Délai entre commandes** (s) — laisser `5` si incertitude.

4. **Téléverser**

   * Cliquer **📤 Téléverser**.
   * Une barre de progression s’affiche ; la console montre :

     * `→ [i/n] COMMANDE` côté envoi,
     * `← RX: ...` pour les retours (ex. `OK*xx`, messages du firmware).

5. **Déconnexion**

   * **⏏️ Déconnecter** à la fin (ou fermer l’onglet).

> Si vous obtenez des `PARISING FAILED` / `NO MATCHING FUNC`, vérifiez la **fin de ligne** (CRLF) et la **vitesse** (baud).

---

## Interface Avancé : mode manuel

1. **Connecter** → choisir le port série.
2. **Fin de ligne** : **CRLF** conseillé (`\r\n`).
3. **Charger** un **fichier .cfg** depuis `conf_files/advanced`, via **Browse…** (fichier local) ou écrire/editer directement les commandes dans la zone de texte.
4. **Envoyer (multi-lignes)** : envoie toutes les lignes (vides et commentaires `#`, `//`, `;` ignorés).
5. La console affiche le détail :

   ```
   → [4/26] MODE ROVER SURVEY
   $command,MODE ROVER SURVEY,response: OK*1F
   ```
6. **SAVECONFIG** : disponible en bouton dédié si le firmware le permet.

---

## Format des fichiers .cfg

* **Commentaires** : lignes commençant par `#`, `//`, `;` **ignorées** à l’envoi.
* **En-têtes facultatifs** (affichage Débutant) :

  ```text
  # title: Configuration du GNSS de NavX (GNSS UM980)
  # content: Phrase courte 1.
  # content: Phrase courte 2.
  ```
* **Commandes** : une par ligne (sans suffixe de fin — la page gère l’ajout de `CRLF`).
* Extrait (Openfield) :

  ```text
  FRESET
  VERSIONA
  CONFIG ANTENNA POWERON
  MODE ROVER SURVEY
  CONFIG NMEAVERSION V411
  CONFIG AGNSS DISABLE
  CONFIG SBAS DISABLE
  ...
  SAVECONFIG
  ```

---

## Manifest débutant (avec emoji)

`conf_files/user/manifest.json` :

```json
{
  "version": 1,
  "items": [
    { "file": "NavX_GNSS_Openfield.cfg", "label": "🌲_📍 ROVER • NavX Openfield" },
    { "file": "NavX_GNSS_Mixed.cfg",     "label": "🌳_📍 ROVER • NavX Mixed" },
    { "file": "NavX_GNSS_Town.cfg",      "label": "🏙️_📍 ROVER • NavX Town" },
    { "file": "NavX_bluetooth.cfg",      "label": "🔵 Bluetooth • NavX (BT836B)" }
  ]
}
```

> Vous pouvez **ajouter/retirer** des entrées librement. Les fichiers référencés doivent exister dans `conf_files/user/`.

---

## Bonnes pratiques & dépannage

* **Fin de ligne (EOL)** :

  * La majorité des firmwares GNSS requièrent **CRLF** (`\r\n`).
  * En *Débutant* et *Avancé*, assurez-vous que **CRLF** est sélectionné dans ⚙️.

* **Vitesse série (baud)** : 115200 par défaut. Si les réponses semblent corrompues, essayez 57600 / 230400 / 460800 (selon firmware).

* **Temps entre commandes** : 5 s par défaut — utile après les commandes qui **redémarrent** ou réinitialisent le module (`FRESET`, `GNSSRESET`, etc.).

* **Droits & pilotes** : sous Linux, appartenance au groupe `dialout` / `uucp` ; sous Windows, pilote USB-UART adapté (FTDI/CP210x/CH34x).

* **HTTPS** : sur le web, **obligatoire** pour accéder au port série (sauf `localhost`).

  * GitHub Pages → activer **Enforce HTTPS**.
  * Domaine perso → certif TLS (Let’s Encrypt, etc.).

* **Contributions** :

  * Ajoutez vos configs dans `conf_files/advanced` (noms explicites).
  * Pour l’interface Débutant, exposez-les via `conf_files/user/manifest.json` (labels + emoji).

---

## Crédits

* **Projet** : Centipede-RTK – [https://centipede-rtk.org](https://centipede-rtk.org) (réseau collaboratif GNSS, données ouvertes, résilience numérique).
* **Matériels cités** :

  * Récepteurs GNSS **Unicore** (UM980/UM982),
  * Modules **Feasycom** (FSC-BT836B),
  * Antennes & accessoires selon vos installations.
* **Technologies** : **Web Serial API** (Chromium), HTML/CSS/JS.
* **Aide rédactionnelle & outillage IA** : assistance **GPT-5 Thinking (OpenAI)** pour la structuration du code et de la documentation. *L’éditeur du dépôt reste seul responsable du contenu.*
* **Contributeurs** : merci à la **communauté Centipede-RTK** pour les tests, retours et fichiers de configuration.

---

## Licence

* **Code** : **GNU Affero General Public License v3.0 (AGPL-3.0)**.

  * Voir le fichier `LICENSE` (AGPL-3.0).
  * Toute utilisation en service réseau (SaaS) impose la mise à disposition du **code source modifié** conformément à l’AGPL.

* **Fichiers de configuration** : sauf mention contraire, inclus dans la même licence que le dépôt.

  * Marque / nom de produits cités restent la propriété de leurs détenteurs respectifs.

---

### Avertissement

L’envoi de commandes **modifie** la configuration du récepteur GNSS / module Bluetooth.
Vérifiez systématiquement vos paramètres (EOL, baud, protocole, RTCM/NMEA) et **testez** en environnement contrôlé avant usage opérationnel.

---

#  Myo's Panel v1.2

> Interface web LAN pour gérer, superviser et déployer plusieurs bots Discord Node.js via PM2.

![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)
![React](https://img.shields.io/badge/React-18-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Raspberry%20Pi-lightgrey)

---

##  Présentation

**Myo's Panel** est une interface web moderne conçue pour fonctionner sur un réseau local (LAN). Elle permet d'administrer plusieurs bots Discord hébergés sur un même serveur Linux (Raspberry Pi, VPS ou machine dédiée).

L'objectif est de centraliser la gestion, la surveillance et le déploiement des bots dans une interface unique, simple et sécurisée.

---

##  Fonctionnalités

###  Dashboard temps réel

* Utilisation CPU
* Utilisation RAM
* Espace disque
* Température système
* Statut des bots
* Flux de logs en direct via Socket.IO

###  Gestion multi-bots

* Démarrage
* Arrêt
* Redémarrage
* Gestion via PM2

###  Import sécurisé

* Upload de projets ZIP
* Analyse automatique avant installation
* Détection des fichiers sensibles
* Validation de structure

###  Scan automatique des commandes

* Commandes Slash (`/`)
* Commandes préfixées (`!`, `?`, etc.)
* Génération automatique des informations

###  Sauvegardes & restauration

* Création d'archives ZIP
* Restauration en un clic
* Historique des sauvegardes

###  Logs centralisés

* Filtrage par bot
* Filtrage par niveau
* Filtrage par source
* Export TXT

###  Gestion du stockage

* Analyse détaillée par bot
* Taille des dossiers
* Répartition de l'espace disque

###  Serveurs Discord

* Liste des guildes
* Statistiques
* Graphiques interactifs

###  Gestion des utilisateurs

Trois niveaux d'accès :

| Rôle          | Description             |
| ------------- | ----------------------- |
| Admin         | Accès complet           |
| Modérateur    | Gestion limitée         |
| Lecture seule | Consultation uniquement |

Permissions entièrement configurables.

###  Interface personnalisable

* Mode sombre
* Mode clair
* Fond d'écran personnalisable

###  Configuration initiale

Lors du premier démarrage :

* Création du compte administrateur
* Initialisation automatique de la base de données
* Configuration sécurisée

---

##  Stack Technique

| Backend     | Frontend       | Base de données |
| ----------- | -------------- | --------------- |
| Node.js 20+ | React 18       | SQLite          |
| Express 4   | Vite 6         | better-sqlite3  |
| Socket.IO 4 | Tailwind CSS 3 | WAL Mode        |
| PM2 5       | Recharts       |                 |
| JWT         | Axios          |                 |
| bcryptjs    |                |                 |

---

##  Installation rapide

### Raspberry Pi / Linux

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

Le script installe automatiquement :

* Node.js
* Dépendances système
* PM2
* Service systemd
* Configuration du pare-feu

---

##  Première connexion

Une fois l'installation terminée :

```text
http://IP_DU_SERVEUR:3000
```

Créez ensuite votre compte administrateur.

---

##  Installation manuelle

### Prérequis

```bash
sudo apt install -y curl git build-essential python3

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

sudo apt install -y nodejs

sudo npm install -g pm2
```

### Installation du projet

```bash
cp env.example .env
```

 Modifiez impérativement la variable :

```env
JWT_SECRET=VotreSecretUltraSecurise
```

Puis :

```bash
npm install
npm run build
node apps/api/src/server.js
```

---

##  Développement

```bash
cp env.example .env
npm install
npm run dev
```

Services disponibles :

| Service  | URL                   |
| -------- | --------------------- |
| Frontend | http://localhost:5173 |
| API      | http://localhost:3000 |

---

## ⚙️ Configuration

### Variables d'environnement

| Variable       | Valeur par défaut | Description                 |
| -------------- | ----------------- | --------------------------- |
| PORT           | 3000              | Port du serveur             |
| LAN_ONLY       | true              | Restriction au réseau local |
| JWT_SECRET     | —                 | Clé secrète JWT             |
| MAX_UPLOAD_MB  | 250               | Taille maximale des ZIP     |
| PM2_MAX_MEMORY | 350M              | Mémoire maximale par bot    |

---

## 🔌 API

### Authentification

| Méthode | Route             |
| ------- | ----------------- |
| POST    | `/api/auth/login` |

### Bots

| Méthode | Route                           |
| ------- | ------------------------------- |
| GET     | `/api/bots`                     |
| POST    | `/api/bots/:id/actions/:action` |

Actions disponibles :

```text
start
stop
restart
```

### Import

| Méthode | Route                 |
| ------- | --------------------- |
| POST    | `/api/imports/upload` |

### Système

| Méthode | Route                 |
| ------- | --------------------- |
| GET     | `/api/system/metrics` |
| GET     | `/api/storage`        |

### Logs

| Méthode | Route       |
| ------- | ----------- |
| GET     | `/api/logs` |

### Guildes Discord

| Méthode | Route                |
| ------- | -------------------- |
| PUT     | `/api/guilds/:botId` |

---

##  Sécurité

* Authentification JWT
* Hashage des mots de passe avec bcryptjs
* Analyse des ZIP avant installation
* Permissions par rôle
* Restriction réseau local (LAN)
* Validation des uploads

---

##  Licence

Distribué sous licence **MIT**.

Copyright © 2026
**Myo's Development**

---

##  Liens

* Discord : https://discord.gg/ZKP8VjxCfC
* GitHub : https://github.com/7Myo

---

<p align="center">
  Made with by Myo's Development
</p>


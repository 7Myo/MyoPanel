# Myo's Panel v1.2

> Panel web LAN pour gérer plusieurs bots Discord Node.js avec PM2.

**Myo's Panel** est une interface web conçue pour fonctionner sur le réseau local (LAN). Elle permet de gérer, superviser et déployer plusieurs bots Discord Node.js hébergés sur un même serveur (Raspberry Pi, VPS, serveur Linux).

---

## Fonctionnalités

- **Dashboard temps réel** — CPU, RAM, disque, température, statut des bots, logs (Socket.IO)
- **Gestion multi-bots** — Démarrage, arrêt, redémarrage via PM2
- **Import ZIP sécurisé** — Upload de projets bots avec analyse automatique avant installation
- **Scan de commandes** — Détection automatique des commandes slash et préfixées
- **Sauvegardes & restauration** — Archives ZIP avec restauration一键
- **Logs centralisés** — Filtrage par bot, niveau, source, export TXT
- **Stockage** — Analyse détaillée de l'utilisation disque par bot
- **Serveurs Discord** — Visualisation des guildes avec graphiques
- **Gestion des utilisateurs** — 3 rôles (admin, modérateur, lecture seule) avec permissions configurables
- **Mode sombre/clair** — Fond d'écran personnalisable
- **Configuration initiale** — Écran de création du compte admin au premier démarrage

---

## Stack technique

| Backend | Frontend | Base de données |
|---|---|---|
| Node.js 20+, Express 4 | React 18, Vite 6 | SQLite (better-sqlite3) |
| Socket.IO 4, PM2 5 | Tailwind CSS 3, Recharts | WAL mode |
| JWT + bcryptjs | Axios | |

---

## Démarrage rapide (Raspberry Pi / Linux)

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

Le script installe tout automatiquement (Node.js, dépendances, PM2, service systemd, firewall).

**Première connexion :** `http://IP_DU_SERVEUR:3000` — crée ton compte admin.

---

## Installation manuelle

```bash
# Prérequis
sudo apt install -y curl git build-essential python3
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Installation
cp env.example .env
# Modifie JWT_SECRET dans .env !
npm install
npm run build
node apps/api/src/server.js
```

---

## Développement

```bash
cp env.example .env
npm install
npm run dev
```

Frontend : `http://localhost:5173` — API : `http://localhost:3000`

---

## Configuration (.env)

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | 3000 | Port du serveur |
| `LAN_ONLY` | true | Restreindre au réseau local |
| `JWT_SECRET` | — | Clé secrète JWT (⚠️ à changer absolument) |
| `MAX_UPLOAD_MB` | 250 | Taille max d'upload ZIP |
| `PM2_MAX_MEMORY` | 350M | Mémoire max par bot |

---

## API - Endpoints principaux

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Connexion |
| GET | `/api/bots` | Liste des bots |
| POST | `/api/bots/:id/actions/:action` | start / stop / restart |
| POST | `/api/imports/upload` | Upload ZIP |
| GET | `/api/system/metrics` | Métriques système |
| GET | `/api/logs` | Logs (avec filtres) |
| GET | `/api/storage` | Analyse stockage |
| PUT | `/api/guilds/:botId` | Report guildes (auth bot token) |

---

## Licence

MIT — Créé par © 2026 Myo's Development.

---

<p align="center">
  <a href="https://discord.gg/ZKP8VjxCfC">Discord</a> •
  <a href="https://github.com/7Myo">GitHub</a>
</p>

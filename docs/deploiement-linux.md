# Deploiement Linux sans nom de domaine

Ce guide installe Myo's Panel sur un serveur Linux ou Raspberry Pi OS accessible uniquement sur le reseau local.

## 1. Prerequis

```bash
sudo apt update
sudo apt install -y curl git nginx ufw build-essential python3
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Verifier :

```bash
node -v
npm -v
pm2 -v
```

## 2. Installation du panel

```bash
sudo mkdir -p /opt/myos-panel
sudo chown -R $USER:$USER /opt/myos-panel
cd /opt/myos-panel
# Copier ou cloner le projet ici
cp .env.example .env
npm install
npm run build
```

Modifier `.env` :

```env
HOST=0.0.0.0
PORT=3000
PUBLIC_BASE_URL=http://192.168.1.XXX:3000
LAN_ONLY=true
JWT_SECRET=une-valeur-longue-et-aleatoire
ADMIN_EMAIL=admin@local
ADMIN_PASSWORD=un-mot-de-passe-fort
DATA_DIR=/opt/myos-panel/runtime
BOTS_DIR=/opt/myos-panel/runtime/bots
BACKUPS_DIR=/opt/myos-panel/runtime/backups
LOGS_DIR=/opt/myos-panel/runtime/logs
TEMP_DIR=/opt/myos-panel/runtime/tmp
```

Remplacer `192.168.1.XXX` par l'IP locale du serveur :

```bash
hostname -I
```

## 3. Service systemd

Trouver le chemin de node :

```bash
which node
```

Creer `/etc/systemd/system/myos-panel.service` en remplacant `/usr/bin/node` par le chemin obtenu :

```ini
[Unit]
Description=Myo's Panel LAN
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/myos-panel
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin:/bin
ExecStart=/usr/bin/node apps/api/src/server.js
Restart=always
RestartSec=5
User=ton-utilisateur
Group=ton-utilisateur
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Adapter `User` et `Group`, puis :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now myos-panel
sudo systemctl status myos-panel
```

## 4. Acces LAN direct

Depuis un PC, telephone ou tablette du meme reseau :

```text
http://192.168.1.XXX:3000
```

Le serveur ecoute sur `0.0.0.0`, donc il accepte les connexions LAN, pas seulement `localhost`.

## 5. Nginx optionnel sur le port 80

Creer `/etc/nginx/sites-available/myos-panel` :

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 300M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Activer :

```bash
sudo ln -s /etc/nginx/sites-available/myos-panel /etc/nginx/sites-enabled/myos-panel
sudo nginx -t
sudo systemctl reload nginx
```

Acces :

```text
http://192.168.1.XXX
```

## 6. Firewall LAN

Autoriser uniquement le LAN. Exemple pour un reseau local :

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.0.0/24 to any port 80 proto tcp
sudo ufw allow from 192.168.0.0/24 to any port 3000 proto tcp
sudo ufw enable
sudo ufw status
```

Ne pas configurer de redirection de port sur la box Internet si le panel doit rester prive.

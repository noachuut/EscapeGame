# 🕵️‍♂️ Cyber Detective – Escape Game

Bienvenue dans **Cyber Detective**, un escape game web full-stack immersif pensé pour les lycéens ! 👩‍💻🧑‍💻

## 🚀 Qu’est-ce que c’est ?

Un jeu d’investigation numérique où chaque équipe doit :
- 📜 **Déchiffrer** un message avec le Code César  
- 🎣 **Identifier** un email de phishing  
- 🔒 **Classer** des mots de passe du plus faible au plus robuste  
- 🔍 **Réaliser** une enquête OSINT pour découvrir une date de naissance  

Le tout contre la montre : 10 minutes pour sauver Thomas !

## 🛠️ Stack Technique

- **Frontend** : HTML5, CSS3 (Flexbox, animations, dégradés coniques), JavaScript ES6  
- **Backend** : Node.js + Express  
- **BDD** : PostgreSQL conteneurisé avec Docker Compose  
- **Persistance** : table `scores` (nom d’équipe & durée de la partie)  

## 🎯 Objectifs Pédagogiques

- Sensibiliser à la cryptographie et à la cybersécurité  
- Comprendre les bonnes pratiques de sécurité des mots de passe  
- Découvrir les techniques de phishing et d’OSINT  
- Mettre en œuvre un workflow full-stack (Client → API → BDD)  

## 🚀 Déploiement local pas-à-pas

Suivez ces étapes pour lancer l’ensemble du jeu **Cyber Detective** en local, front + back + BDD PostgreSQL (Docker).

## 1. Cloner le dépôt

```bash
git clone https://github.com/noachuut/EscapeGame.git
cd EscapeGame
```

## 2. Lancer la BDD PostgreSQL avec Docker

#### Placer vous dans le dossier frontend
```bash
cd frontend
```
#### Configurez et Démarrer Postgres en arrière-plan
```
docker-compose up -d db
```
#### Vérifiez que le container tourne
```bash
docker ps
```
## 3. Déployer l’API Back-end (Node.js + Express)

#### Placez-vous dans le dossier backend/ :

```bash
cd backend
```
#### Installez les dépendances :
```bash
npm install
```
#### Configurez vos variables d’environnement (pas besoin pour l'instant):
```bash
cp .env.example .env
```
Ajustez PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, PORT

#### Démarrez le serveur :

```bash
npm start
```
## 4. Lancer le Front-end

#### Serveur statique indépendant
```bash
cd frontend
npx serve .
# → http://localhost:5000/index.html
```

---
## 🎮 Usage

1. **Accueil** (`index.html`)  
   - Saisissez un nom d’équipe **unique**  
2. **Jeu** (`game.html`)  
   - Résolvez **4 activités** avant la fin du timer  
3. **Fin**  
   - Mot de passe correct + choix du suspect → enregistrement du score  
4. **Classement** (`scores.html`)  
   - Affichage automatique du **Top 10** des meilleurs temps  

---




## 🔗 API

| Méthode | Route                | Description                                                |
| ------- | -------------------- | ---------------------------------------------------------- |
| GET     | `/api/health`        | Vérifie que le serveur est en ligne                        |
| GET     | `/api/check-team`    | Vérifie si un nom d’équipe existe (`?team=…`)              |
| POST    | `/api/save-score`    | Enregistre un score `{ team, duration }` et renvoie `{ badge }` |
| GET     | `/api/scores`        | Récupère le Top 10 `{ team_name, duration_seconds, created_at, badge }` |
| DELETE  | `/api/scores`        | Vide la table `scores` (usage administrative)              |

---

## 💾 Base de données

- **PostgreSQL** conteneurisé via `docker-compose.yml`  
- **Table** `scores` (schéma) :  
  ```sql
  id SERIAL PRIMARY KEY,
  team_name VARCHAR(100) NOT NULL UNIQUE,
  duration_seconds INTEGER NOT NULL,
  badge VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()

Si vous avez démarré la base de données avant l'ajout de la colonne `badge`,
ajoutez-la manuellement avec :

```sql
ALTER TABLE scores ADD COLUMN badge VARCHAR(20);
```
ou recréez le conteneur PostgreSQL (`docker-compose down -v` puis `docker-compose up -d db`).


Prêt à relever le défi ? Branchez-vous, formez votre équipe et que l’enquête commence ! 🔐🎉  

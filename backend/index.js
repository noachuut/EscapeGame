// index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'EscapeGame API Documentation', version: '1.0.0' },
    tags:[
      {name: 'Activité' , description: "Mini-jeu de l'escape game"},
      {name: 'Scores' , description: 'Classement et Scores'},
      {name: 'Equipes' , description: ''}
    ]
  },
  apis: [path.join(__dirname, '*.js')],
  globOptions: { ignore: ['**/node_modules/**'] }
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// ---- TIMER ENDPOINTS ----

// Démarre (ou redémarre) un compte à rebours pour une équipe
/**
 * @openapi
 * /api/timer/start:
 *   post:
 *     tags: [Activité]
 *     summary: Démarre un compte à rebours pour une équipe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team, duration]
 *             properties:
 *               team: { type: string }
 *               duration: { type: number, description: "Durée en secondes" }
 *               reset: { type: boolean, description: "Force le redémarrage", default: false }
 *     responses:
 *       200: { description: Timer démarré }
 *       400: { description: Données invalides }
 *       409: { description: Déjà en cours et reset=false }
 */
app.post('/api/timer/start', async (req, res) => {
  const { team, duration, reset = false } = req.body || {};
  if (!team || typeof duration !== 'number' || duration <= 0) {
    return res.status(400).json({ error: 'Données invalides' });
  }
  try {
    const now = new Date();
    const endsAt = new Date(now.getTime() + duration * 1000);

    const existing = await pool.query(
      'SELECT team_name, started_at, ends_at, finished_at FROM game_sessions WHERE team_name = $1',
      [team]
    );

    if (existing.rowCount > 0 && !reset && !existing.rows[0].finished_at) {
      // Timer déjà en cours
      return res.status(409).json({ error: 'Un timer existe déjà pour cette équipe (utilise reset=true pour redémarrer)' });
    }

    await pool.query(
      `INSERT INTO game_sessions (team_name, started_at, ends_at, finished_at)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT (team_name)
       DO UPDATE SET started_at = EXCLUDED.started_at, ends_at = EXCLUDED.ends_at, finished_at = NULL`,
      [team, now.toISOString(), endsAt.toISOString()]
    );

    res.json({ team, startedAt: now.toISOString(), endsAt: endsAt.toISOString() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupère l'état du timer d'une équipe (pour reprendre après refresh)
/**
 * @openapi
 * /api/timer/{team}:
 *   get:
 *     tags: [Activité]
 *     summary: État du timer pour une équipe
 *     parameters:
 *       - in: path
 *         name: team
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: État courant
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 team: { type: string }
 *                 now: { type: string, format: date-time }
 *                 startedAt: { type: string, format: date-time }
 *                 endsAt: { type: string, format: date-time }
 *                 remainingSeconds: { type: number }
 *                 isOver: { type: boolean }
 *       404: { description: Pas de timer pour cette équipe }
 */
app.get('/api/timer/:team', async (req, res) => {
  const team = req.params.team;
  try {
    const { rows } = await pool.query(
      'SELECT started_at, ends_at, finished_at FROM game_sessions WHERE team_name = $1',
      [team]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Aucun timer pour cette équipe' });

    const now = new Date();
    const endsAt = new Date(rows[0].ends_at);
    const remaining = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));
    res.json({
      team,
      now: now.toISOString(),
      startedAt: new Date(rows[0].started_at).toISOString(),
      endsAt: endsAt.toISOString(),
      remainingSeconds: remaining,
      isOver: remaining === 0 || !!rows[0].finished_at
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// (Optionnel) Réinitialise/supprime le timer d'une équipe
/**
 * @openapi
 * /api/timer/reset:
 *   post:
 *     tags: [Activité]
 *     summary: Réinitialise le timer d'une équipe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team]
 *             properties:
 *               team: { type: string }
 *     responses:
 *       204: { description: Reset fait }
 */
app.post('/api/timer/reset', async (req, res) => {
  const { team } = req.body || {};
  if (!team) return res.status(400).json({ error: 'team requis' });
  try {
    await pool.query('DELETE FROM game_sessions WHERE team_name = $1', [team]);
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// endpoint pour verifier si le nom d'equipe existe déja ou pas 
/**
 * @openapi
 * /api/check-team:
 *   
 *   get:
 *     tags:  [Equipes]
 *     summary: Vérifie si un nom d'équipe existe déjà
 *     parameters:
 *       - in: query
 *         name: team
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Indique si l'équipe existe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *       400:
 *         description: Requête invalide (paramètre manquant)
 */
app.get('/api/check-team', async (req, res) => {
  const team = req.query.team;
  if (!team) return res.status(400).end();
  const { rows } = await pool.query(
    'SELECT 1 FROM scores WHERE team_name = $1',
    [team]
  );
  res.json({ exists: rows.length > 0 });
});


/**
 * @openapi
 * /api/scores:
 *   get:
 *     tags : [Scores]
 *     summary: Récupère le Top 10 des scores
 *     responses:
 *       200:
 *         description: Liste des scores
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   team_name: { type: string }
 *                   duration_seconds: { type: integer }
 *                   created_at: { type: string, format: date-time }
 *                   badge: { type: string, enum: [or, argent, bronze, ""] }
 *       500:
 *         description: Erreur serveur
 */
app.get('/api/scores', async (req,res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        team_name,
        duration_seconds,
        created_at,  -- TIMESTAMPTZ brut (parseable)
        to_char(created_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD')  AS created_date,
        to_char(created_at AT TIME ZONE 'Europe/Paris', 'HH24:MI')     AS created_time,
        badge
      FROM scores
      ORDER BY duration_seconds ASC, created_at ASC
      LIMIT 16
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error : "Erreur serveur"});
  }
});


// --- Nouveaux endpoints de validation des activités ---

// 1. Code César
app.post('/api/activity1', (req, res) => {
  const { shift, answer, encrypted } = req.body;

  // Vérification des paramètres reçus
  if (typeof shift !== 'number' || !answer || !encrypted) {
    return res.status(400).json({ success: false });
  }

  // Déchiffre le message reçu avec le décalage proposé
  const decoded = [...encrypted].map(c => {
    if (!/[A-Z]/.test(c)) return c; // Ne touche pas aux espaces ni caractères spéciaux
    return String.fromCharCode((c.charCodeAt(0) - 65 - shift + 26) % 26 + 65);
  }).join('');

  // Phrase attendue
  const expected = "IL EST UN HOMME";

  // Premier mot du message déchiffré
  const first = decoded.split(' ')[0].toUpperCase();

  // Validation
  if (decoded === expected && first === 'IL' && answer.trim().toUpperCase() === 'IL') {
    return res.json({ success: true, portion: 'HOMME' });
  }

  // Mauvaise réponse
  res.json({ success: false });
});

// 2. Phishing
app.post('/api/activity2', (req, res) => {
  const { selected } = req.body;
  
  // Accepter les deux formats : nombre (ancien) et string (nouveau)
  if (typeof selected !== 'string' && typeof selected !== 'number') {
    return res.status(400).json({ success: false });
  }
  
  // Vérifier si l'email sélectionné est le phishing
  if (selected === 'paypal_phishing' || selected === 1) {
    return res.json({ success: true, portion: 'Paypal' });
  }
  
  // Sinon, mauvaise réponse
  res.json({ success: false });
});

// 3. Sécurité des mots de passe
app.post('/api/activity3', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ success: false });
  }
  const correct = [1, 4, 2, 3, 5];
  if (JSON.stringify(order.map(Number)) === JSON.stringify(correct)) {
    return res.json({ success: true, portion: 'Secure' });
  }
  res.json({ success: false });
});

// 4. OSINT
// Exemple backend Express pour activité 4 (OSINT)
app.post('/api/activity4', (req, res) => {
    const { compte, followers, ville } = req.body;

    // 🔹 Valeurs attendues (tu peux les changer)
    const COMPTE_ATTENDU = "@ku81177";
    const FOLLOWERS_ATTENDU = 2;
    const VILLE_ATTENDUE = "lotis";

    // Vérif des infos reçues
    if (
        compte.toLowerCase() === COMPTE_ATTENDU &&
        parseInt(followers, 10) === FOLLOWERS_ATTENDU &&
        ville.toLowerCase() === VILLE_ATTENDUE.toLowerCase()
    ) {
        res.json({
            success: true,
            portion: "LOTIS" // portion du mot de passe
        });
    } else {
        res.json({ success: false });
    }
});



// Endpoint pour sauver un score
/**
 * @openapi
 * /api/save-score:
 *   post:
 *     tags: [Scores]
 *     summary: Enregistre un score (si le nom d’équipe est libre)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team, duration]
 *             properties:
 *               team: { type: string }
 *               duration: { type: number, description: "Durée en secondes" }
 *     responses:
 *       201:
 *         description: Score créé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 badge:
 *                   type: string
 *                   enum: [or, argent, bronze, ""]
 *       409:
 *         description: Nom d’équipe déjà utilisé
 *       400:
 *         description: Données invalides
 *       500:
 *         description: Erreur serveur
 */
app.post('/api/save-score', async (req, res) => {
  const { team, duration } = req.body;
  if (!team || typeof duration !== 'number') {
    return res.status(400).json({ error: 'Données invalides' });
  }

  let badge = '';
    if (duration < 600)      badge = 'or';
    else if (duration < 1200) badge = 'argent';
    else if (duration < 1800) badge = 'bronze';

  try {
    // 1) Vérifier si l'équipe existe déjà
    const { rows } = await pool.query(
      'SELECT 1 FROM scores WHERE team_name = $1',
      [team]
    );
    if (rows.length > 0) {
      // Conflit : nom déjà pris
      return res.status(409).json({ error: 'Nom d’équipe déjà utilisé' });
    }

    // 2) Sinon, insérer
    await pool.query(
      'INSERT INTO scores (team_name, duration_seconds, badge) VALUES ($1, $2, $3)',
      [team, duration, badge]
    );
    res.status(201).json({ badge });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Validation finale et enregistrement du score

/**
 * @openapi
 * /api/verify-final:
 *   post:
 *     tags: [Activité]
 *     summary: Vérifie la combinaison finale et enregistre le score
 *     description: Compare le mot de passe final et le suspect avec les résultats des activités.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team, password, suspect, answers]
 *             properties:
 *               team:
 *                 type: string
 *                 description: Nom de l'équipe
 *               password:
 *                 type: string
 *                 description: Mot de passe final (concaténation des portions)
 *               suspect:
 *                 type: integer
 *                 description: Identifiant du suspect sélectionné (1..4)
 *                 minimum: 1
 *                 maximum: 4
 *               answers:
 *                 type: object
 *                 description: Réponses partielles des activités
 *                 properties:
 *                   caesar:
 *                     type: string
 *                   phishing:
 *                     type: string
 *                   strongestPassword:
 *                     type: string
 *                   osint:
 *                     type: string
 *     responses:
 *       201:
 *         description: Succès, score enregistré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 badge:
 *                   type: string
 *                   enum: [or, argent, bronze, ""]
 *       409:
 *         description: Conflit (nom d'équipe déjà utilisé ou temps écoulé)
 *       400:
 *         description: Données invalides
 *       500:
 *         description: Erreur serveur
 */

app.post('/api/verify-final', async (req, res) => {
  const { team, password, answers, suspect } = req.body;

  // ⛳ Suspect attendu (1..4) — change la valeur selon ton scénario
  const EXPECTED_SUSPECT_ID = 1;

  if (!team || !password || !answers || typeof suspect !== 'number') {
    return res.status(400).json({ error: 'Données invalides' });
  }
  if (suspect < 1 || suspect > 4) {
    return res.status(400).json({ error: 'Suspect invalide' });
  }

  // Concat attendue depuis les 4 activités
  const expected =
    String(answers.caesar || '') +
    String(answers.phishing || '') +
    String(answers.strongestPassword || '') +
    String(answers.osint || '');

  // ❌ Mauvais mot de passe OU mauvais suspect → échec
  if (password !== expected || suspect !== EXPECTED_SUSPECT_ID) {
    return res.json({ success: false });
  }

  try {
    // Récupère la session (timer)
    const sess = await pool.query(
      'SELECT started_at, finished_at, ends_at FROM game_sessions WHERE team_name = $1',
      [team]
    );
    if (sess.rowCount === 0) {
      return res.status(400).json({ error: "Pas de timer démarré pour cette équipe" });
    }
    if (sess.rows[0].finished_at) {
      return res.status(409).json({ error: "Cette équipe a déjà validé la combinaison" });
    }

    // (Optionnel) Refuser si temps écoulé
    const now = new Date();
    if (sess.rows[0].ends_at && new Date(sess.rows[0].ends_at) < now) {
      return res.status(409).json({ error: "Temps écoulé" });
    }

    // Durée réelle côté serveur
    const startedAt = new Date(sess.rows[0].started_at);
    const durationSec = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));

    // Barème badge
    let badge = '';
    if (durationSec < 120)      badge = 'or';
    else if (durationSec < 300) badge = 'argent';
    else if (durationSec < 480) badge = 'bronze';

    // Nom d’équipe unique
    const { rows } = await pool.query(
      'SELECT 1 FROM scores WHERE team_name = $1',
      [team]
    );
    if (rows.length > 0) {
      return res.status(409).json({ error: 'Nom d\'équipe déjà utilisé' });
    }

    // Enregistrer le score
    await pool.query(
      'INSERT INTO scores (team_name, duration_seconds, badge) VALUES ($1, $2, $3)',
      [team, durationSec, badge]
    );

    // Marquer la session terminée
    await pool.query(
      'UPDATE game_sessions SET finished_at = $2 WHERE team_name = $1',
      [team, now.toISOString()]
    );

    return res.status(201).json({ success: true, badge, duration: durationSec });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});



// Santé du service
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

async function ensureBadgeColumn() {
  try {
    const check = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'scores' AND column_name = 'badge'"
    );
    if (check.rowCount === 0) {
      await pool.query('ALTER TABLE scores ADD COLUMN badge VARCHAR(20)');
      console.log('Badge column added to scores table');
    }
  } catch (err) {
    console.error('Error ensuring badge column', err);
  }
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      team_name   TEXT PRIMARY KEY,
      started_at  TIMESTAMPTZ NOT NULL,
      ends_at     TIMESTAMPTZ NOT NULL,
      finished_at TIMESTAMPTZ
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scores (
      id               SERIAL PRIMARY KEY,
      team_name        TEXT UNIQUE NOT NULL,
      duration_seconds INTEGER NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      badge            VARCHAR(20) NOT NULL DEFAULT ''
    );
  `);
}

async function start() {
  await ensureTables();   // <— ajoute ça
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server on ${port}`));
}


start();

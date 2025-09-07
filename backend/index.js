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
    const { rows } = await pool.query(
      `SELECT team_name, duration_seconds, 
      to_char(created_at, 'HH24:MI') AS created_at,
      badge
      FROM scores
      ORDER BY duration_seconds ASC, created_at ASC
      LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error : "Erreur serveur"});
  }
});

// --- Nouveaux endpoints de validation des activités ---

// 1. Code César
app.post('/api/activity1', (req, res) => {
  const { shift, answer } = req.body;
  if (typeof shift !== 'number' || !answer) {
    return res.status(400).json({ success: false });
  }
  const encrypted = 'YRXV DYHC WURLV MRXUV SRXU PH WURXYHU';
  const decoded = [...encrypted].map(c => {
    if (!/[A-Z]/.test(c)) return c;
    return String.fromCharCode((c.charCodeAt(0) - 65 - shift + 26) % 26 + 65);
  }).join('');
  const first = decoded.split(' ')[0].toUpperCase();
  if (first === 'VOUS' && answer.trim().toUpperCase() === 'VOUS') {
    return res.json({ success: true, portion: 'VOUS' });
  }
  res.json({ success: false });
});

// 2. Phishing
app.post('/api/activity2', (req, res) => {
  const { selected } = req.body;
  if (typeof selected !== 'number') {
    return res.status(400).json({ success: false });
  }
  if (selected === 1) return res.json({ success: true, portion: '1' });
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
app.post('/api/activity4', (req, res) => {
  const { day, month, year } = req.body;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (d === 15 && m === 8 && y === 1987) {
    return res.json({ success: true, portion: '15081987' });
  }
  res.json({ success: false });
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
 *     tags: [Activités]
 *     summary: Vérifie la combinaison finale et enregistre le score
 *     description: Compare le mot de passe final avec les réponses concaténées aux activités.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - team
 *               - duration
 *               - password
 *               - answers
 *             properties:
 *               team:
 *                 type: string
 *                 description: Nom de l'équipe
 *               duration:
 *                 type: number
 *                 description: Temps total en secondes
 *               password:
 *                 type: string
 *                 description: Mot de passe final (concaténation des portions)
 *               answers:
 *                 type: object
 *                 description: Réponses partielles des activités
 *                 properties:
 *                   caesar: { type: string }
 *                   phishing: { type: string }
 *                   strongestPassword: { type: string }
 *                   osint: { type: string }
 *     responses:
 *       201:
 *         description: Succès, score enregistré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 badge:
 *                   type: string
 *                   enum: [or, argent, bronze, ""]
 *       409:
 *         description: Nom d'équipe déjà utilisé
 *       400:
 *         description: Données invalides
 *       500:
 *         description: Erreur serveur
 */
app.post('/api/verify-final', async (req, res) => {
  const { team, duration, password, answers } = req.body;
  if (!team || typeof duration !== 'number' || !password || !answers) {
    return res.status(400).json({ error: 'Données invalides' });
  }

  const expected =
    String(answers.caesar || '') +
    String(answers.phishing || '') +
    String(answers.strongestPassword || '') +
    String(answers.osint || '');

  if (password === expected ) {
    let badge = '';
    if (duration < 120)      badge = 'or';
    else if (duration < 300) badge = 'argent';
    else if (duration < 480) badge = 'bronze';

    try {
      const { rows } = await pool.query(
        'SELECT 1 FROM scores WHERE team_name = $1',
        [team]
      );
      if (rows.length > 0) {
        return res.status(409).json({ error: 'Nom d\'équipe déjà utilisé' });
      }
      await pool.query(
        'INSERT INTO scores (team_name, duration_seconds, badge) VALUES ($1, $2, $3)',
        [team, duration, badge]
      );
      return res.status(201).json({ success: true, badge });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  res.json({ success: false });
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

async function start() {
  await ensureBadgeColumn();
  const port = process.env.PORT || 3000;
  app.listen(port, () =>
    console.log(`Serveur Express démarré sur http://localhost:${port}`)
  );
}

start();

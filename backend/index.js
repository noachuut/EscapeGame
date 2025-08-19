// index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(cors());
app.use(express.json());

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cyber Detective API',
      version: '1.0.0',
    },
  },
  // Scan all JS files except those in node_modules to build swagger docs
  apis: ['./**/*.js', '!./node_modules/**'],
});

app.use('/api/docs', swaggerUi.serve);
app.get('/api/docs', swaggerUi.setup(swaggerSpec));


// endpoint pour verifier si le nom d'equipe existe déja ou pas
/**
 * @swagger
 * /api/check-team:
 *   get:
 *     summary: Vérifie si un nom d'équipe existe déjà
 *     parameters:
 *       - in: query
 *         name: team
 *         schema:
 *           type: string
 *         required: true
 *         description: Nom de l'équipe à vérifier
 *     responses:
 *       200:
 *         description: Indique si le nom existe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *       400:
 *         description: Requête invalide
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
 * @swagger
 * /api/scores:
 *   get:
 *     summary: Récupère le Top 10 des scores
 *     responses:
 *       200:
 *         description: Liste des scores triés
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: Erreur serveur
 */
app.get('/api/scores', async (req,res) => {
  try {
    const { rows } = await pool.query(
      `SELECT team_name, duration_seconds, created_at, badge
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
/**
 * @swagger
 * /api/activity1:
 *   post:
 *     summary: Valide l'activité du Code César
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shift:
 *                 type: number
 *               answer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Résultat de la validation
 */
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
/**
 * @swagger
 * /api/activity2:
 *   post:
 *     summary: Valide l'activité de phishing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selected:
 *                 type: number
 *     responses:
 *       200:
 *         description: Résultat de la validation
 */
app.post('/api/activity2', (req, res) => {
  const { selected } = req.body;
  if (typeof selected !== 'number') {
    return res.status(400).json({ success: false });
  }
  if (selected === 1) return res.json({ success: true, portion: '1' });
  res.json({ success: false });
});

// 3. Sécurité des mots de passe
/**
 * @swagger
 * /api/activity3:
 *   post:
 *     summary: Valide l'activité sur les mots de passe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               order:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Résultat de la validation
 */
app.post('/api/activity3', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ success: false });
  }
  const correct = [1, 4, 2, 5, 3];
  if (JSON.stringify(order.map(Number)) === JSON.stringify(correct)) {
    return res.json({ success: true, portion: 'Th0m@s_D4r4nd!2024#Secure' });
  }
  res.json({ success: false });
});

// 4. OSINT
/**
 * @swagger
 * /api/activity4:
 *   post:
 *     summary: Valide l'activité OSINT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               day:
 *                 type: string
 *               month:
 *                 type: string
 *               year:
 *                 type: string
 *     responses:
 *       200:
 *         description: Résultat de la validation
 */
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
 * @swagger
 * /api/save-score:
 *   post:
 *     summary: Enregistre un score d'équipe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               team:
 *                 type: string
 *               duration:
 *                 type: number
 *     responses:
 *       201:
 *         description: Score enregistré
 *       400:
 *         description: Données invalides
 *       409:
 *         description: Nom d'équipe déjà utilisé
 */
app.post('/api/save-score', async (req, res) => {
  const { team, duration } = req.body;
  if (!team || typeof duration !== 'number') {
    return res.status(400).json({ error: 'Données invalides' });
  }

  let badge = '';
    if (duration < 120)      badge = 'or';
    else if (duration < 300) badge = 'argent';
    else if (duration < 480) badge = 'bronze';

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
 * @swagger
 * /api/verify-final:
 *   post:
 *     summary: Valide le mot de passe final et enregistre le score
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               team:
 *                 type: string
 *               duration:
 *                 type: number
 *               password:
 *                 type: string
 *               suspect:
 *                 type: number
 *               answers:
 *                 type: object
 *     responses:
 *       201:
 *         description: Score enregistré
 *       400:
 *         description: Données invalides
 *       409:
 *         description: Nom d'équipe déjà utilisé
 */
app.post('/api/verify-final', async (req, res) => {
  const { team, duration, password, suspect, answers } = req.body;
  if (!team || typeof duration !== 'number' || !password || !answers) {
    return res.status(400).json({ error: 'Données invalides' });
  }

  const expected =
    String(answers.caesar || '') +
    String(answers.phishing || '') +
    String(answers.strongestPassword || '') +
    String(answers.osint || '');

  if (password === expected && suspect === 1) {
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
/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Vérifie que le serveur est opérationnel
 *     responses:
 *       200:
 *         description: Serveur en ligne
 */
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

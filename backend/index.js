// index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db');

const app = express();
app.use(cors());
app.use(express.json());


// endpoint pour verifier si le nom d'equipe existe déja ou pas 

app.get('/api/check-team', async (req, res) => {
  const team = req.query.team;
  if (!team) return res.status(400).end();
  const { rows } = await pool.query(
    'SELECT 1 FROM scores WHERE team_name = $1',
    [team]
  );
  res.json({ exists: rows.length > 0 });
});



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

// Endpoint pour sauver un score
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

// Santé du service
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Serveur Express démarré sur http://localhost:${port}`));

// index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/ping', (req, res) => {
  res.send('pong');
});

// Endpoint pour sauver un score
app.post('/api/save-score', async (req, res) => {
  const { team, duration } = req.body;
  if (!team || typeof duration !== 'number') {
    return res.status(400).json({ error: 'Données invalides' });
  }
  try {
    await pool.query(
      'INSERT INTO scores (team_name, duration_seconds) VALUES ($1, $2)',
      [team, duration]
    );
    res.status(201).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Santé du service
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API écoute sur port ${port}`));

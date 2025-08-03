// index.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db');

const app = express();
app.use(cors());
const data = require('./data.json');
app.use(express.json({ limit: '1mb' })); // Increase limit for potentially larger data sets

// Helper function to get a random element from an array
const getRandomElement = (arr) => {
 if (!arr || arr.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * arr.length);
 return arr[randomIndex];
};


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

// --- Nouveaux endpoints de validation des activités ---

// 1. Code César
// Endpoint pour récupérer un set de données pour l'activité 1
app.get('/api/activity1', (req, res) => {
 const selectedData = getRandomElement(data.caesar);
 res.json(selectedData);
});


// Endpoint pour vérifier la réponse de l'activité 1
app.post('/api/activity1', (req, res) => {
 const { encryptedMessage, shift, answer } = req.body;
  if (typeof shift !== 'number' || !answer || !encryptedMessage) {
    return res.status(400).json({ success: false });
  }

  const decoded = [...encryptedMessage].map(c => {
    if (!/[A-Z]/.test(c)) return c;
    return String.fromCharCode((c.charCodeAt(0) - 65 - shift + 26) % 26 + 65);
  }).join('');
 const firstWord = decoded.split(' ')[0].toUpperCase();
  if (answer.trim().toUpperCase() === firstWord) {
 // Placeholder portion - ideally this would also be dynamic
 return res.json({ success: true, portion: firstWord });
  }
  res.json({ success: false });
});

// 2. Phishing
// Endpoint to get a set of data for activity 2
app.get('/api/activity2', (req, res) => {
 const selectedData = getRandomElement(data.phishing);
 res.json(selectedData);
});

// Endpoint to verify the answer for activity 2
app.post('/api/activity2', (req, res) => {
 const { emails, selectedEmailId } = req.body;

 if (!Array.isArray(emails) || typeof selectedEmailId !== 'number') {
 return res.status(400).json({ success: false });
 }

 // Find the email that the user selected in the set they received
 const selectedEmail = emails.find((email, index) => index + 1 === selectedEmailId);

 // Verify if the selected email was actually the phishing one in that set
 if (selectedEmail && selectedEmail.isPhishing) {
 // Placeholder portion - ideally this would also be dynamic
 return res.json({ success: true, portion: '1' });
 }

 res.json({ success: false });
});

// 3. Sécurité des mots de passe
// Endpoint to get a set of data for activity 3
app.get('/api/activity3', (req, res) => {
 const selectedData = getRandomElement(data.passwords);
 res.json(selectedData);
});

// Endpoint to verify the answer for activity 3
app.post('/api/activity3', (req, res) => {
 const { passwords, order } = req.body;

 if (!Array.isArray(passwords) || !Array.isArray(order) || order.length !== passwords.length) {
 return res.status(400).json({ success: false, message: "Invalid input data" });
 }

 // Find the corresponding correct order for this specific set of passwords
 const correctSet = data.passwords.find(set => JSON.stringify(set.passwords) === JSON.stringify(passwords));

 if (!correctSet) {
 return res.status(400).json({ success: false, message: "Password set not found" });
 }

 // Compare the user's selected order with the correct order for this set
 if (JSON.stringify(order.map(Number)) === JSON.stringify(correctSet.correctOrder)) {
 // Placeholder portion - ideally this would also be dynamic
 return res.json({ success: true, portion: correctSet.passwords[correctSet.correctOrder[correctSet.correctOrder.length - 1] - 1] }); // Return the strongest password as portion
 }

 res.json({ success: false, message: "Incorrect order" });
});

// 4. OSINT
// Endpoint to get a set of data for activity 4
app.get('/api/activity4', (req, res) => {
 const selectedData = getRandomElement(data.osint);
 res.json(selectedData);
});

// Endpoint to verify the answer for activity 4
app.post('/api/activity4', (req, res) => {
 const { clues, day, month, year } = req.body;

 const d = parseInt(day, 10);
 const m = parseInt(month, 10);
 const y = parseInt(year, 10);

 if (!Array.isArray(clues) || isNaN(d) || isNaN(m) || isNaN(y)) {
    return res.status(400).json({ success: false });
  }

 // Find the corresponding correct date for this specific set of clues
 const correctSet = data.osint.find(set => JSON.stringify(set.clues) === JSON.stringify(clues));

 if (!correctSet) {
 return res.status(400).json({ success: false, message: "OSINT set not found" });
 }

 // Compare the user's date with the correct date for this set
 if (d === correctSet.correctDate.day && m === correctSet.correctDate.month && y === correctSet.correctDate.year) {
 // Placeholder portion - ideally this would also be dynamic
 // Using the correct date formatted as DDMMYYYY as portion for now
 const portion = `${String(correctSet.correctDate.day).padStart(2, '0')}${String(correctSet.correctDate.month).padStart(2, '0')}${correctSet.correctDate.year}`;
 return res.json({ success: true, portion: portion });
 }

  res.json({ success: false });
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

// Validation finale et enregistrement du score
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

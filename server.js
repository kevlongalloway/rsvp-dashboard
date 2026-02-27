require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const multer   = require('multer');

const app    = express();
const PORT   = process.env.PORT || 3000;
const upload = multer({ limits: { fileSize: 8 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// ─── DATABASE ────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const DEFAULTS = {
  // Couple
  name1: 'Kayla', lastname1: 'Galloway',
  name2: 'Vaughn', lastname2: 'Church',
  // Date & Venue
  wedding_date:    '2027-01-16',
  wedding_time:    '17:00',
  venue_name:      'The Venue at Friendship Springs',
  venue_address:   '7340 Friendship Springs Blvd, Flowery Branch, GA 30542',
  venue_maps_link: 'https://maps.google.com/?q=7340+Friendship+Springs+Blvd+Flowery+Branch+GA+30542',
  dress_code:      'Black Tie / Formal',
  city:            'Flowery Branch, GA',
  // Story
  story_text1: "Kayla and Vaughn met on Kayla's 20th birthday — a night that turned out to be more memorable than anyone could have planned. Kayla was out celebrating with her current maid of honor and cousin, Tsina. The two were having a great time but the night got even more exciting. Kayla spotted Vaughn from across the room. Feeling bold on her birthday, she decided to make the first move and walked right up to him to ask for a drink.",
  story_text2: "From that moment on, they didn't leave each other's side the entire night. What started as a simple birthday celebration quickly turned into the beginning of something much more special. To top it all off, the night even included a surprise performance by 2 Chainz — making an already unforgettable evening even more exciting.",
  story_text3: "But the best part of the night wasn't the music or the celebration — it was meeting the person they would spend the rest of their lives with.",
  story_quote:  "She walked up to him and asked for a drink. The rest is history.",
  // Timeline events (JSON)
  timeline: JSON.stringify([
    { time: '5:00 PM', title: 'Ceremony', detail: 'The Venue at Friendship Springs', note: 'Children welcome · Please be seated by 4:45 PM' },
    { time: '6:00 PM', title: 'Cocktail Hour', detail: 'The Venue at Friendship Springs', note: 'Adults only from this point forward' },
    { time: '7:00 PM', title: 'Reception & Dinner', detail: 'The Venue at Friendship Springs', note: 'Dinner, dancing & celebration' }
  ]),
  // Wedding party (JSON array)
  wedding_party: JSON.stringify([]),
  // Hotel (single)
  hotel_name:     'Hampton Inn & Suites Braselton',
  hotel_address:  '5159 Golf Club Dr, Braselton, GA 30517',
  hotel_phone:    '+1 (770) 307-0700',
  hotel_block:    'Church Wedding',
  hotel_deadline: 'December 12, 2026',
  hotel_link:     'https://www.hilton.com',
  // FAQ (JSON)
  faq: JSON.stringify([
    { q: 'Is parking available?', a: 'Yes! The venue offers complimentary on-site parking in the open lot. Please feel free to park in any available space upon arrival.' },
    { q: 'Are children allowed?', a: 'Children are welcome at the ceremony (5 PM – 6 PM), but the reception is adults-only. We appreciate your understanding and hope you can arrange childcare for the evening.' },
    { q: 'What is the dress code?', a: "Black tie / formal. We'd love for everyone to dress up and celebrate with us in style!" },
    { q: 'When is the RSVP deadline?', a: 'Please RSVP by December 18, 2026 so we can give our vendors accurate counts.' }
  ]),
  // Registry
  registry1_name: '', registry1_link: '#',
  registry2_name: '', registry2_link: '#',
  registry3_name: '', registry3_link: '#',
  // RSVP
  rsvp_deadline:  'December 18, 2026',
  meals:          'Chicken,Fish,Vegetarian',
  collect_dietary: 'false',
  song_requests:   'true',
  coordinator_email: '',
  coordinator_phone: '',
  // Photos — up to 10 gallery slots (base64 data URLs)
  gallery_0: '', gallery_1: '', gallery_2: '', gallery_3: '', gallery_4: '',
  gallery_5: '', gallery_6: '', gallery_7: '', gallery_8: '', gallery_9: '',
  hero_photo: '',
};

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS rsvps (
      id SERIAL PRIMARY KEY, fname TEXT NOT NULL, lname TEXT NOT NULL,
      email TEXT, guests INTEGER DEFAULT 1, meal TEXT,
      song TEXT, message TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  for (const [k, v] of Object.entries(DEFAULTS)) {
    await pool.query(
      `INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`,
      [k, v]
    );
  }
  console.log('✓ DB ready');
}

async function getSettings() {
  const r = await pool.query('SELECT key,value FROM settings');
  const s = { ...DEFAULTS };
  r.rows.forEach(row => { s[row.key] = row.value; });
  return s;
}

function requireAuth(req, res, next) {
  const t = req.headers['x-dashboard-token'] || req.query.token;
  if (t === process.env.DASHBOARD_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ─── PUBLIC API ──────────────────────────────────────

// Site config (no photos — those are big, fetched separately)
app.get('/api/config', async (req, res) => {
  try {
    const s = await getSettings();
    // Strip photo data unless explicitly requested
    if (!req.query.full) {
      for (let i = 0; i <= 9; i++) delete s[`gallery_${i}`];
      delete s.hero_photo;
    }
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Hero photo
app.get('/api/config/hero', async (req, res) => {
  try {
    const r = await pool.query(`SELECT value FROM settings WHERE key='hero_photo'`);
    res.json({ hero_photo: r.rows[0]?.value || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Gallery photos
app.get('/api/config/gallery', async (req, res) => {
  try {
    const r = await pool.query(`SELECT key,value FROM settings WHERE key LIKE 'gallery_%' ORDER BY key`);
    const photos = [];
    r.rows.forEach(row => { if (row.value) photos.push({ slot: row.key, src: row.value }); });
    res.json({ photos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Submit RSVP
app.post('/api/rsvp', async (req, res) => {
  try {
    const { fname, lname, email, guests = 1, meal, song, message } = req.body;
    if (!fname?.trim() || !lname?.trim()) return res.status(400).json({ error: 'Name required.' });
    const result = await pool.query(
      `INSERT INTO rsvps (fname,lname,email,guests,meal,song,message) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [fname.trim(), lname.trim(), email?.trim() || null, parseInt(guests)||1, meal||null, song?.trim()||null, message?.trim()||null]
    );
    const s = await getSettings();
    sendNotification(result.rows[0], s).catch(e => console.error('Email:', e));
    res.json({ ok: true, id: result.rows[0].id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong.' }); }
});

// ─── DASHBOARD API ───────────────────────────────────

app.get('/api/rsvps', requireAuth, async (req, res) => {
  try { const r = await pool.query('SELECT * FROM rsvps ORDER BY created_at DESC'); res.json(r.rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/rsvps/:id', requireAuth, async (req, res) => {
  try { await pool.query('DELETE FROM rsvps WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const total  = await pool.query('SELECT COUNT(*) FROM rsvps');
    const guests = await pool.query('SELECT COALESCE(SUM(guests),0) AS n FROM rsvps');
    const meals  = await pool.query(`SELECT meal,COUNT(*) FROM rsvps WHERE meal IS NOT NULL GROUP BY meal ORDER BY count DESC`);
    res.json({ rsvps: +total.rows[0].count, guests: +guests.rows[0].n, meals: meals.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/settings', requireAuth, async (req, res) => {
  try {
    for (const [k, v] of Object.entries(req.body)) {
      await pool.query(
        `INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2`,
        [k, String(v)]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Upload a single photo (hero or gallery slot)
app.post('/api/settings/photo', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const slot = req.body.slot || 'hero_photo'; // e.g. 'hero_photo', 'gallery_0', 'gallery_1'...
    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await pool.query(
      `INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2`,
      [slot, b64]
    );
    res.json({ ok: true, slot });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete a gallery photo
app.delete('/api/settings/photo/:slot', requireAuth, async (req, res) => {
  try {
    await pool.query(`UPDATE settings SET value='' WHERE key=$1`, [req.params.slot]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/export.csv', requireAuth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM rsvps ORDER BY created_at DESC');
    const rows = [['ID','First','Last','Email','Guests','Meal','Song','Message','Date'],
      ...r.rows.map(x => [x.id,x.fname,x.lname,x.email||'',x.guests,x.meal||'',x.song||'',x.message||'',new Date(x.created_at).toLocaleString()])
    ].map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="rsvps.csv"');
    res.send(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── EMAIL ───────────────────────────────────────────
async function sendNotification(rsvp, s) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;
  const to = process.env.NOTIFY_EMAIL || s.coordinator_email;
  if (!to) return;
  const t = nodemailer.createTransport({ service:'gmail', auth:{ user:process.env.GMAIL_USER, pass:process.env.GMAIL_APP_PASSWORD }});
  await t.sendMail({
    from: `"${s.name1} & ${s.name2} RSVPs 💌" <${process.env.GMAIL_USER}>`,
    to,
    subject: `New RSVP: ${rsvp.fname} ${rsvp.lname}`,
    text: `New RSVP!\n\nName: ${rsvp.fname} ${rsvp.lname}\nEmail: ${rsvp.email||'—'}\nGuests: ${rsvp.guests}\nMeal: ${rsvp.meal||'—'}\nSong: ${rsvp.song||'—'}\n\nDashboard: ${process.env.SITE_URL||''}/dashboard.html`
  });
}

initDB().then(() => app.listen(PORT, () => console.log(`✓ Port ${PORT}`))).catch(e => { console.error(e); process.exit(1); });

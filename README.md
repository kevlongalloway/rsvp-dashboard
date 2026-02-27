# 💚 Kayla & Vaughn — Wedding Website v3

Full-stack wedding website with dynamic content, swipeable photo gallery,
password-protected admin dashboard, and Render deployment.

## Features
- Romantic ivory/pistachio/gold design, light backgrounds only
- Swipeable 10-photo gallery (drag/swipe on mobile)
- Live countdown to January 16, 2027
- Sections: Story, Gallery, Timeline, Wedding Party, Travel, FAQ, Registry, RSVP
- Dashboard: RSVPs, gallery upload (10 slots), all text editable, timeline/party/FAQ editors
- Gmail email notifications on every RSVP
- PostgreSQL database (Render free tier)

## Local Development
```bash
npm install
psql postgres -c "CREATE DATABASE wedding_rsvp;"
cp .env.example .env   # edit with your values
npm start
# http://localhost:3000           → wedding site
# http://localhost:3000/dashboard.html → dashboard
```

### Gmail App Password
myaccount.google.com → Security → 2-Step Verification → App passwords
Create "Wedding RSVP" → copy 16-char code → use as GMAIL_APP_PASSWORD

## Deploy to Render
```bash
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/YOU/wedding-rsvp.git
git push -u origin main
```
1. render.com → New + → Blueprint → connect repo
2. Render reads render.yaml → creates web server + PostgreSQL automatically
3. Set env vars in Render dashboard → Environment:

| Variable | Value |
|----------|-------|
| DASHBOARD_PASSWORD | Password only you know |
| GMAIL_USER | Gmail that sends notifications |
| GMAIL_APP_PASSWORD | 16-char App Password |
| NOTIFY_EMAIL | Email to receive RSVP alerts |
| SITE_URL | https://your-app.onrender.com |

DATABASE_URL is injected automatically.

## Dashboard Capabilities

### RSVPs tab
- View all RSVPs, filter by song requests, search by name
- Add manual RSVPs (phone/paper replies)
- Delete RSVPs, export CSV

### Settings tab
- **Couple & Date** — names, wedding date (activates real countdown), dress code
- **Hero Photo** — upload the main couple photo (drag & drop)
- **Photo Gallery** — 10 upload slots for the swipeable gallery
- **Venue** — name, address, Google Maps link
- **Hotel** — name, address, room block info, deadline
- **Event Timeline** — add/edit/remove timeline events
- **Wedding Party** — add members with names and roles
- **FAQ** — add/edit/remove Q&A items
- **RSVP Settings** — deadline, meal options, song requests on/off
- **Registry** — up to 3 registry links
- **Our Story** — 3 paragraphs + pull quote

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/config | — | Site settings (no photos) |
| GET | /api/config/hero | — | Hero photo |
| GET | /api/config/gallery | — | All gallery photos |
| POST | /api/rsvp | — | Submit RSVP |
| GET | /api/rsvps | ✅ | All RSVPs |
| DELETE | /api/rsvps/:id | ✅ | Remove RSVP |
| GET | /api/stats | ✅ | Counts + meals |
| POST | /api/settings | ✅ | Update settings |
| POST | /api/settings/photo | ✅ | Upload photo (slot param) |
| DELETE | /api/settings/photo/:slot | ✅ | Remove gallery photo |
| GET | /api/export.csv | ✅ | Download CSV |

Auth = header `x-dashboard-token: PASSWORD` or `?token=` query param.

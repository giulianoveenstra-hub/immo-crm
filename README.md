# 🏠 Immo CRM – Workflow Manager

Dein persönliches Tool zur Verwaltung von Immobilien-Objekten, Exposés und Terminanfragen.

---

## 🚀 Deployment auf Vercel (kostenlos)

### Schritt 1: GitHub Account
1. Geh auf [github.com](https://github.com) und erstelle einen kostenlosen Account (falls noch nicht vorhanden)

### Schritt 2: Neues Repository erstellen
1. Klick oben rechts auf **"+"** → **"New repository"**
2. Name: `immo-crm`
3. Klick auf **"Create repository"**

### Schritt 3: Dateien hochladen
1. Klick auf **"uploading an existing file"**
2. Lade alle Dateien aus diesem Ordner hoch:
   - `package.json`
   - `vite.config.js`
   - `index.html`
   - Ordner `src/` mit `main.jsx` und `App.jsx`
3. Klick auf **"Commit changes"**

### Schritt 4: Vercel verbinden
1. Geh auf [vercel.com](https://vercel.com) und registriere dich kostenlos (am besten mit deinem GitHub Account)
2. Klick auf **"Add New Project"**
3. Wähle dein `immo-crm` Repository aus
4. Klick auf **"Deploy"** – fertig!

Nach ca. 1 Minute bekommst du eine URL wie `immo-crm.vercel.app` 🎉

---

## 📱 Als App auf dem Handy speichern

**iPhone (Safari):**
1. Öffne deine Vercel-URL in Safari
2. Tippe auf das Teilen-Symbol (□↑)
3. Wähle **"Zum Home-Bildschirm"**

**Android (Chrome):**
1. Öffne deine Vercel-URL in Chrome
2. Tippe auf die 3 Punkte oben rechts
3. Wähle **"Zum Startbildschirm hinzufügen"**

---

## 💾 Hinweis zu den Daten

Die Daten werden im Browser-Speicher (localStorage) gespeichert. Das bedeutet:
- ✅ Funktioniert auf jedem Gerät
- ⚠️ Daten sind pro Gerät/Browser gespeichert (nicht automatisch synchronisiert)

Für geräteübergreifende Synchronisation kann die App später mit einer Datenbank (z.B. Supabase) erweitert werden.

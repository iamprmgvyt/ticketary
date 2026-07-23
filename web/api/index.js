const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

// Load configurations
const emojis = require('./emojis.json');
const locales = require('./locales.json');
const language = process.env.BOT_LANGUAGE || 'en';

const EMBED_COLOR = '#00f0ff';
const ERROR_COLOR = '#ff3e3e';

// Create MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || '103.228.36.238',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3307,
    user: process.env.DB_USER || 'u182914_ycmpgWNwjI',
    password: process.env.DB_PASSWORD || 'lZPOI9@r.@odqGIE0FWhGE6i',
    database: process.env.DB_NAME || 's182914_Ticketary_DB',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Database helper functions
const db = {
    read: async (table, key) => {
        try {
            const [rows] = await pool.query(`SELECT data FROM ${table} WHERE id = ?`, [key]);
            if (rows.length === 0) return null;
            try {
                return JSON.parse(rows[0].data);
            } catch (e) {
                return rows[0].data;
            }
        } catch (err) {
            console.error(`❌ DB Read Error (${table}, ${key}):`, err.message);
            return null;
        }
    },
    t: (key, placeholders = {}) => {
        const locale = locales[language] || locales['en'];
        let text = locale[key] || locales['en'][key] || key;
        for (const [pKey, pVal] of Object.entries(placeholders)) {
            text = text.replace(new RegExp(`{${pKey}}`, 'g'), pVal);
        }
        return text;
    }
};

// Express Server Setup
const app = express();
app.use(cors());
app.use(express.json());

// Parser to convert Discord Custom Emojis (<:name:id>) into HTML images dynamically
const parseEmojis = (text) => {
    if (!text) return '';
    const emojiRegex = /<a?:([a-zA-Z0-9_]+):([0-9]+)>/g;
    return text.replace(emojiRegex, (match, name, id) => {
        const lowerName = name.toLowerCase();
        const ourEmojis = ['ticket', 'key', 'claim', 'close', 'success', 'error', 'loading', 'premium', 'star', 'ping', 'help', 'setup', 'plus', 'info', 'clock', 'server', 'support'];
        if (ourEmojis.includes(lowerName)) {
            return `<img class="discord-emoji" src="/emojis/${lowerName}.png" alt="${name}" style="height: 1.35em; width: 1.35em; vertical-align: -0.25em; display: inline-block; margin: 0 2px;">`;
        } else {
            const isAnimated = match.startsWith('<a:');
            const ext = isAnimated ? 'gif' : 'png';
            return `<img class="discord-emoji" src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt="${name}" style="height: 1.35em; width: 1.35em; vertical-align: -0.25em; display: inline-block; margin: 0 2px;">`;
        }
    });
};

// Route 1: Beautiful Recoded Glassmorphic Landing Page with Live Stats
app.get('/', async (req, res) => {
    let activeGuilds = 0;
    try {
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM guilds');
        activeGuilds = rows[0].count || 1;
    } catch(e) {
        activeGuilds = 1;
    }
    
    let ticketsClosed = 0;
    let ticketsActive = 0;
    try {
        const [transcriptsRows] = await pool.query('SELECT COUNT(*) as count FROM transcripts');
        const [ticketsRows] = await pool.query('SELECT COUNT(*) as count FROM tickets');
        ticketsClosed = transcriptsRows[0].count;
        ticketsActive = ticketsRows[0].count;
    } catch(e) {}

    const totalTicketsHandled = ticketsClosed + ticketsActive;

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ticketary - Premium Discord Ticket Bot</title>
            <link rel="icon" href="/ticketary.png" type="image/png">
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@300;400;500;700&display=swap" rel="stylesheet">
            <style>
                :root {
                    --bg-dark: #07080c;
                    --panel-dark: rgba(13, 15, 24, 0.7);
                    --accent-blue: #5865f2;
                    --accent-cyan: #00f0ff;
                    --text-primary: #f3f4f6;
                    --text-secondary: #9ca3af;
                    --border-glass: rgba(255, 255, 255, 0.06);
                }

                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }

                body {
                    background-color: var(--bg-dark);
                    background-image: 
                        radial-gradient(circle at 15% 15%, rgba(88, 101, 242, 0.18) 0%, transparent 40%),
                        radial-gradient(circle at 85% 85%, rgba(0, 240, 255, 0.12) 0%, transparent 40%);
                    color: var(--text-primary);
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    overflow-x: hidden;
                    line-height: 1.6;
                }

                /* Header */
                header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 8%;
                    border-bottom: 1px solid var(--border-glass);
                    backdrop-filter: blur(16px);
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    background: rgba(7, 8, 12, 0.75);
                }

                .logo-container {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .logo-img {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    box-shadow: 0 0 12px rgba(0, 240, 255, 0.4);
                }

                .logo-text {
                    font-family: 'Outfit', sans-serif;
                    font-weight: 800;
                    font-size: 1.6em;
                    letter-spacing: 1px;
                    background: linear-gradient(45deg, #ffffff, #a5b4fc);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .nav-links {
                    display: flex;
                    gap: 30px;
                    list-style: none;
                }

                .nav-links a {
                    color: var(--text-secondary);
                    text-decoration: none;
                    font-weight: 500;
                    transition: color 0.3s;
                }

                .nav-links a:hover {
                    color: var(--text-primary);
                }

                .btn-invite {
                    background: linear-gradient(135deg, var(--accent-blue) 0%, #4752c4 100%);
                    color: white;
                    border: none;
                    padding: 10px 24px;
                    border-radius: 30px;
                    font-weight: 600;
                    cursor: pointer;
                    text-decoration: none;
                    box-shadow: 0 4px 15px rgba(88, 101, 242, 0.3);
                    transition: transform 0.3s, box-shadow 0.3s;
                }

                .btn-invite:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(88, 101, 242, 0.5);
                }

                /* Hero Section */
                .hero {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    padding: 120px 8% 80px 8%;
                    max-width: 900px;
                    margin: 0 auto;
                    animation: fadeInUp 1s ease-out;
                }

                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .hero-tag {
                    background: rgba(88, 101, 242, 0.15);
                    border: 1px solid rgba(88, 101, 242, 0.3);
                    color: #a5b4fc;
                    padding: 6px 18px;
                    border-radius: 20px;
                    font-size: 0.85em;
                    font-weight: 600;
                    margin-bottom: 25px;
                    letter-spacing: 0.5px;
                    animation: pulse 2s infinite alternate;
                }

                @keyframes pulse {
                    0% { box-shadow: 0 0 5px rgba(88, 101, 242, 0.2); }
                    100% { box-shadow: 0 0 15px rgba(88, 101, 242, 0.5); }
                }

                .hero h1 {
                    font-family: 'Outfit', sans-serif;
                    font-size: 4em;
                    font-weight: 800;
                    line-height: 1.1;
                    margin-bottom: 25px;
                    background: linear-gradient(135deg, #ffffff 40%, #a5b4fc 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .hero p {
                    color: var(--text-secondary);
                    font-size: 1.25em;
                    margin-bottom: 40px;
                    max-width: 700px;
                }

                .hero-ctas {
                    display: flex;
                    gap: 20px;
                }

                .btn-secondary {
                    background: transparent;
                    color: var(--text-primary);
                    border: 1px solid var(--border-glass);
                    padding: 14px 32px;
                    border-radius: 30px;
                    font-weight: 600;
                    cursor: pointer;
                    text-decoration: none;
                    backdrop-filter: blur(5px);
                    transition: background 0.3s, border-color 0.3s;
                }

                .btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(255, 255, 255, 0.2);
                }

                .btn-primary-large {
                    background: linear-gradient(135deg, var(--accent-blue) 0%, #4752c4 100%);
                    color: white;
                    border: none;
                    padding: 14px 32px;
                    border-radius: 30px;
                    font-weight: 600;
                    cursor: pointer;
                    text-decoration: none;
                    box-shadow: 0 4px 15px rgba(88, 101, 242, 0.3);
                    transition: transform 0.3s, box-shadow 0.3s;
                }

                .btn-primary-large:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(88, 101, 242, 0.5);
                }

                /* Statistics Cards */
                .stats-container {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 30px;
                    padding: 40px 8%;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .stat-card {
                    background: var(--panel-dark);
                    border: 1px solid var(--border-glass);
                    border-radius: 20px;
                    padding: 35px;
                    text-align: center;
                    backdrop-filter: blur(12px);
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
                    transition: transform 0.3s, border-color 0.3s;
                    animation: floatCard 4s ease-in-out infinite;
                }

                .stat-card:nth-child(2) {
                    animation-delay: 1.3s;
                }

                .stat-card:nth-child(3) {
                    animation-delay: 2.6s;
                }

                @keyframes floatCard {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-8px); }
                    100% { transform: translateY(0px); }
                }

                .stat-card:hover {
                    border-color: rgba(0, 240, 255, 0.3);
                }

                .stat-num {
                    font-family: 'Outfit', sans-serif;
                    font-size: 3.2em;
                    font-weight: 800;
                    color: white;
                    margin-bottom: 5px;
                    background: linear-gradient(45deg, #ffffff, var(--accent-cyan));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .stat-label {
                    color: var(--text-secondary);
                    font-weight: 600;
                    text-transform: uppercase;
                    font-size: 0.85em;
                    letter-spacing: 1.5px;
                }

                /* Features Grid */
                .features {
                    padding: 80px 8%;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .section-title {
                    font-family: 'Outfit', sans-serif;
                    font-size: 2.5em;
                    font-weight: 800;
                    text-align: center;
                    margin-bottom: 60px;
                }

                .features-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 40px;
                }

                .feature-card {
                    background: var(--panel-dark);
                    border: 1px solid var(--border-glass);
                    border-radius: 24px;
                    padding: 40px;
                    backdrop-filter: blur(10px);
                    transition: transform 0.3s, border-color 0.3s;
                }

                .feature-card:hover {
                    transform: translateY(-5px);
                    border-color: rgba(88, 101, 242, 0.4);
                }

                .feature-icon-wrapper {
                    width: 54px;
                    height: 54px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid var(--border-glass);
                    margin-bottom: 24px;
                }

                .feature-icon-img {
                    width: 32px;
                    height: 32px;
                }

                .feature-card h3 {
                    font-family: 'Outfit', sans-serif;
                    font-size: 1.5em;
                    font-weight: 700;
                    margin-bottom: 15px;
                    color: white;
                }

                .feature-card p {
                    color: var(--text-secondary);
                    font-size: 1em;
                }

                /* Footer */
                footer {
                    border-top: 1px solid var(--border-glass);
                    padding: 40px 8%;
                    text-align: center;
                    color: var(--text-secondary);
                    font-size: 0.9em;
                    margin-top: 80px;
                }

                @media (max-width: 768px) {
                    .hero h1 { font-size: 2.8em; }
                    .stats-container { grid-template-columns: 1fr; }
                    .features-grid { grid-template-columns: 1fr; }
                    .nav-links { display: none; }
                }
            </style>
        </head>
        <body>
            <header>
                <div class="logo-container">
                    <img class="logo-img" src="/ticketary.png" alt="Logo">
                    <span class="logo-text">TICKETARY</span>
                </div>
                <ul class="nav-links">
                    <li><a href="#features">Features</a></li>
                </ul>
                <a class="btn-invite" href="https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID || '1446486016721424394'}&permissions=8&scope=bot%20applications.commands" target="_blank">Invite Bot</a>
            </header>

            <section class="hero">
                <div class="hero-tag">🔥 Live & Fully Operational</div>
                <h1>Secure, Efficient & Elegant Ticketing</h1>
                <p>Provide premium, high-speed support to your Discord community. Generate beautiful online transcripts, configure automatic weekly cleanups, and manage staff operations seamlessly.</p>
                <div class="hero-ctas">
                    <a class="btn-primary-large" href="https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID || '1446486016721424394'}&permissions=8&scope=bot%20applications.commands" target="_blank">Invite Ticketary</a>
                </div>
            </section>

            <section class="stats-container">
                <div class="stat-card">
                    <div class="stat-num">${activeGuilds}</div>
                    <div class="stat-label">Active Guilds</div>
                </div>
                <div class="stat-card">
                    <div class="stat-num">${totalTicketsHandled}</div>
                    <div class="stat-label">Tickets Handled</div>
                </div>
                <div class="stat-card">
                    <div class="stat-num">99.9%</div>
                    <div class="stat-label">System Uptime</div>
                </div>
            </section>

            <section class="features" id="features">
                <h2 class="section-title">Why choose Ticketary?</h2>
                <div class="features-grid">
                    <div class="feature-card">
                        <div class="feature-icon-wrapper">
                            <img class="feature-icon-img" src="/emojis/ticket.png" alt="Ticket">
                        </div>
                        <h3>Interactive Web Transcripts</h3>
                        <p>Beautiful, fully-rendered dark-themed HTML transcripts showing complete conversations, media attachments, and rich embeds exactly as they appear in Discord.</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon-wrapper">
                            <img class="feature-icon-img" src="/emojis/key.png" alt="Key">
                        </div>
                        <h3>Instant Link Retrieval</h3>
                        <p>Access transcripts instantly through secure, unguessable channel IDs mapped directly to your Discord ticket reference.</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon-wrapper">
                            <img class="feature-icon-img" src="/emojis/claim.png" alt="Claim">
                        </div>
                        <h3>Support Staff Workflow</h3>
                        <p>Smooth claim systems utilizing Discord components. Ticket claiming disables buttons dynamically, increments staff metrics, and logs leaderboard statistics.</p>
                    </div>
                    <div class="feature-card">
                        <div class="feature-icon-wrapper">
                            <img class="feature-icon-img" src="/emojis/premium.png" alt="Premium">
                        </div>
                        <h3>Premium Customization</h3>
                        <p>Configure custom ticket naming templates, bypass weekly limits, load localized multi-language text packages, and unlock deeper message archives.</p>
                    </div>
                </div>
            </section>

            <footer>
                <p>&copy; 2026 Ticketary. Designed for high performance Discord communities.</p>
            </footer>
        </body>
        </html>
    `);
});

// Route 2: Upgraded Transcript Viewer (GET /transcript/:id) (loaded from MySQL)
app.get('/transcript/:id', async (req, res) => {
    const channelId = req.params.id;

    // Check if transcript data exists
    const transcriptData = await db.read('transcripts', channelId);
    if (!transcriptData) {
        return res.status(404).send(`
            <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; text-align: center; padding-top: 100px; background-color: #090a0f; color: #9ca3af; height: 100vh; margin: 0;">
                <div style="font-size: 3em; margin-bottom: 20px;">${emojis.error || '❌'}</div>
                <h2 style="color: #fff; font-weight: 700;">Transcript Not Found</h2>
                <p>The transcript with ID <strong>${channelId}</strong> does not exist or has expired.</p>
                <br>
                <a href="/" style="color: #5865f2; text-decoration: none; font-weight: 600;">Go Back Home</a>
            </div>
        `);
    }

    // Build and Serve Upgraded Transcript HTML Immediately
    let messagesHtml = '';
    transcriptData.messages.forEach(msg => {
        const timeStr = new Date(msg.timestamp).toLocaleString();
        let textContent = msg.content ? parseEmojis(msg.content.replace(/\n/g, '<br>')) : '';
        
        // Handle attachments (render images directly!)
        let attachmentsHtml = '';
        if (msg.attachments && msg.attachments.length > 0) {
            attachmentsHtml += '<div class="attachments">';
            msg.attachments.forEach(att => {
                const ext = att.name.split('.').pop().toLowerCase();
                const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
                if (isImage) {
                    attachmentsHtml += `
                        <div>
                            <a class="attachment-link" href="${att.url}" target="_blank">${parseEmojis(emojis.ticket || '🎫')} ${att.name}</a>
                            <br>
                            <img class="attachment-img" src="${att.url}" alt="${att.name}">
                        </div>
                    `;
                } else {
                    attachmentsHtml += `<a class="attachment-link" href="${att.url}" target="_blank">📄 ${att.name}</a>`;
                }
            });
            attachmentsHtml += '</div>';
        }

        // Handle Discord style rich embeds
        let embedsHtml = '';
        if (msg.embeds && msg.embeds.length > 0) {
            msg.embeds.forEach(embed => {
                const borderHex = embed.color ? '#' + embed.color.toString(16).padStart(6, '0') : '#5865f2';
                
                let fieldsHtml = '';
                if (embed.fields && embed.fields.length > 0) {
                    fieldsHtml += '<div class="embed-fields">';
                    embed.fields.forEach(f => {
                        fieldsHtml += `
                            <div class="embed-field ${f.inline ? 'inline-true' : 'inline-false'}">
                                <span class="embed-field-name">${parseEmojis(f.name)}</span>
                                <span class="embed-field-value">${f.value ? parseEmojis(f.value.replace(/\n/g, '<br>')) : ''}</span>
                            </div>
                        `;
                    });
                    fieldsHtml += '</div>';
                }

                embedsHtml += `
                    <div class="discord-embed" style="border-left-color: ${borderHex}">
                        ${embed.title ? `<div class="embed-title">${parseEmojis(embed.title)}</div>` : ''}
                        ${embed.description ? `<div class="embed-description">${parseEmojis(embed.description.replace(/\n/g, '<br>'))}</div>` : ''}
                        ${fieldsHtml}
                        ${embed.footer ? `<div class="embed-footer">${parseEmojis(embed.footer.text || '')}</div>` : ''}
                    </div>
                `;
            });
        }

        messagesHtml += `
            <div class="message">
                <img class="avatar" src="${msg.author.avatar}" alt="Avatar">
                <div class="msg-content">
                    <div class="msg-header">
                        <span class="username">${msg.author.tag}</span>
                        ${msg.author.bot ? '<span class="bot-badge">BOT</span>' : ''}
                        <span class="time">${timeStr}</span>
                    </div>
                    <div class="text">${textContent}</div>
                    ${attachmentsHtml}
                    ${embedsHtml}
                </div>
            </div>
        `;
    });

    const isPremium = transcriptData.meta.isPremium;
    const badgeText = isPremium ? '⭐ Premium Transcript' : 'Free Transcript';
    const badgeClass = isPremium ? 'badge premium' : 'badge';

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Transcript: #${transcriptData.meta.channelName}</title>
            <link rel="icon" href="/ticketary.png" type="image/png">
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                :root {
                    --bg-dark: #0f1115;
                    --panel-dark: rgba(22, 26, 35, 0.7);
                    --accent-blue: #5865f2;
                    --text-primary: #dcddde;
                    --text-muted: #72767d;
                    --border-glass: rgba(255, 255, 255, 0.05);
                }

                body {
                    background-color: var(--bg-dark);
                    color: var(--text-primary);
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    margin: 0;
                    padding: 30px 15px;
                }

                .container {
                    max-width: 950px;
                    margin: 0 auto;
                    background-color: var(--panel-dark);
                    border: 1px solid var(--border-glass);
                    border-radius: 16px;
                    padding: 30px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(10px);
                }

                .header {
                    border-bottom: 1px solid var(--border-glass);
                    padding-bottom: 25px;
                    margin-bottom: 25px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .guild-info {
                    display: flex;
                    align-items: center;
                }

                .guild-icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    margin-right: 18px;
                    border: 2px solid var(--accent-blue);
                }

                .title {
                    margin: 0;
                    color: #fff;
                    font-size: 1.5em;
                    font-weight: 700;
                }

                .meta-details {
                    font-size: 0.85em;
                    color: var(--text-muted);
                    margin-top: 4px;
                }

                .meta-details strong {
                    color: #c4c9ce;
                }

                .badge {
                    background-color: var(--accent-blue);
                    color: #fff;
                    padding: 6px 14px;
                    border-radius: 30px;
                    font-size: 0.8em;
                    font-weight: 600;
                }

                .badge.premium {
                    background: linear-gradient(45deg, #faa81a, #f26522);
                    box-shadow: 0 0 12px rgba(250, 168, 26, 0.4);
                }

                .messages {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }

                .message {
                    display: flex;
                    align-items: flex-start;
                    padding-top: 15px;
                    border-top: 1px solid rgba(255, 255, 255, 0.03);
                }

                .avatar {
                    width: 42px;
                    height: 42px;
                    border-radius: 50%;
                    margin-right: 18px;
                    flex-shrink: 0;
                    border: 1px solid var(--border-glass);
                }

                .msg-content {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                }

                .msg-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 6px;
                }

                .username {
                    font-weight: 600;
                    color: #fff;
                    font-size: 0.95em;
                }

                .bot-badge {
                    background-color: var(--accent-blue);
                    color: #fff;
                    font-size: 0.65em;
                    font-weight: 700;
                    padding: 1px 5px;
                    border-radius: 4px;
                    text-transform: uppercase;
                }

                .time {
                    color: var(--text-muted);
                    font-size: 0.75em;
                }

                .text {
                    color: #dcddde;
                    font-size: 0.95em;
                    line-height: 1.45;
                    word-break: break-word;
                }

                .attachments {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-top: 8px;
                }

                .attachment-link {
                    color: #00b0f4;
                    text-decoration: none;
                    font-size: 0.85em;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                }

                .attachment-link:hover {
                    text-decoration: underline;
                }

                .attachment-img {
                    max-width: 100%;
                    max-height: 320px;
                    border-radius: 8px;
                    margin-top: 6px;
                    border: 1px solid var(--border-glass);
                }

                .discord-embed {
                    background-color: rgba(0, 0, 0, 0.2);
                    border-left: 4px solid var(--accent-blue);
                    border-radius: 6px;
                    padding: 16px;
                    margin-top: 8px;
                    max-width: 520px;
                    border: 1px solid var(--border-glass);
                    border-left-width: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .embed-title {
                    color: #fff;
                    font-weight: 600;
                    font-size: 0.95em;
                }

                .embed-description {
                    color: #b9bbbe;
                    font-size: 0.85em;
                    line-height: 1.4;
                }

                .embed-fields {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-top: 6px;
                }

                .embed-field {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .embed-field.inline-false {
                    grid-column: span 2;
                }

                .embed-field-name {
                    color: #fff;
                    font-size: 0.8em;
                    font-weight: 600;
                }

                .embed-field-value {
                    color: #b9bbbe;
                    font-size: 0.8em;
                }

                .embed-footer {
                    color: var(--text-muted);
                    font-size: 0.75em;
                    margin-top: 4px;
                }

                .footer-banner {
                    text-align: center;
                    color: var(--text-muted);
                    font-size: 0.8em;
                    margin-top: 35px;
                    border-top: 1px solid var(--border-glass);
                    padding-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="guild-info">
                        <img class="guild-icon" src="${transcriptData.meta.guildIcon}" alt="Server Icon">
                        <div>
                            <h1 class="title">#${transcriptData.meta.channelName}</h1>
                            <div class="meta-details">
                                Server: <strong>${transcriptData.meta.guildName}</strong> | Created: ${new Date(transcriptData.meta.createdAt).toLocaleString()} | Closed: ${new Date(transcriptData.meta.closedAt).toLocaleString()}
                            </div>
                            <div class="meta-details" style="margin-top: 4px;">
                                Opened By: <strong>${transcriptData.meta.ticketCreator}</strong> | Closed By: <strong>${transcriptData.meta.ticketCloser}</strong> | Messages: <strong>${transcriptData.meta.messageCount}</strong>
                            </div>
                        </div>
                    </div>
                    <div>
                        <span class="${badgeClass}">${badgeText}</span>
                    </div>
                </div>
                <div class="messages">
                    ${messagesHtml}
                </div>
                <div class="footer-banner">
                    Generated by <strong>Ticketary</strong> Bot. All transcripts are securely processed.
                </div>
            </div>
        </body>
        </html>
    `);
});

// Route 3: Serve Raw JSON Transcript (For Vercel/External Viewers)
app.get('/data/transcripts/:id.json', async (req, res) => {
    const channelId = req.params.id;
    const transcriptData = await db.read('transcripts', channelId);
    if (!transcriptData) {
        return res.status(404).send({ error: 'Transcript data not found.' });
    }
    res.json(transcriptData);
});

module.exports = app;

const mysql = require('mysql2/promise');
const moment = require('moment');

// Load configurations
const emojis = require('./emojis.json');
const locales = require('./locales.json');
const language = process.env.BOT_LANGUAGE || 'en';

// Create MySQL connection pool using user's database details as defaults
const pool = mysql.createPool({
    host: process.env.DB_HOST || '103.228.36.238',
    port: process.env.DB_PORT || 3307,
    user: process.env.DB_USER || 'u182914_ycmpgWNwjI',
    password: process.env.DB_PASSWORD || 'lZPOI9@r.@odqGIE0FWhGE6i',
    database: process.env.DB_NAME || 's182914_Ticketary_DB',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Initialize database tables
async function initializeDatabase() {
    const requiredTables = ['guilds', 'premium', 'tickets', 'transcripts', 'limits', 'staff'];
    
    for (const table of requiredTables) {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ${table} (
                id VARCHAR(64) PRIMARY KEY,
                data LONGTEXT NOT NULL,
                mtime TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    }
    console.log('✅ Database: All MySQL tables initialized successfully.');
}
initializeDatabase().catch(err => {
    console.error('❌ Database: Failed to initialize MySQL tables:', err.message);
});

// Create a Proxy for emojis to automatically fetch custom uploaded emojis from client cache
const emojisProxy = new Proxy(emojis, {
    get(target, prop) {
        if (typeof prop === 'string' && db.client && db.client.emojis) {
            const customEmoji = db.client.emojis.cache.find(e => e.name.toLowerCase() === prop.toLowerCase());
            if (customEmoji) {
                return customEmoji.toString();
            }
        }
        return target[prop] || '';
    }
});

const db = {
    // Emojis configuration (proxied for dynamic global server cache lookup)
    emojis: emojisProxy,
    
    // Placeholder to bind Discord Client later in index.js
    client: null,

    // Export raw pool for custom queries (e.g. transcript auto-clean)
    pool: pool,

    getButtonEmoji: (emojiVal) => {
        if (!emojiVal) return null;
        if (typeof emojiVal === 'object') {
            if (emojiVal.id) return emojiVal.id;
            return emojiVal.name;
        }
        if (typeof emojiVal !== 'string') return emojiVal;
        if (!emojiVal.includes('<') && !emojiVal.includes(':')) {
            return emojiVal;
        }
        const match = emojiVal.match(/:([0-9]+)>/);
        if (match) {
            return match[1];
        }
        return emojiVal;
    },

    // Translation helper
    t: (key, placeholders = {}) => {
        const locale = locales[language] || locales['en'];
        let text = locale[key] || locales['en'][key] || key;
        
        for (const [pKey, pVal] of Object.entries(placeholders)) {
            text = text.replace(new RegExp(`{${pKey}}`, 'g'), pVal);
        }
        return text;
    },

    /**
     * Reads a JSON record from the database. If key is null, returns all records in table.
     */
    read: async (table, key) => {
        try {
            if (key === null) {
                const [rows] = await pool.query(`SELECT id, data FROM ${table}`);
                const results = {};
                for (const row of rows) {
                    try {
                        results[row.id] = JSON.parse(row.data);
                    } catch (e) {
                        results[row.id] = {};
                    }
                }
                return results;
            }
            
            const [rows] = await pool.query(`SELECT data FROM ${table} WHERE id = ?`, [key]);
            if (rows.length > 0) {
                return JSON.parse(rows[0].data);
            }
            return null;
        } catch (error) {
            console.error(`❌ DB Read Error on table ${table}:`, error.message);
            return null;
        }
    },

    /**
     * Writes a JSON record to the database.
     */
    write: async (table, key, data) => {
        try {
            const dataStr = JSON.stringify(data);
            await pool.query(`
                INSERT INTO ${table} (id, data) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE data = ?
            `, [key, dataStr, dataStr]);
        } catch (error) {
            console.error(`❌ DB Write Error on table ${table}:`, error.message);
        }
    },

    /**
     * Deletes a JSON record from the database.
     */
    delete: async (table, key) => {
        try {
            await pool.query(`DELETE FROM ${table} WHERE id = ?`, [key]);
        } catch (error) {
            console.error(`❌ DB Delete Error on table ${table}:`, error.message);
        }
    },

    /**
     * Increments staff statistics.
     */
    incrementStaffStats: async (staffId, action, username = 'Unknown Staff') => {
        const staffData = await db.read('staff', staffId) || {
            username: username,
            claims: 0,
            closes: 0
        };
        staffData.username = username;
        if (action === 'claim') staffData.claims += 1;
        if (action === 'close') staffData.closes += 1;
        await db.write('staff', staffId, staffData);
        return staffData;
    },

    /**
     * Checks if a server or user has active premium status.
     */
    checkPremium: async (id) => {
        const premiumData = await db.read('premium', id);

        if (!premiumData || !premiumData.expiresAt) return false;

        if (moment().isBefore(moment(premiumData.expiresAt))) {
            return true;
        } else {
            await db.delete('premium', id);
            console.log(`⭐ Premium expired and removed for ID: ${id}`);
            return false;
        }
    },

    /**
     * Gets or resets the weekly ticket count for a guild.
     */
    getWeeklyLimit: async (guildId) => {
        const limitData = await db.read('limits', guildId) || {
            count: 0,
            resetTimestamp: moment().startOf('week').add(1, 'week').toISOString()
        };

        const now = moment();
        const resetTime = moment(limitData.resetTimestamp);

        if (now.isSameOrAfter(resetTime)) {
            limitData.count = 0;
            limitData.resetTimestamp = moment().startOf('week').add(1, 'week').toISOString(); 
            await db.write('limits', guildId, limitData);
        }

        return limitData;
    },

    /**
     * Increments the weekly ticket count for a guild.
     */
    incrementWeeklyLimit: async (guildId) => {
        const limitData = await db.getWeeklyLimit(guildId);
        limitData.count += 1;
        await db.write('limits', guildId, limitData);
        return limitData;
    }
};

module.exports = db;

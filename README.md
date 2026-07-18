# 🤖 Discord Ticket Bot

A complete Discord Ticket Bot built with **Node.js** and **Discord.js v14**. Supports both **Slash Commands** (`/`) and **Prefix Commands** (`!`). Uses **JSON files** for a lightweight database.

## 🚀 Setup & Installation

1.  **Clone the repository** (or create the file structure provided).
2.  **Install dependencies:**
    ```bash
    npm install
    ```
    *Dependencies include `discord.js`, `dotenv`, `html-pdf`, and `moment`.*

3.  **Configure Environment Variables:**
    Rename `.env.example` to **`.env`** and fill in your details:
    * `DISCORD_BOT_TOKEN`: Your bot's unique token.
    * `CLIENT_ID`: Your bot's Application ID (needed for Slash Command deployment).
    * `PREMIUM_USER_ID`: The specific user ID (`1262304052361035857`) for premium management.

4.  **Run the bot:**
    ```bash
    npm start
    ```

5.  **Bot Status:** The bot will show its status as **Mobile Online**.

## 🔧 Bot Configuration (In Discord)

1.  **Setup Command:** Run the `/setup` command as an administrator:
    ```
    /setup <ticket-channel> <support-role> <member-close-permission> <transcript-channel>
    ```
    * This is mandatory before creating tickets.
    * This configuration is saved to `data/guilds/<guildId>.json`.

## ✨ Features & Commands

| Feature | Slash Command | Prefix Command | Description |
| :--- | :--- | :--- | :--- |
| **New Ticket** | `/new` | `!new` | Opens a new support ticket channel. |
| **Close Ticket** | `/close` | `!close` | Generates HTML transcript, DMs it, sends it to transcript channel, and deletes the ticket. |
| **Claim Ticket** | (Button) | N/A | Support staff claim a ticket via button in the ticket channel. |
| **Help** | `/help` | `!help` | Shows command list. |
| **Ping** | `/ping` | `!ping` | Checks bot latency. |

*(Commands for `add`, `remove`, `tos`, `privacy` use the same structure as `ping` and `new`.)*

## 💾 Database Structure

The bot uses the `data/` directory for JSON storage:

* **`data/guilds/<guildId>.json`**: Stores server configuration (`supportRoleId`, `transcriptChannelId`, etc.).
* **`data/tickets/<creatorId>.json`**: Stores currently active ticket state (keyed by the **creator's ID**).
* **`data/premium/<userId>.json`**: Stores active premium users (keyed by the **user's ID**).
* **`data/transcripts/<channelId>.pdf`**: Stores generated PDF transcripts.
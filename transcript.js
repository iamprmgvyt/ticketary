const db = require('./database');
const moment = require('moment');
const { cleanContent } = require('discord.js');

// Host URL for the transcript page
const WEB_APP_BASE_URL = process.env.TRANSCRIPT_WEB_URL || 'https://ticketary.prmgvyt.xyz';

/**
 * Formats messages into a JSON structure, saves them to the database, and returns the chosen format (web link or file buffer).
 * Supported formats: 'html_web', 'html_file', 'txt', 'pdf', 'docs'
 * @returns {Promise<{type: 'web'|'file', url: string, filename?: string, buffer?: Buffer}>}
 */
module.exports = async (channel, creator, closer, rawMessages, isPremium, format = 'html_web') => {
    const MAX_FREE_MESSAGES = 100;
    const MAX_PREMIUM_MESSAGES = 250; 
    
    // Reverse messages to show oldest first, and limit them based on premium tier
    const messages = rawMessages.reverse().slice(0, isPremium ? MAX_PREMIUM_MESSAGES : MAX_FREE_MESSAGES);
    
    const transcriptMessages = messages.map(m => ({
        id: m.id,
        author: {
            id: m.author.id,
            tag: m.author.tag,
            avatar: m.author.displayAvatarURL({ extension: 'png' }) || 'https://cdn.discordapp.com/embed/avatars/0.png',
            bot: m.author.bot,
        },
        content: cleanContent(m.content, channel),
        timestamp: moment(m.createdTimestamp).toISOString(),
        attachments: m.attachments.map(a => ({ name: a.name, url: a.url })),
        embeds: m.embeds.map(e => e.toJSON()),
    }));

    const transcriptData = {
        meta: {
            botName: 'Ticketary',
            isPremium: isPremium,
            channelId: channel.id,
            channelName: channel.name,
            guildName: channel.guild.name,
            guildIcon: channel.guild.iconURL({ extension: 'png' }) || 'https://cdn.discordapp.com/embed/avatars/0.png',
            createdAt: channel.createdAt.toISOString(),
            closedAt: new Date().toISOString(),
            ticketCreator: creator.tag || creator.username || 'Unknown User',
            ticketCloser: closer.tag || closer.username || 'Unknown User',
            messageCount: transcriptMessages.length,
        },
        messages: transcriptMessages,
    };
    
    // Save raw data JSON to database for online web viewing & audit
    await db.write('transcripts', channel.id, transcriptData); 

    const cleanChannelName = channel.name.replace(/[^a-z0-9_-]/gi, '');
    const webUrl = `${WEB_APP_BASE_URL}/transcript/${channel.id}`;

    // Format 1: Web Online URL (Default)
    if (format === 'html_web') {
        return {
            type: 'web',
            url: webUrl
        };
    }

    // Format 2: Offline Standalone HTML File
    if (format === 'html_file') {
        let msgsHtml = transcriptMessages.map(m => `
            <div style="margin-bottom: 12px; border-bottom: 1px solid #2f3136; padding-bottom: 8px;">
                <strong style="color: #5865f2;">${m.author.tag}</strong> <span style="color: #72767d; font-size: 0.8em;">[${moment(m.timestamp).format('YYYY-MM-DD HH:mm:ss')}]</span>
                <div style="color: #dcddde; margin-top: 4px;">${m.content || ''}</div>
                ${m.attachments.map(a => `<div style="margin-top: 4px;"><a href="${a.url}" target="_blank" style="color: #00b0f4;">📄 ${a.name}</a></div>`).join('')}
            </div>
        `).join('');

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Transcript - #${channel.name}</title>
    <style>
        body { background-color: #1e1f22; color: #dcddde; font-family: Arial, sans-serif; padding: 20px; }
        .header { border-bottom: 2px solid #5865f2; padding-bottom: 15px; margin-bottom: 20px; }
        h1 { color: #fff; margin: 0; }
        .meta { color: #9ca3af; font-size: 0.9em; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>#${channel.name} - Ticket Transcript</h1>
        <div class="meta">Server: ${channel.guild.name} | Opened by: ${creator.username} | Closed by: ${closer.username} | Messages: ${transcriptMessages.length}</div>
    </div>
    <div class="messages">
        ${msgsHtml}
    </div>
</body>
</html>`;

        return {
            type: 'file',
            filename: `transcript-${cleanChannelName}.html`,
            buffer: Buffer.from(htmlContent, 'utf-8'),
            url: webUrl
        };
    }

    // Format 3: Plain TXT File
    if (format === 'txt') {
        let txtContent = `====================================================\n`;
        txtContent += `TICKET TRANSCRIPT - #${channel.name}\n`;
        txtContent += `Server: ${channel.guild.name}\n`;
        txtContent += `Opened By: ${creator.tag || creator.username}\n`;
        txtContent += `Closed By: ${closer.tag || closer.username}\n`;
        txtContent += `Closed At: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n`;
        txtContent += `Total Messages: ${transcriptMessages.length}\n`;
        txtContent += `====================================================\n\n`;

        transcriptMessages.forEach(m => {
            txtContent += `[${moment(m.timestamp).format('YYYY-MM-DD HH:mm:ss')}] ${m.author.tag}:\n${m.content || '(No text content)'}\n`;
            if (m.attachments && m.attachments.length > 0) {
                m.attachments.forEach(att => {
                    txtContent += `   [Attachment] ${att.name}: ${att.url}\n`;
                });
            }
            txtContent += `----------------------------------------------------\n`;
        });

        return {
            type: 'file',
            filename: `transcript-${cleanChannelName}.txt`,
            buffer: Buffer.from(txtContent, 'utf-8'),
            url: webUrl
        };
    }

    // Format 4: PDF Document File
    if (format === 'pdf') {
        let pdfTxt = `=========================================\n`;
        pdfTxt += `PDF TICKET TRANSCRIPT REPORT - #${channel.name}\n`;
        pdfTxt += `=========================================\n`;
        pdfTxt += `Server: ${channel.guild.name}\n`;
        pdfTxt += `Created By: ${creator.tag || creator.username}\n`;
        pdfTxt += `Closed By: ${closer.tag || closer.username}\n`;
        pdfTxt += `Date: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n`;
        pdfTxt += `Messages: ${transcriptMessages.length}\n`;
        pdfTxt += `=========================================\n\n`;

        transcriptMessages.forEach(m => {
            pdfTxt += `• [${moment(m.timestamp).format('HH:mm:ss')}] ${m.author.tag}:\n  ${m.content || ''}\n\n`;
        });

        return {
            type: 'file',
            filename: `transcript-${cleanChannelName}.pdf`,
            buffer: Buffer.from(pdfTxt, 'utf-8'),
            url: webUrl
        };
    }

    // Format 5: DOCS / Markdown File (.md)
    if (format === 'docs') {
        let mdContent = `# 📑 Ticket Transcript: #${channel.name}\n\n`;
        mdContent += `- **Server**: ${channel.guild.name}\n`;
        mdContent += `- **Ticket Creator**: ${creator.tag || creator.username}\n`;
        mdContent += `- **Closed By**: ${closer.tag || closer.username}\n`;
        mdContent += `- **Date**: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n`;
        mdContent += `- **Messages**: ${transcriptMessages.length}\n\n`;
        mdContent += `--- \n\n`;
        mdContent += `## Conversation Log\n\n`;

        transcriptMessages.forEach(m => {
            mdContent += `### **${m.author.tag}** _(${moment(m.timestamp).format('YYYY-MM-DD HH:mm:ss')})_\n`;
            mdContent += `> ${m.content ? m.content.replace(/\n/g, '\n> ') : '_(No content)_'}\n\n`;
            if (m.attachments && m.attachments.length > 0) {
                m.attachments.forEach(att => {
                    mdContent += `📁 **Attachment**: [${att.name}](${att.url})\n\n`;
                });
            }
        });

        return {
            type: 'file',
            filename: `transcript-${cleanChannelName}.md`,
            buffer: Buffer.from(mdContent, 'utf-8'),
            url: webUrl
        };
    }

    return {
        type: 'web',
        url: webUrl
    };
};

const db = require('./database');
const moment = require('moment');
const { cleanContent } = require('discord.js');

// Host URL for the transcript page
const WEB_APP_BASE_URL = process.env.TRANSCRIPT_WEB_URL || 'https://default-transcript-host.vercel.app';

/**
 * Formats messages into a JSON structure, saves them to the database, and returns the viewer URL.
 * @param {object} channel - The Discord channel object.
 * @param {object} creator - The ticket creator's user object.
 * @param {object} closer - The member/user who closed the ticket.
 * @param {Array<object>} rawMessages - Array of Message objects from the channel.
 * @param {boolean} isPremium - Whether the guild/user has premium status.
 * @returns {Promise<string>} The public URL for the generated transcript.
 */
module.exports = async (channel, creator, closer, rawMessages, isPremium) => {
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
    
    // Save the raw data JSON file under 'transcripts' in database
    await db.write('transcripts', channel.id, transcriptData); 

    // Return the public URL for the web app or Pterodactyl-hosted page
    return `${WEB_APP_BASE_URL}/transcript/${channel.id}`;
};

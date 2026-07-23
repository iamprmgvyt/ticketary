const { 
    SlashCommandBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    MessageFlags 
} = require('discord.js');
const db = require('./database');
const { t, emojis } = db;
const generateTranscript = require('./transcript');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

// Bot Owner ID loaded from environment
const PREMIUM_USER_ID = process.env.PREMIUM_USER_ID;
const EMBED_COLOR = '#00f0ff'; // Neon Cyan theme
const ERROR_COLOR = '#ff3e3e'; // Premium Red theme

// Helper to get static emoji URLs served from Express web server
const getEmojiURL = (name) => {
    const baseUrl = process.env.TRANSCRIPT_WEB_URL || 'http://localhost:3000';
    return `${baseUrl}/emojis/${name}.png`;
};

// Helper to create standardized embeds
function createEmbed(title, description, options = {}) {
    const embed = new EmbedBuilder()
        .setColor(options.color || EMBED_COLOR)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

    if (options.fields) embed.addFields(options.fields);
    if (options.footer) embed.setFooter(options.footer);
    if (options.author) embed.setAuthor(options.author);
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    return embed;
}

// Helper for error embeds
function errorEmbed(description, clientUser = null) {
    const options = { 
        color: ERROR_COLOR,
        author: clientUser ? { name: 'System Alert', iconURL: clientUser.displayAvatarURL() } : null,
        thumbnail: clientUser ? clientUser.displayAvatarURL() : null
    };
    if (clientUser) {
        options.footer = { text: 'Security Warning', iconURL: clientUser.displayAvatarURL() };
    }
    return createEmbed('An Error Occurred', description, options);
}

// Helper to send response to either Slash/Button Interaction or Prefix Message
async function sendResponse(interaction, payload, isSlash, ephemeral = false) {
    const isInteraction = typeof interaction.reply === 'function';
    if (isInteraction) {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(payload);
        } else {
            return await interaction.reply({ ...payload, ephemeral });
        }
    } else {
        return await interaction.reply(payload);
    }
}

// Helper to fetch messages in batches
const fetchAllMessages = async (channel, limit) => {
    let allMessages = [];
    let lastId = null;
    const batchSize = 100;

    while (allMessages.length < limit) {
        const fetchCount = Math.min(limit - allMessages.length, batchSize);
        if (fetchCount <= 0) break;

        const options = { 
            limit: fetchCount, 
            ...(lastId && { before: lastId }) 
        };

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        allMessages = allMessages.concat(Array.from(messages.values()));
        lastId = messages.last().id;
    }
    return allMessages.slice(0, limit);
};

// Maps for button configurations
const getCategoryStyle = (cat) => {
    const c = cat.toLowerCase();
    if (c.includes('support') || c.includes('hỗ trợ')) return ButtonStyle.Success;
    if (c.includes('billing') || c.includes('payment') || c.includes('nạp') || c.includes('mua')) return ButtonStyle.Primary;
    if (c.includes('bug') || c.includes('lỗi') || c.includes('report')) return ButtonStyle.Danger;
    return ButtonStyle.Secondary;
};

const getCategoryEmoji = (cat) => {
    const c = cat.toLowerCase();
    if (c.includes('support') || c.includes('hỗ trợ')) return emojis.support || '🙋‍♂️';
    if (c.includes('billing') || c.includes('payment') || c.includes('nạp') || c.includes('mua')) return emojis.key || '💳';
    if (c.includes('bug') || c.includes('lỗi') || c.includes('report')) return emojis.error || '🐛';
    return emojis.ticket || '🎫';
};

// Helper for formatting uptime durations
const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    const dDisplay = d > 0 ? d + (d === 1 ? " day, " : " days, ") : "";
    const hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
    const mDisplay = m > 0 ? m + (m === 1 ? " minute, " : " minutes, ") : "";
    const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay || "0 seconds";
};

const commands = {
    // --- PING COMMAND ---
    ping: {
        name: 'ping',
        aliases: ['p'],
        prefix: true,
        slash: true,
        category: 'general',
        description: "Replies with the bot's latency and diagnostics.",
        data: new SlashCommandBuilder()
            .setName('ping')
            .setDescription("Replies with the bot's latency."),
        async execute(interaction, args, isSlash) {
            const latency = Date.now() - (interaction.createdTimestamp || Date.now());
            const apiLatency = Math.round(interaction.client.ws.ping);
            const clientUser = interaction.client.user;

            const embed = createEmbed(
                `${emojis.ping} Pong!`,
                `**Bot Latency:** \`${latency}ms\`\n**API Latency:** \`${apiLatency}ms\``,
                {
                    author: { name: 'Diagnostics Hub', iconURL: clientUser.displayAvatarURL() },
                    thumbnail: clientUser.displayAvatarURL(),
                    footer: { text: 'Ticketary Diagnostics', iconURL: clientUser.displayAvatarURL() }
                }
            );

            await sendResponse(interaction, { embeds: [embed] }, isSlash, true);
        }
    },

    // --- UPTIME COMMAND ---
    uptime: {
        name: 'uptime',
        aliases: ['up'],
        prefix: true,
        slash: true,
        category: 'general',
        description: "Replies with the bot's current online duration.",
        data: new SlashCommandBuilder()
            .setName('uptime')
            .setDescription("Replies with the bot's current online duration."),
        async execute(interaction, args, isSlash) {
            const uptimeString = formatUptime(process.uptime());
            const clientUser = interaction.client.user;
            
            const embed = createEmbed(
                `${emojis.clock} ${t('uptime_title')}`,
                t('uptime_desc', { uptime: uptimeString, status_emoji: emojis.success }),
                {
                    author: { name: 'System Status', iconURL: clientUser.displayAvatarURL() },
                    thumbnail: clientUser.displayAvatarURL(),
                    footer: { text: 'Uptime Logger', iconURL: clientUser.displayAvatarURL() }
                }
            );

            await sendResponse(interaction, { embeds: [embed] }, isSlash, true);
        }
    },

    // --- HELP COMMAND ---
    help: {
        name: 'help',
        aliases: ['commands'],
        prefix: true,
        slash: true,
        category: 'general',
        description: 'Shows the list of all available commands.',
        data: new SlashCommandBuilder()
            .setName('help')
            .setDescription('Shows the list of all available commands.'),
        async execute(interaction, args, isSlash) {
            const clientUser = interaction.client.user;
            const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientUser.id}&permissions=8&scope=bot%20applications.commands`;
            const supportUrl = 'https://discord.gg/invite';
            const webUrl = process.env.TRANSCRIPT_WEB_URL || 'http://localhost:3000';

            const helpEmbed = createEmbed(
                `${emojis.help} Help Menu Dashboard`,
                'Welcome to the **Ticketary Help Center v2**. Click the category buttons below to view specific command groups interactively, or click the links to manage the bot.',
                {
                    author: { name: 'Help Desk v2', iconURL: clientUser.displayAvatarURL() },
                    thumbnail: clientUser.displayAvatarURL(),
                    fields: [
                        { name: `${emojis.star} General Commands`, value: 'Commands for latency, diagnostics, and leaderboard statistics.', inline: true },
                        { name: `${emojis.setup} Setup Panel`, value: 'Commands to configure server staff settings (Admin only).', inline: true },
                        { name: `${emojis.ticket} Ticket Operations`, value: 'Commands for open/close operations and member overrides.', inline: true }
                    ],
                    footer: { text: 'Select a category button below to navigate.', iconURL: clientUser.displayAvatarURL() }
                }
            );

            // Row 1: Interactive Category Buttons
            const categoryRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('help_general')
                    .setLabel('General')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(db.getButtonEmoji(emojis.star)),
                new ButtonBuilder()
                    .setCustomId('help_setup')
                    .setLabel('Setup')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(db.getButtonEmoji(emojis.setup)),
                new ButtonBuilder()
                    .setCustomId('help_tickets')
                    .setLabel('Tickets')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(db.getButtonEmoji(emojis.ticket))
            );

            // Row 2: Link/External Buttons
            const linkRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Invite Bot')
                    .setStyle(ButtonStyle.Link)
                    .setURL(inviteUrl)
                    .setEmoji(db.getButtonEmoji(emojis.plus)),
                new ButtonBuilder()
                    .setLabel('Website')
                    .setStyle(ButtonStyle.Link)
                    .setURL(webUrl)
                    .setEmoji(db.getButtonEmoji(emojis.server))
            );

            await sendResponse(interaction, { 
                embeds: [helpEmbed], 
                components: [categoryRow, linkRow] 
            }, isSlash, false);
        }
    },

    // --- SETUP COMMAND ---
    setup: {
        name: 'setup',
        aliases: ['config'],
        prefix: true,
        slash: true,
        category: 'setup',
        description: 'Launches the interactive setup wizard to configure the ticket system.',
        requiredPermissions: [PermissionFlagsBits.Administrator],
        data: new SlashCommandBuilder()
            .setName('setup')
            .setDescription('Launches the interactive setup wizard to configure the ticket system.')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        async execute(interaction, args, isSlash) {
            const user = interaction.user || interaction.author;
            const guild = interaction.guild;
            const clientUser = interaction.client.user;
            
            // Permissions check
            const member = interaction.member || await guild.members.fetch(user.id);
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                const err = { embeds: [errorEmbed(t('error_no_permission'), clientUser)] };
                return await sendResponse(interaction, err, isSlash, true);
            }

            // Initialize setup state for this user
            const key = `${user.id}_${guild.id}`;
            const state = {
                ticketChannelId: null,
                supportRoleId: null,
                memberClosePermission: null,
                transcriptChannelId: null,
                panelTitle: t('ticket_panel_title') || 'Support Center',
                panelDescription: t('ticket_panel_desc') || 'Click the button below to open a new support ticket.\n\nA staff member will assist you shortly!',
                buttonCategories: ['Support', 'Billing', 'Bugs']
            };
            
            // Store it globally in database module setupState map
            if (!db.setupState) {
                db.setupState = new Map();
            }
            db.setupState.set(key, state);

            // Step 1: select ticket panel channel (Public/non-ephemeral)
            const embed = createEmbed(
                '⚙️ Setup Wizard - Step 1 of 4',
                'Select the text channel where the bot will post the ticket creation panel.'
            );
            const select = new ChannelSelectMenuBuilder()
                .setCustomId('setup_step_1_channel')
                .setPlaceholder('Select ticket panel channel')
                .setChannelTypes([ChannelType.GuildText]);
            const row1 = new ActionRowBuilder().addComponents(select);
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('setup_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji(db.getButtonEmoji(emojis.close))
            );

            await sendResponse(interaction, { embeds: [embed], components: [row1, row2] }, isSlash, false);
        }
    },

    // --- NEW COMMAND ---
    new: {
        name: 'new',
        aliases: ['ticket', 'open'],
        prefix: true,
        slash: true,
        category: 'tickets',
        description: 'Opens a new support ticket channel under a category.',
        data: new SlashCommandBuilder()
            .setName('new')
            .setDescription('Opens a new support ticket channel.')
            .addStringOption(option => 
                option.setName('category')
                    .setDescription('Specify category (e.g. Support, Billing, Bugs).')
                    .setRequired(false)),
        async execute(interaction, args, isSlash) {
            const isInteraction = typeof interaction.reply === 'function';
            if (isInteraction && !interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
            }

            const member = interaction.member;
            const user = interaction.user || interaction.author;
            const guildId = interaction.guildId;
            const clientUser = interaction.client.user;
            const guildConfig = await db.read('guilds', guildId);

            if (!guildConfig) {
                const err = { embeds: [errorEmbed(t('error_not_configured'), clientUser)] };
                return await sendResponse(interaction, err, isSlash, true);
            }

            let selectedCategory = 'Support';
            if (isSlash && interaction.options) {
                selectedCategory = interaction.options.getString('category') || selectedCategory;
            } else if (args.length > 0) {
                selectedCategory = args.join(' ');
            }

            const categoryClean = selectedCategory.toLowerCase().replace(/[^a-z0-9]/g, '');

            const existingTicket = await db.read('tickets', user.id);
            if (existingTicket) {
                const existingChannel = interaction.guild.channels.cache.get(existingTicket.channelId);
                if (existingChannel) {
                    const err = { embeds: [errorEmbed(t('error_already_active', { channel: `<#${existingChannel.id}>` }), clientUser)] };
                    return await sendResponse(interaction, err, isSlash, true);
                } else {
                    await db.delete('tickets', user.id);
                }
            }

            const isGuildPremium = await db.checkPremium(guildId);
            const limitData = await db.getWeeklyLimit(guildId);
            const WEEKLY_TICKET_LIMIT = 100;

            if (!isGuildPremium && limitData.count >= WEEKLY_TICKET_LIMIT) {
                const resetTime = moment(limitData.resetTimestamp).format('LLL');
                const err = { embeds: [errorEmbed(t('error_limit_reached', { limit: WEEKLY_TICKET_LIMIT, reset: resetTime }), clientUser)] };
                return await sendResponse(interaction, err, isSlash, true);
            }

            if (!isGuildPremium) {
                await db.incrementWeeklyLimit(guildId);
            }

            let channelName;
            const shortId = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
            if (isGuildPremium && guildConfig.namePattern) {
                channelName = guildConfig.namePattern
                    .replace(/{user}/g, shortId)
                    .replace(/{id}/g, user.id.substring(0, 4))
                    .replace(/{category}/g, categoryClean);
            } else {
                channelName = `${categoryClean}-${shortId || user.id}`;
            }

            const permissionOverwrites = [
                { id: guildId, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: guildConfig.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ];

            let channel;
            try {
                channel = await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    parent: guildConfig.ticketCategoryId || null,
                    permissionOverwrites: permissionOverwrites
                });
            } catch (error) {
                console.error('❌ Failed to create ticket channel:', error);
                const err = { embeds: [errorEmbed(t('error_channel_create_failed'), clientUser)] };
                return await sendResponse(interaction, err, isSlash, true);
            }

            const ticketData = {
                channelId: channel.id,
                guildId: guildId,
                creatorId: user.id,
                createdAt: new Date().toISOString(),
                isPremium: isGuildPremium,
                claimedBy: null,
                category: selectedCategory
            };
            await db.write('tickets', user.id, ticketData);

            const welcomeEmbed = createEmbed(
                `${emojis.ticket} ${t('ticket_welcome_title', { user: user.username })} [${selectedCategory}]`,
                t('ticket_welcome_desc'),
                {
                    author: { name: `Ticket Opened`, iconURL: user.displayAvatarURL() },
                    thumbnail: clientUser.displayAvatarURL(),
                    fields: [
                        { name: t('ticket_welcome_field_premium'), value: isGuildPremium ? `${emojis.success} Active` : `${emojis.error} Inactive`, inline: true },
                        { name: t('ticket_welcome_field_weekly'), value: isGuildPremium ? t('ticket_welcome_field_unlimited') : `${limitData.count + 1}/${WEEKLY_TICKET_LIMIT}`, inline: true },
                    ],
                    footer: { text: `Ticket ID: ${user.id} • Ticketary`, iconURL: clientUser.displayAvatarURL() }
                }
            );

            const claimButton = new ButtonBuilder()
                .setCustomId('ticket_claim')
                .setLabel(t('ticket_welcome_button_claim'))
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(db.getButtonEmoji(emojis.claim));
                
            const closeButton = new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel(t('ticket_welcome_button_close'))
                .setStyle(ButtonStyle.Danger)
                .setEmoji(db.getButtonEmoji(emojis.close));

            const addButton = new ButtonBuilder()
                .setCustomId('ticket_action_add')
                .setLabel('Add Member')
                .setStyle(ButtonStyle.Primary)
                .setEmoji(db.getButtonEmoji(emojis.plus));

            const removeButton = new ButtonBuilder()
                .setCustomId('ticket_action_remove')
                .setLabel('Remove User')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(db.getButtonEmoji(emojis.close));

            const row = new ActionRowBuilder().addComponents(claimButton, closeButton, addButton, removeButton);

            const welcomeMsg = await channel.send({ 
                content: `<@${user.id}> <@&${guildConfig.supportRoleId}>`, 
                embeds: [welcomeEmbed], 
                components: [row] 
            });

            await welcomeMsg.pin().catch(e => console.error('❌ Failed to pin welcome message:', e.message));

            const replyEmbed = createEmbed(`${emojis.success} ${t('ticket_created_title')}`, t('ticket_created_desc', { channel: `<#${channel.id}>` }), { thumbnail: clientUser.displayAvatarURL() });
            await sendResponse(interaction, { embeds: [replyEmbed] }, isSlash, true);
        }
    },

    // --- CLOSE COMMAND ---
    close: {
        name: 'close',
        aliases: ['c'],
        prefix: true,
        slash: true,
        category: 'tickets',
        description: 'Closes the current ticket channel and logs its transcript.',
        data: new SlashCommandBuilder()
            .setName('close')
            .setDescription('Closes the current ticket channel.'),
        async execute(interaction, args, isSlash) {
            const channel = interaction.channel;
            const user = interaction.user || interaction.author;
            const member = interaction.member;
            const guildId = interaction.guildId;
            const clientUser = interaction.client.user;
            const guildConfig = await db.read('guilds', guildId);

            if (!guildConfig) {
                const err = { embeds: [errorEmbed(t('error_not_configured'), clientUser)] };
                return await sendResponse(interaction, err, isSlash, true);
            }

            const allTickets = await db.read('tickets', null) || {};
            let creatorId = null;
            let ticketData = null;

            for (const [key, val] of Object.entries(allTickets)) {
                if (val.channelId === channel.id) {
                    creatorId = key;
                    ticketData = val;
                    break;
                }
            }

            if (!ticketData) {
                const err = { embeds: [errorEmbed(t('error_not_ticket_channel'), clientUser)] };
                return await sendResponse(interaction, err, isSlash, true);
            }

            const isSupport = member.roles.cache.has(guildConfig.supportRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);
            const isCreator = creatorId === user.id;

            if (!isSupport && !(guildConfig.memberClosePermission && isCreator)) {
                const err = { embeds: [errorEmbed(t('error_close_no_permission'), clientUser)] };
                return await sendResponse(interaction, err, isSlash, true);
            }

            if (isSupport) {
                await db.incrementStaffStats(user.id, 'close', user.tag);
            }

            const closingEmbed = createEmbed(`${emojis.loading} ${t('ticket_closing_title')}`, t('ticket_closing_desc'));
            if (typeof interaction.reply === 'function') {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ embeds: [closingEmbed] });
                } else {
                    await interaction.reply({ embeds: [closingEmbed] });
                }
            } else {
                await channel.send({ embeds: [closingEmbed] });
            }

            const isPremium = (await db.checkPremium(creatorId)) || (await db.checkPremium(guildId));
            const maxMessages = isPremium ? 250 : 100;
            const messages = await fetchAllMessages(channel, maxMessages);

            const creatorUser = await interaction.client.users.fetch(creatorId).catch(() => ({ tag: 'Unknown User#0000', username: 'Unknown User', displayAvatarURL: () => clientUser.displayAvatarURL() }));

            let transcriptURL;
            try {
                transcriptURL = await generateTranscript(channel, creatorUser, user, messages, isPremium);
            } catch (err) {
                console.error('❌ Failed to generate transcript:', err);
                transcriptURL = 'https://error-generating-transcript.com';
            }

            // Log to transcript channel
            const transcriptChannel = channel.guild.channels.cache.get(guildConfig.transcriptChannelId);
            if (transcriptChannel) {
                const logEmbed = createEmbed(
                    `${emojis.ticket} ${t('transcript_log_title')}`,
                    t('transcript_log_desc', { channel: channel.name, user: user.tag }),
                    {
                        author: { name: 'Ticket Archive', iconURL: channel.guild.iconURL() },
                        thumbnail: typeof creatorUser.displayAvatarURL === 'function' ? creatorUser.displayAvatarURL() : clientUser.displayAvatarURL(),
                        fields: [
                            { name: t('transcript_log_field_opened'), value: `<@${creatorId}>`, inline: true },
                            { name: t('transcript_log_field_closed'), value: `<@${user.id}>`, inline: true },
                            { name: t('transcript_log_field_premium'), value: isPremium ? `${emojis.premium} Premium` : `${emojis.star} Free`, inline: true },
                            { name: t('transcript_log_field_count'), value: messages.length.toString(), inline: true },
                            { name: t('transcript_log_field_link'), value: `[${t('transcript_log_link_text')}](${transcriptURL})`, inline: false }
                        ],
                        footer: { text: `Archived • Ticketary`, iconURL: clientUser.displayAvatarURL() }
                    }
                );
                await transcriptChannel.send({ embeds: [logEmbed] }).catch(console.error);
            }

            // DM Creator with transcript link
            try {
                const dmEmbed = createEmbed(
                    `${emojis.key} ${t('transcript_dm_title')}`,
                    t('transcript_dm_desc', { channel: channel.name, guild: channel.guild.name, url: transcriptURL }),
                    {
                        author: { name: 'Transcript Archive', iconURL: clientUser.displayAvatarURL() },
                        thumbnail: clientUser.displayAvatarURL(),
                        footer: { text: 'Ticketary Support', iconURL: clientUser.displayAvatarURL() }
                    }
                );
                const dmChannel = await creatorUser.createDM();
                await dmChannel.send({ embeds: [dmEmbed] });
            } catch (e) {
                console.log(`⚠️ Unable to DM transcript to user ${creatorId}: ${e.message}`);
            }

            await db.delete('tickets', creatorId);
            setTimeout(() => {
                channel.delete('Ticket closed').catch(e => console.error('❌ Channel delete fail:', e));
            }, 5000);
        }
    },

    // --- ADD COMMAND ---
    add: {
        name: 'add',
        aliases: ['adduser'],
        prefix: true,
        slash: true,
        category: 'tickets',
        description: 'Adds a member to the current ticket channel overrides.',
        data: new SlashCommandBuilder()
            .setName('add')
            .setDescription('Adds a member to the current ticket channel.')
            .addUserOption(option => 
                option.setName('user')
                    .setDescription('The member to add.')
                    .setRequired(true)),
        async execute(interaction, args, isSlash) {
            const isInteraction = typeof interaction.reply === 'function';
            if (isInteraction && !interaction.deferred && !interaction.replied) {
                await interaction.deferReply().catch(() => {});
            }

            const channel = interaction.channel;
            const clientUser = interaction.client.user;
            const allTickets = await db.read('tickets', null) || {};
            let isTicket = false;

            for (const val of Object.values(allTickets)) {
                if (val.channelId === channel.id) {
                    isTicket = true;
                    break;
                }
            }

            if (!isTicket) {
                const err = { embeds: [errorEmbed(t('error_not_ticket_channel'), clientUser)] };
                return await sendResponse(interaction, err, isSlash, true);
            }

            let targetUser;
            if (isSlash) {
                targetUser = interaction.options.getUser('user');
            } else {
                if (args.length === 0) {
                    return await sendResponse(interaction, { embeds: [errorEmbed(`${emojis.error} Usage: \`!add <@user>\``, clientUser)] }, isSlash);
                }
                const targetId = args[0].replace(/[^0-9]/g, '');
                targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
            }

            if (!targetUser) {
                return await sendResponse(interaction, { embeds: [errorEmbed(`${emojis.error} Target member not found.`, clientUser)] }, isSlash);
            }

            await channel.permissionOverwrites.create(targetUser.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            const embed = createEmbed(
                `${emojis.plus} Member Added`,
                `Successfully added <@${targetUser.id}> to the ticket channel.`,
                {
                    author: { name: 'Member Overrides', iconURL: clientUser.displayAvatarURL() },
                    thumbnail: targetUser.displayAvatarURL()
                }
            );

            await sendResponse(interaction, { embeds: [embed] }, isSlash);
        }
    },

    // --- REMOVE COMMAND ---
    remove: {
        name: 'remove',
        aliases: ['removeuser'],
        prefix: true,
        slash: true,
        category: 'tickets',
        description: 'Removes a member from the current ticket channel overrides.',
        data: new SlashCommandBuilder()
            .setName('remove')
            .setDescription('Removes a member from the current ticket channel.')
            .addUserOption(option => 
                option.setName('user')
                    .setDescription('The member to remove.')
                    .setRequired(true)),
        async execute(interaction, args, isSlash) {
            const isInteraction = typeof interaction.reply === 'function';
            if (isInteraction && !interaction.deferred && !interaction.replied) {
                await interaction.deferReply().catch(() => {});
            }

            const channel = interaction.channel;
            const clientUser = interaction.client.user;
            const allTickets = await db.read('tickets', null) || {};
            let isTicket = false;

            for (const val of Object.values(allTickets)) {
                if (val.channelId === channel.id) {
                    isTicket = true;
                    break;
                }
            }

            if (!isTicket) {
                const err = { embeds: [errorEmbed(t('error_not_ticket_channel'), clientUser)] };
                return await sendResponse(interaction, err, isSlash, true);
            }

            let targetUser;
            if (isSlash) {
                targetUser = interaction.options.getUser('user');
            } else {
                if (args.length === 0) {
                    return await sendResponse(interaction, { embeds: [errorEmbed(`${emojis.error} Usage: \`!remove <@user>\``, clientUser)] }, isSlash);
                }
                const targetId = args[0].replace(/[^0-9]/g, '');
                targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
            }

            if (!targetUser) {
                return await sendResponse(interaction, { embeds: [errorEmbed(`${emojis.error} Target member not found.`, clientUser)] }, isSlash);
            }

            await channel.permissionOverwrites.delete(targetUser.id);

            const embed = createEmbed(
                `${emojis.close} Member Removed`,
                `Successfully removed <@${targetUser.id}> from the ticket channel.`,
                {
                    author: { name: 'Member Overrides', iconURL: clientUser.displayAvatarURL() },
                    thumbnail: targetUser.displayAvatarURL()
                }
            );

            await sendResponse(interaction, { embeds: [embed] }, isSlash);
        }
    },

    // --- STATS COMMAND ---
    stats: {
        name: 'stats',
        aliases: ['leaderboard', 'top'],
        prefix: true,
        slash: true,
        category: 'general',
        description: 'Displays support staff statistics and ticket metrics.',
        data: new SlashCommandBuilder()
            .setName('stats')
            .setDescription('Displays support staff statistics and ticket metrics.'),
        async execute(interaction, args, isSlash) {
            const isInteraction = typeof interaction.reply === 'function';
            if (isInteraction && !interaction.deferred && !interaction.replied) {
                await interaction.deferReply().catch(() => {});
            }

            const clientUser = interaction.client.user;

            // Load staff leaderboard from database
            const staffData = await db.read('staff', null) || {};
            const leaderboard = Object.entries(staffData)
                .map(([id, val]) => ({ id, ...val }))
                .sort((a, b) => b.claims - a.claims)
                .slice(0, 5);

            let leaderboardText = '*No active claims logged yet.*';
            if (leaderboard.length > 0) {
                leaderboardText = leaderboard.map((s, index) => {
                    const medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : '•'));
                    return `${medal} **${s.username}**: \`${s.claims}\` claims | \`${s.closes}\` closes`;
                }).join('\n');
            }

            // Load ticket counts from MySQL database
            let ticketsClosed = 0;
            let ticketsActive = 0;
            try {
                const [transcriptsRows] = await db.pool.query('SELECT COUNT(*) as count FROM transcripts');
                const [ticketsRows] = await db.pool.query('SELECT COUNT(*) as count FROM tickets');
                ticketsClosed = transcriptsRows[0].count;
                ticketsActive = ticketsRows[0].count;
            } catch (err) {}

            const embed = createEmbed(
                `${emojis.server} Support Statistics & Leaderboard`,
                'Track staff achievements and global metrics for this server.',
                {
                    author: { name: 'Analytics Console', iconURL: clientUser.displayAvatarURL() },
                    thumbnail: clientUser.displayAvatarURL(),
                    fields: [
                        { name: 'Active Tickets', value: `\`${ticketsActive}\` open`, inline: true },
                        { name: 'Total Closed Tickets', value: `\`${ticketsClosed}\` resolved`, inline: true },
                        { name: '\u200B', value: '\u200B', inline: true }, 
                        { name: `${emojis.premium} Staff Leaderboard (Claims)`, value: leaderboardText, inline: false }
                    ],
                    footer: { text: 'Metrics updated in real-time • Ticketary', iconURL: clientUser.displayAvatarURL() }
                }
            );

            await sendResponse(interaction, { embeds: [embed] }, isSlash);
        }
    },

    // --- PREMIUM COMMAND ---
    premium: {
        name: 'premium',
        aliases: ['prem'],
        prefix: false,
        slash: true,
        category: 'setup',
        description: 'Manage premium status for a user or server (OWNER ONLY).',
        data: new SlashCommandBuilder()
            .setName('premium')
            .setDescription('Manage premium status for a user or server (OWNER ONLY).')
            .addStringOption(option =>
                option.setName('action')
                    .setDescription('Action to perform')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Activate Month', value: 'activate_month' },
                        { name: 'Activate Year', value: 'activate_year' },
                        { name: 'Deactivate', value: 'deactivate' }
                    ))
            .addStringOption(option => 
                option.setName('guild_id')
                    .setDescription('Server ID to apply premium status.')
                    .setRequired(false))
            .addUserOption(option =>
                option.setName('user_id')
                    .setDescription('User to apply premium status.')
                    .setRequired(false)),
        async execute(interaction, args, isSlash) {
            const user = interaction.user;
            const clientUser = interaction.client.user;
            if (user.id !== PREMIUM_USER_ID) {
                const err = { embeds: [errorEmbed(t('error_owner_only'), clientUser)] };
                return await sendResponse(interaction, err, isSlash, true);
            }

            const action = interaction.options.getString('action');
            const guildId = interaction.options.getString('guild_id');
            const targetUser = interaction.options.getUser('user_id');

            const targetId = guildId || (targetUser ? targetUser.id : null);
            const targetType = guildId ? 'Server' : (targetUser ? 'User' : null);

            if (!targetId) {
                const err = { embeds: [errorEmbed(t('error_premium_invalid_args'), clientUser)] };
                return await sendResponse(interaction, err, isSlash, true);
            }

            let targetName = targetId;
            if (targetType === 'Server') {
                const guild = interaction.client.guilds.cache.get(guildId);
                if (!guild) {
                    const err = { embeds: [errorEmbed(t('error_premium_guild_not_found', { guildId }), clientUser)] };
                    return await sendResponse(interaction, err, isSlash, true);
                }
                targetName = guild.name;
            } else if (targetUser) {
                targetName = targetUser.tag;
            }

            if (action.startsWith('activate')) {
                const isYear = action === 'activate_year';
                const expiresAt = isYear ? moment().add(1, 'years').toISOString() : moment().add(1, 'months').toISOString();

                const premiumData = {
                    type: targetType,
                    activatedBy: user.tag,
                    activatedAt: moment().toISOString(),
                    expiresAt: expiresAt
                };

                await db.write('premium', targetId, premiumData);

                const embed = createEmbed(
                    `${emojis.premium} ${t('premium_activated_title')}`,
                    t('premium_activated_desc', { type: targetType, name: targetName, id: targetId, time: moment(expiresAt).format('LLL') }),
                    {
                        author: { name: 'Premium Management', iconURL: clientUser.displayAvatarURL() },
                        thumbnail: clientUser.displayAvatarURL()
                    }
                );
                await sendResponse(interaction, { embeds: [embed] }, isSlash, true);
            } else if (action === 'deactivate') {
                await db.delete('premium', targetId);
                const embed = createEmbed(
                    `${emojis.premium} ${t('premium_deactivated_title')}`,
                    t('premium_deactivated_desc', { type: targetType, name: targetName }),
                    {
                        author: { name: 'Premium Management', iconURL: clientUser.displayAvatarURL() },
                        thumbnail: clientUser.displayAvatarURL()
                    }
                );
                await sendResponse(interaction, { embeds: [embed] }, isSlash, true);
            }
        }
    }
};

module.exports = commands;

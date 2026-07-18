const { 
    Events, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    EmbedBuilder,
    UserSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType
} = require('discord.js');
const db = require('./database');
const { t, emojis } = db;
const fs = require('fs');
const path = require('path');

// Dynamic loader for botCommands to support instant hot-reloading
const getCommands = () => require('./botCommands');

const PREFIX = '!';
const ERROR_COLOR = '#ff3e3e';
const EMBED_COLOR = '#00f0ff';

const getEmojiURL = (name) => {
    const baseUrl = process.env.TRANSCRIPT_WEB_URL || 'http://localhost:3000';
    return `${baseUrl}/emojis/${name}.png`;
};

function errorEmbed(description, clientUser = null) {
    const embed = new EmbedBuilder()
        .setColor(ERROR_COLOR)
        .setTitle(`${emojis.error} System Alert`)
        .setDescription(description)
        .setTimestamp();
    if (clientUser) {
        embed.setAuthor({ name: 'System Alert', iconURL: clientUser.displayAvatarURL() });
        embed.setThumbnail(clientUser.displayAvatarURL());
        embed.setFooter({ text: 'Security Warning', iconURL: clientUser.displayAvatarURL() });
    }
    return embed;
}

function createEmbed(title, description, optionsOrUser = null, color = EMBED_COLOR) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

    if (optionsOrUser) {
        if (typeof optionsOrUser.displayAvatarURL === 'function') {
            embed.setFooter({ text: 'Ticketary Support', iconURL: optionsOrUser.displayAvatarURL() });
        } else {
            if (optionsOrUser.color) embed.setColor(optionsOrUser.color);
            if (optionsOrUser.fields) embed.addFields(optionsOrUser.fields);
            if (optionsOrUser.footer) embed.setFooter(optionsOrUser.footer);
            if (optionsOrUser.author) embed.setAuthor(optionsOrUser.author);
            if (optionsOrUser.thumbnail) embed.setThumbnail(optionsOrUser.thumbnail);
            if (optionsOrUser.image) embed.setImage(optionsOrUser.image);
        }
    }
    return embed;
}

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

/**
 * Automatically compiles all commands matching a specific category for dynamic help lists
 */
const buildHelpCategoryDesc = (category) => {
    const list = Object.values(getCommands()).filter(cmd => cmd.category === category);
    if (list.length === 0) return '*No commands in this category.*';
    
    return list.map(cmd => {
        const desc = cmd.description || cmd.data?.description || 'No description provided.';
        const aliasesText = cmd.aliases && cmd.aliases.length > 0 ? ` (aliases: !${cmd.aliases.join(', !')})` : '';
        return `• \`/${cmd.name}\` or \`!${cmd.name}\`${aliasesText}\n└ ${desc}`;
    }).join('\n');
};

/**
 * Helper to get or create setup state
 */
const getSetupState = (userId, guildId) => {
    const key = `${userId}_${guildId}`;
    if (!db.setupState) {
        db.setupState = new Map();
    }
    return db.setupState.get(key);
};

/**
 * Render any of the 4 Setup Wizard steps dynamically with consistent Back / Cancel / Next buttons
 */
const renderSetupStep = async (interaction, state, step) => {
    const clientUser = interaction.client.user;
    let title = '';
    let description = '';
    let components = [];

    if (step === 1) {
        title = '⚙️ Setup Wizard - Step 1 of 4';
        description = 'Select the text channel where the bot will post the ticket creation panel.';
        if (state.ticketChannelId) {
            description += `\n\n*Current selection: <#${state.ticketChannelId}>*`;
        }
        
        const select = new ChannelSelectMenuBuilder()
            .setCustomId('setup_step_1_channel')
            .setPlaceholder('Select ticket panel channel')
            .setChannelTypes([ChannelType.GuildText]);
            
        const row1 = new ActionRowBuilder().addComponents(select);
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji(db.getButtonEmoji(emojis.close)),
            new ButtonBuilder().setCustomId('setup_next_to_2').setLabel('Next ➡️').setStyle(ButtonStyle.Primary).setDisabled(!state.ticketChannelId)
        );
        components = [row1, row2];
    }
    
    else if (step === 2) {
        title = '⚙️ Setup Wizard - Step 2 of 4';
        description = 'Select the role representing your support team. Members with this role can claim and close tickets.';
        if (state.supportRoleId) {
            description += `\n\n*Current selection: <@&${state.supportRoleId}>*`;
        }
        
        const select = new RoleSelectMenuBuilder()
            .setCustomId('setup_step_2_role')
            .setPlaceholder('Select support team role');
            
        const row1 = new ActionRowBuilder().addComponents(select);
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup_back_to_1').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('setup_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji(db.getButtonEmoji(emojis.close)),
            new ButtonBuilder().setCustomId('setup_next_to_3').setLabel('Next ➡️').setStyle(ButtonStyle.Primary).setDisabled(!state.supportRoleId)
        );
        components = [row1, row2];
    }
    
    else if (step === 3) {
        title = '⚙️ Setup Wizard - Step 3 of 4';
        description = 'Should regular members (ticket creators) be allowed to close their own tickets?';
        if (state.memberClosePermission !== null) {
            description += `\n\n*Current selection: ${state.memberClosePermission ? 'Yes, allow' : 'No, staff only'}*`;
        }
        
        const yesStyle = state.memberClosePermission === true ? ButtonStyle.Success : ButtonStyle.Secondary;
        const noStyle = state.memberClosePermission === false ? ButtonStyle.Danger : ButtonStyle.Secondary;
        
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup_step_3_yes').setLabel('Yes, allow').setStyle(yesStyle).setEmoji(db.getButtonEmoji(emojis.success)),
            new ButtonBuilder().setCustomId('setup_step_3_no').setLabel('No, staff only').setStyle(noStyle).setEmoji(db.getButtonEmoji(emojis.error))
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup_back_to_2').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('setup_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji(db.getButtonEmoji(emojis.close)),
            new ButtonBuilder().setCustomId('setup_next_to_4').setLabel('Next ➡️').setStyle(ButtonStyle.Primary).setDisabled(state.memberClosePermission === null)
        );
        components = [row1, row2];
    }
    
    else if (step === 4) {
        title = '⚙️ Setup Wizard - Step 4 of 4';
        description = 'Select the text channel where ticket transcripts will be archived.';
        if (state.transcriptChannelId) {
            description += `\n\n*Current selection: <#${state.transcriptChannelId}>*`;
        }
        
        const select = new ChannelSelectMenuBuilder()
            .setCustomId('setup_step_4_transcript')
            .setPlaceholder('Select transcript channel')
            .setChannelTypes([ChannelType.GuildText]);
            
        const row1 = new ActionRowBuilder().addComponents(select);
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('setup_back_to_3').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('setup_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji(db.getButtonEmoji(emojis.close)),
            new ButtonBuilder().setCustomId('setup_next_to_dash').setLabel('Next ➡️').setStyle(ButtonStyle.Primary).setDisabled(!state.transcriptChannelId)
        );
        components = [row1, row2];
    }

    const embed = createEmbed(title, description, clientUser);
    
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components });
    } else {
        await interaction.update({ embeds: [embed], components });
    }
};

/**
 * Render the main Setup Wizard Dashboard
 */
const showSetupDashboard = async (interaction, state) => {
    const clientUser = interaction.client.user;
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('⚙️ Setup Wizard - Configuration Dashboard')
        .setDescription('Review your settings. You can edit optional settings below or deploy the ticket panel immediately.')
        .addFields([
            { name: 'Ticket Channel', value: `<#${state.ticketChannelId}>`, inline: true },
            { name: 'Support Role', value: `<@&${state.supportRoleId}>`, inline: true },
            { name: 'Member Close Allowed', value: state.memberClosePermission ? `${emojis.success} Yes` : `${emojis.error} No`, inline: true },
            { name: 'Transcript Channel', value: `<#${state.transcriptChannelId}>`, inline: true },
            { name: 'Panel Title', value: state.panelTitle, inline: true },
            { name: 'Panel Description', value: state.panelDescription, inline: false },
            { name: 'Button Categories', value: state.buttonCategories.join(', '), inline: true }
        ])
        .setTimestamp()
        .setFooter({ text: 'Ticketary Setup Wizard', iconURL: clientUser.displayAvatarURL() });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_back_to_4').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('setup_finish').setLabel('Save & Deploy Panel').setStyle(ButtonStyle.Success).setEmoji(db.getButtonEmoji(emojis.success)),
        new ButtonBuilder().setCustomId('setup_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji(db.getButtonEmoji(emojis.close))
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup_opt_title').setLabel('Edit Title').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
        new ButtonBuilder().setCustomId('setup_opt_desc').setLabel('Edit Description').setStyle(ButtonStyle.Primary).setEmoji('📝'),
        new ButtonBuilder().setCustomId('setup_opt_cats').setLabel('Edit Categories').setStyle(ButtonStyle.Primary).setEmoji('🏷️')
    );

    if (interaction.isModalSubmit()) {
        await interaction.update({ embeds: [embed], components: [row1, row2] });
    } else {
        await interaction.update({ embeds: [embed], components: [row1, row2] });
    }
};

/**
 * Automatically uploads missing bot emojis to the guild if permissions allow.
 */
const ensureGuildEmojis = async (guild) => {
    try {
        const clientMember = guild.members.me || await guild.members.fetch(guild.client.user.id).catch(() => null);
        if (!clientMember) return;

        // Check if bot has Manage Guild Expressions / Manage Emojis and Stickers permission
        const hasPermission = clientMember.permissions.has(PermissionFlagsBits.ManageGuildExpressions) || 
                              clientMember.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers) ||
                              clientMember.permissions.has(PermissionFlagsBits.Administrator);
        if (!hasPermission) {
            return;
        }

        const requiredEmojis = ['ticket', 'key', 'claim', 'close', 'success', 'error', 'loading', 'premium', 'star', 'ping', 'help', 'setup', 'plus', 'info', 'clock', 'server', 'support'];
        
        // Fetch current guild emojis
        const existingEmojis = await guild.emojis.fetch().catch(() => guild.emojis.cache);

        for (const name of requiredEmojis) {
            const hasEmoji = existingEmojis.some(e => e.name.toLowerCase() === name.toLowerCase());
            if (!hasEmoji) {
                const filePath = path.resolve(__dirname, 'emoji_pack', `${name}.png`);
                if (fs.existsSync(filePath)) {
                    try {
                        await guild.emojis.create({ attachment: filePath, name: name });
                        console.log(`🤖 Auto-uploaded emoji "${name}" to guild "${guild.name}"`);
                    } catch (err) {
                        console.error(`❌ Failed to auto-upload emoji "${name}" to "${guild.name}":`, err.message);
                    }
                }
            }
        }
    } catch (err) {
        console.error(`❌ Error in ensureGuildEmojis for "${guild.name}":`, err.message);
    }
};

module.exports = (client) => {
    // --- 1. READY EVENT ---
    client.once(Events.ClientReady, async () => {
        console.log(`✅ Logged in as ${client.user.tag}!`);

        client.user.setPresence({
            activities: [{ name: 'ticket support', type: 3 }], 
            status: 'online',
        });

        // Run auto-upload check for all guilds on start
        client.guilds.cache.forEach(guild => {
            ensureGuildEmojis(guild).catch(err => console.error(`Error checking emojis on ready for ${guild.name}:`, err));
        });

        try {
            const slashCommandsJSON = Object.values(getCommands())
                .filter(cmd => cmd.slash && cmd.data)
                .map(cmd => cmd.data.toJSON());

            console.log('🔄 Registering application slash commands...');
            await client.rest.put(`/applications/${client.user.id}/commands`, { body: slashCommandsJSON });
            console.log('✅ Successfully registered application commands globally.');
        } catch (error) {
            console.error('❌ Failed to register application commands:', error);
        }
    });

    // --- Guild Join Event ---
    client.on(Events.GuildCreate, async (guild) => {
        console.log(`🤖 Bot joined guild: ${guild.name}`);
        ensureGuildEmojis(guild).catch(err => console.error(`Error checking emojis on guildCreate for ${guild.name}:`, err));
    });

    // --- 2. MESSAGE CREATE EVENT (Prefix Commands) ---
    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot || !message.content.startsWith(PREFIX) || !message.guild) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = Object.values(getCommands()).find(cmd => 
            cmd.name === commandName || (cmd.aliases && cmd.aliases.includes(commandName))
        );

        if (!command || !command.prefix) return;

        if (command.requiredPermissions) {
            if (!message.member.permissions.has(command.requiredPermissions)) {
                return message.reply({ 
                    embeds: [errorEmbed(t('error_no_permission'), client.user)],
                }).catch(() => {});
            }
        }

        try {
            await command.execute(message, args, false);
        } catch (error) {
            console.error(`❌ Prefix Command Error (${commandName}):`, error);
            message.reply({ 
                embeds: [errorEmbed(t('error_no_permission').split('.')[0] + ' Error', client.user)] 
            }).catch(() => {});
        }
    });

    // --- 3. INTERACTION CREATE EVENT ---
    client.on(Events.InteractionCreate, async (interaction) => {
        const clientUser = client.user;
        const guild = interaction.guild;
        
        // Auto check/upload emojis asynchronously on interaction
        if (guild) {
            ensureGuildEmojis(guild).catch(() => {});
        }

        // Handle Modal Submissions for Setup Options
        if (interaction.isModalSubmit()) {
            const customId = interaction.customId;
            const state = getSetupState(interaction.user.id, guild.id);
            if (!state) return;

            if (customId === 'setup_modal_title') {
                state.panelTitle = interaction.fields.getTextInputValue('input_title');
                await showSetupDashboard(interaction, state);
            }
            else if (customId === 'setup_modal_desc') {
                state.panelDescription = interaction.fields.getTextInputValue('input_desc');
                await showSetupDashboard(interaction, state);
            }
            else if (customId === 'setup_modal_cats') {
                const rawCats = interaction.fields.getTextInputValue('input_cats');
                state.buttonCategories = rawCats.split(',')
                    .map(c => c.trim())
                    .filter(c => c.length > 0)
                    .slice(0, 5);
                await showSetupDashboard(interaction, state);
            }
            return;
        }
        
        // Handle User / Channel / Role Select Menu Interactions
        if (interaction.isUserSelectMenu() || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
            const customId = interaction.customId;
            const channel = interaction.channel;
            const state = getSetupState(interaction.user.id, guild.id);

            // A. Setup Step 1 (Channel Select)
            if (customId === 'setup_step_1_channel') {
                if (!state) return;
                state.ticketChannelId = interaction.values[0];
                return await renderSetupStep(interaction, state, 2);
            }

            // B. Setup Step 2 (Role Select)
            else if (customId === 'setup_step_2_role') {
                if (!state) return;
                state.supportRoleId = interaction.values[0];
                return await renderSetupStep(interaction, state, 3);
            }

            // C. Setup Step 4 (Transcript Channel Select)
            else if (customId === 'setup_step_4_transcript') {
                if (!state) return;
                state.transcriptChannelId = interaction.values[0];
                return await showSetupDashboard(interaction, state);
            }

            // D. Ticket Action: Select User to Add
            else if (customId === 'ticket_select_add') {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});
                }

                const allTickets = await db.read('tickets', null) || {};
                let creatorId = null;
                for (const [key, val] of Object.entries(allTickets)) {
                    if (val.channelId === channel.id) {
                        creatorId = key;
                        break;
                    }
                }

                if (!creatorId) {
                    return await interaction.editReply({ embeds: [errorEmbed(t('error_not_ticket_channel'), clientUser)], components: [] });
                }

                const targetUser = interaction.users.first();
                if (!targetUser) {
                    return await interaction.editReply({ content: 'No user selected.', components: [] });
                }

                await channel.permissionOverwrites.create(targetUser.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                const embed = createEmbed(
                    `${emojis.plus} Member Added`,
                    `Successfully added <@${targetUser.id}> to the ticket channel.`,
                    clientUser
                ).setThumbnail(targetUser.displayAvatarURL());

                await interaction.editReply({ content: 'Member added successfully!', components: [] });
                await channel.send({ embeds: [embed] });
            }

            // E. Ticket Action: Select User to Remove
            else if (customId === 'ticket_select_remove') {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});
                }

                const allTickets = await db.read('tickets', null) || {};
                let creatorId = null;
                for (const [key, val] of Object.entries(allTickets)) {
                    if (val.channelId === channel.id) {
                        creatorId = key;
                        break;
                    }
                }

                if (!creatorId) {
                    return await interaction.editReply({ embeds: [errorEmbed(t('error_not_ticket_channel'), clientUser)], components: [] });
                }

                const targetUser = interaction.users.first();
                if (!targetUser) {
                    return await interaction.editReply({ content: 'No user selected.', components: [] });
                }

                if (targetUser.id === creatorId) {
                    return await interaction.editReply({ content: '❌ You cannot remove the ticket creator.', components: [] });
                }
                if (targetUser.id === clientUser.id) {
                    return await interaction.editReply({ content: '❌ You cannot remove the bot itself.', components: [] });
                }

                // Explicit block (Deny view channel permissions) instead of deleting override
                await channel.permissionOverwrites.create(targetUser.id, {
                    ViewChannel: false,
                    SendMessages: false
                });

                const embed = createEmbed(
                    `${emojis.close} Member Removed`,
                    `Successfully removed <@${targetUser.id}> from the ticket channel.`,
                    clientUser
                ).setThumbnail(targetUser.displayAvatarURL());

                await interaction.editReply({ content: 'Member removed successfully!', components: [] });
                await channel.send({ embeds: [embed] });
            }
            return;
        }

        // Handle Slash Commands
        if (interaction.isChatInputCommand()) {
            const command = getCommands()[interaction.commandName];
            if (!command || !command.slash) return;

            try {
                await command.execute(interaction, [], true);
            } catch (error) {
                console.error(`❌ Slash Command Error (${interaction.commandName}):`, error);
                const replyData = { embeds: [errorEmbed(t('error_no_permission').split('.')[0] + ' Error', clientUser)] };
                
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(replyData).catch(() => {});
                } else {
                    await interaction.reply({ ...replyData, ephemeral: true }).catch(() => {});
                }
            }
        }

        // Handle Button Clicks
        else if (interaction.isButton()) {
            const customId = interaction.customId;
            const guildId = interaction.guildId;
            const member = interaction.member;
            const state = getSetupState(interaction.user.id, guildId);

            // A. Setup Step 3 (Yes / No close permission)
            if (customId === 'setup_step_3_yes' || customId === 'setup_step_3_no') {
                if (!state) return;
                state.memberClosePermission = customId === 'setup_step_3_yes';
                return await renderSetupStep(interaction, state, 4);
            }

            // B. Setup Navigation Pages (Back / Next)
            else if (customId === 'setup_back_to_1') {
                if (!state) return;
                return await renderSetupStep(interaction, state, 1);
            }
            else if (customId === 'setup_back_to_2') {
                if (!state) return;
                return await renderSetupStep(interaction, state, 2);
            }
            else if (customId === 'setup_back_to_3') {
                if (!state) return;
                return await renderSetupStep(interaction, state, 3);
            }
            else if (customId === 'setup_back_to_4') {
                if (!state) return;
                return await renderSetupStep(interaction, state, 4);
            }
            else if (customId === 'setup_next_to_2') {
                if (!state) return;
                return await renderSetupStep(interaction, state, 2);
            }
            else if (customId === 'setup_next_to_3') {
                if (!state) return;
                return await renderSetupStep(interaction, state, 3);
            }
            else if (customId === 'setup_next_to_4') {
                if (!state) return;
                return await renderSetupStep(interaction, state, 4);
            }
            else if (customId === 'setup_next_to_dash') {
                if (!state) return;
                return await showSetupDashboard(interaction, state);
            }

            // C. Setup Option Modals trigger
            else if (customId === 'setup_opt_title') {
                if (!state) return;
                const modal = new ModalBuilder().setCustomId('setup_modal_title').setTitle('Edit Panel Title');
                const input = new TextInputBuilder().setCustomId('input_title').setLabel('Custom Title').setStyle(TextInputStyle.Short).setValue(state.panelTitle).setMaxLength(100).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return await interaction.showModal(modal);
            }
            else if (customId === 'setup_opt_desc') {
                if (!state) return;
                const modal = new ModalBuilder().setCustomId('setup_modal_desc').setTitle('Edit Panel Description');
                const input = new TextInputBuilder().setCustomId('input_desc').setLabel('Custom Description').setStyle(TextInputStyle.Paragraph).setValue(state.panelDescription).setMaxLength(1000).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return await interaction.showModal(modal);
            }
            else if (customId === 'setup_opt_cats') {
                if (!state) return;
                const modal = new ModalBuilder().setCustomId('setup_modal_cats').setTitle('Edit Button Categories');
                const input = new TextInputBuilder().setCustomId('input_cats').setLabel('Categories (comma-separated)').setStyle(TextInputStyle.Short).setValue(state.buttonCategories.join(', ')).setMaxLength(100).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return await interaction.showModal(modal);
            }

            // D. Setup Finish (Save & Deploy)
            else if (customId === 'setup_finish') {
                if (!state) return;
                
                const ticketChannel = guild.channels.cache.get(state.ticketChannelId);
                if (ticketChannel) {
                    const embed = createEmbed(
                        state.panelTitle,
                        state.panelDescription,
                        {
                            author: { name: 'Support Operations Center', iconURL: clientUser.displayAvatarURL() },
                            thumbnail: guild.iconURL(),
                            footer: { text: t('ticket_panel_footer'), iconURL: clientUser.displayAvatarURL() }
                        }
                    );

                    const buttonRow = new ActionRowBuilder();
                    state.buttonCategories.forEach(cat => {
                        buttonRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`ticket_new_${cat.toLowerCase().replace(/[^a-z0-9]/g, '')}`)
                                .setLabel(cat)
                                .setStyle(getCategoryStyle(cat))
                                .setEmoji(db.getButtonEmoji(getCategoryEmoji(cat)))
                        );
                    });

                    // Remove old panel if it exists
                    const existingConfig = await db.read('guilds', guildId);
                    if (existingConfig && existingConfig.panelMessageId && existingConfig.ticketChannelId === state.ticketChannelId) {
                        ticketChannel.messages.fetch(existingConfig.panelMessageId)
                            .then(m => m.delete().catch(() => {}))
                            .catch(() => {});
                    }

                    const panelMessage = await ticketChannel.send({ embeds: [embed], components: [buttonRow] })
                        .catch(e => console.error('❌ Failed to post panel message:', e));

                    if (panelMessage) {
                        state.panelMessageId = panelMessage.id;
                    }
                }

                // Save to database
                await db.write('guilds', guildId, {
                    ticketChannelId: state.ticketChannelId,
                    supportRoleId: state.supportRoleId,
                    memberClosePermission: state.memberClosePermission,
                    transcriptChannelId: state.transcriptChannelId,
                    panelTitle: state.panelTitle,
                    panelDescription: state.panelDescription,
                    buttonCategories: state.buttonCategories,
                    panelMessageId: state.panelMessageId,
                    setupBy: interaction.user.tag,
                    setupAt: new Date().toISOString()
                });

                // Clear temporary state
                db.setupState.delete(`${interaction.user.id}_${guildId}`);

                // Ephemeral response to acknowledge interaction
                await interaction.reply({ content: '✅ Ticket panel successfully deployed!', ephemeral: true }).catch(() => {});

                // Auto-delete the setup wizard message
                await interaction.message.delete().catch(() => {});
                return;
            }

            // E. Setup Cancel
            else if (customId === 'setup_cancel') {
                if (db.setupState) {
                    db.setupState.delete(`${interaction.user.id}_${guildId}`);
                }
                const cancelEmbed = createEmbed(
                    `${emojis.close} Setup Cancelled`,
                    'The setup wizard was cancelled and no changes were saved.'
                );
                return await interaction.update({ embeds: [cancelEmbed], components: [] });
            }

            // F. Interactive Help category buttons
            else if (customId.startsWith('help_')) {
                const categoryKey = customId.replace('help_', ''); // 'general', 'setup', or 'tickets'
                let categoryName = 'General';
                let emoji = emojis.star;
                if (categoryKey === 'setup') {
                    categoryName = 'Setup';
                    emoji = emojis.setup;
                } else if (categoryKey === 'tickets') {
                    categoryName = 'Ticket';
                    emoji = emojis.ticket;
                }

                const desc = buildHelpCategoryDesc(categoryKey);
                
                const helpEmbed = createEmbed(
                    `${emoji} Help Desk - ${categoryName} Commands`,
                    desc,
                    clientUser
                );

                return await interaction.update({ embeds: [helpEmbed] });
            }

            const guildConfig = await db.read('guilds', guildId);
            if (!guildConfig) {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ embeds: [errorEmbed(t('error_not_configured'), clientUser)], ephemeral: true }).catch(() => {});
                }
                return;
            }

            const isSupport = member.roles.cache.has(guildConfig.supportRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);

            // A. Button 'Create Ticket' with Categories (ticket_new_...)
            if (customId.startsWith('ticket_new')) {
                if (interaction.channelId !== guildConfig.ticketChannelId) {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ embeds: [errorEmbed(t('error_invalid_setup_ids'), clientUser)], ephemeral: true }).catch(() => {});
                    }
                    return;
                }

                const cleanSuffix = customId.replace('ticket_new_', '');
                let matchedCategory = 'Support';
                if (guildConfig.buttonCategories && Array.isArray(guildConfig.buttonCategories)) {
                    const found = guildConfig.buttonCategories.find(cat => 
                        cat.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanSuffix
                    );
                    if (found) matchedCategory = found;
                }

                try {
                    await getCommands().new.execute(interaction, [matchedCategory], true);
                } catch (err) {
                    console.error('❌ Error creating ticket via button:', err);
                }
                return;
            }

            // B. Ticket Channel Buttons (Claim / Close / Add Member / Remove Member)
            const allTickets = await db.read('tickets', null) || {};
            let creatorId = null;
            let ticketData = null;

            for (const [key, val] of Object.entries(allTickets)) {
                if (val.channelId === interaction.channelId) {
                    creatorId = key;
                    ticketData = val;
                    break;
                }
            }

            if (!ticketData) {
                if (customId === 'ticket_claim' || customId === 'ticket_close' || customId === 'ticket_action_add' || customId === 'ticket_action_remove') {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ embeds: [errorEmbed(t('error_not_ticket_channel'), clientUser)], ephemeral: true }).catch(() => {});
                    }
                }
                return;
            }

            // Handle Add Member Button
            if (customId === 'ticket_action_add') {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});
                }

                const isCreator = creatorId === member.id;
                if (!isSupport && !isCreator) {
                    return await interaction.editReply({ embeds: [errorEmbed(t('error_no_permission'), clientUser)] });
                }

                const userSelect = new UserSelectMenuBuilder()
                    .setCustomId('ticket_select_add')
                    .setPlaceholder('Select a member to add')
                    .setMinValues(1)
                    .setMaxValues(1);

                const selectRow = new ActionRowBuilder().addComponents(userSelect);
                await interaction.editReply({
                    content: 'Select a member you want to add to this ticket:',
                    components: [selectRow]
                });
                return;
            }

            // Handle Remove Member Button
            else if (customId === 'ticket_action_remove') {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});
                }

                const isCreator = creatorId === member.id;
                if (!isSupport && !isCreator) {
                    return await interaction.editReply({ embeds: [errorEmbed(t('error_no_permission'), clientUser)] });
                }

                const userSelect = new UserSelectMenuBuilder()
                    .setCustomId('ticket_select_remove')
                    .setPlaceholder('Select a member to remove')
                    .setMinValues(1)
                    .setMaxValues(1);

                const selectRow = new ActionRowBuilder().addComponents(userSelect);
                await interaction.editReply({
                    content: 'Select a member you want to remove from this ticket:',
                    components: [selectRow]
                });
                return;
            }

            // Handle Claim Button
            else if (customId === 'ticket_claim') {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});
                }

                if (!isSupport) {
                    return await interaction.editReply({ embeds: [errorEmbed(t('error_close_no_permission'), clientUser)] });
                }

                if (ticketData.claimedBy) {
                    return await interaction.editReply({ embeds: [errorEmbed(t('error_already_active').replace('{channel}', `<@${ticketData.claimedBy}>`), clientUser)] });
                }

                ticketData.claimedBy = member.id;
                await db.write('tickets', creatorId, ticketData);

                // Increment staff claim counter
                await db.incrementStaffStats(member.id, 'claim', member.user.tag);

                const rawComponents = interaction.message.components[0]?.components;
                if (!rawComponents || rawComponents.length === 0) {
                    return await interaction.editReply({ embeds: [errorEmbed(t('error_not_ticket_channel'), clientUser)] });
                }

                const claimedButton = new ButtonBuilder()
                    .setCustomId('ticket_claimed')
                    .setLabel(t('ticket_welcome_button_claimed'))
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
                    .setEmoji(db.getButtonEmoji(emojis.success));

                const closeButtonData = rawComponents[1];
                const closeButton = new ButtonBuilder()
                    .setCustomId(closeButtonData?.custom_id || 'ticket_close')
                    .setStyle(closeButtonData?.style || ButtonStyle.Danger)
                    .setLabel(t('ticket_welcome_button_close'))
                    .setEmoji(db.getButtonEmoji(closeButtonData?.emoji || emojis.close));

                const addButtonData = rawComponents[2];
                const addButton = new ButtonBuilder()
                    .setCustomId(addButtonData?.custom_id || 'ticket_action_add')
                    .setStyle(addButtonData?.style || ButtonStyle.Primary)
                    .setLabel('Add Member')
                    .setEmoji(db.getButtonEmoji(addButtonData?.emoji || emojis.plus));

                const removeButtonData = rawComponents[3];
                const removeButton = new ButtonBuilder()
                    .setCustomId(removeButtonData?.custom_id || 'ticket_action_remove')
                    .setStyle(removeButtonData?.style || ButtonStyle.Secondary)
                    .setLabel('Remove User')
                    .setEmoji(db.getButtonEmoji(removeButtonData?.emoji || emojis.close));

                const row = new ActionRowBuilder().addComponents(claimedButton, closeButton, addButton, removeButton);
                await interaction.message.edit({ components: [row] }).catch(console.error);

                const claimNotification = createEmbed(
                    `${emojis.claim} ${t('ticket_claimed_title')}`,
                    t('ticket_claimed_desc', { user: `<@${member.id}>` }),
                    clientUser
                )
                .setAuthor({ name: 'Ticket Claimed', iconURL: clientUser.displayAvatarURL() })
                .setThumbnail(clientUser.displayAvatarURL());
                
                await interaction.editReply({ embeds: [claimNotification] });
                
                await interaction.channel.send({ 
                    embeds: [createEmbed(t('ticket_claimed_title'), t('ticket_claimed_notification', { user: `<@${member.id}>` }), clientUser)] 
                }).catch(() => {});
            }

            // Handle Close Button
            else if (customId === 'ticket_close') {
                try {
                    await getCommands().close.execute(interaction, [], true);
                } catch (err) {
                    console.error('❌ Error closing ticket via button:', err);
                }
            }
        }
    });
};

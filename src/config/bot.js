import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import botConfig, { getColor } from '../config/botConfig.js'; // Adjust this path to your botConfig file location

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays all available commands categorized by features.'),

    async execute(interaction) {
        // 1. Fetch all registered client commands
        const commands = interaction.client.commands;
        
        // 2. Map commands into categories based on your config features
        const categories = {};
        
        commands.forEach(cmd => {
            // Assumes your command files have a 'category' property (e.g., category: 'economy')
            // Fallback to 'utility' if a category isn't specified
            const category = cmd.category || 'utility'; 
            
            // Only include the command if the feature is enabled in botConfig
            if (botConfig.features[category] !== false) {
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push(cmd);
            }
        });

        const categoryKeys = Object.keys(categories);

        // Fallback if no commands are available/enabled
        if (categoryKeys.length === 0) {
            return interaction.reply({
                content: botConfig.messages.commandDisabled || "No commands are currently available.",
                ephemeral: true
            });
        }

        // 3. Helper function to generate an embed for a specific category page
        const generateEmbed = (pageIndex) => {
            const currentCategory = categoryKeys[pageIndex];
            const cmdList = categories[currentCategory];
            
            // Format category name (e.g., "joinToCreate" -> "Join To Create")
            const formattedCategoryName = currentCategory
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());

            const embed = new EmbedBuilder()
                .setTitle(`🤖 ${botConfig.embeds.footer.text} - Help Menu`)
                .setDescription(`Showing commands for the **${formattedCategoryName}** module.\nUse the buttons below to flip pages.`)
                // Dynamically grabs a custom color from your config palette if it exists, otherwise falls back to primary
                .setColor(getColor(`embeds.colors.${currentCategory}`, getColor('primary')))
                .setFooter({ 
                    text: `${botConfig.embeds.footer.text} • Page ${pageIndex + 1} of ${categoryKeys.length}`, 
                    iconURL: botConfig.embeds.footer.icon || undefined 
                })
                .setTimestamp();

            // Append commands as embed fields
            cmdList.forEach(cmd => {
                const prefix = botConfig.commands.prefix;
                const slashFormat = `\`/${cmd.data.name}\``;
                const prefixFormat = `\`${prefix}${cmd.data.name}\``;
                
                embed.addFields({
                    name: `${slashFormat} or ${prefixFormat}`,
                    value: cmd.data.description || "No description provided.",
                    inline: false
                });
            });

            return embed;
        };

        // 4. Set up interactive pagination navigation buttons
        let currentPage = 0;
        
        const getRow = (pageIndex) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('◀ Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === 0),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next ▶')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(pageIndex === categoryKeys.length - 1)
            );
        };

        // Send the initial first page embed
        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: categoryKeys.length > 1 ? [getRow(currentPage)] : [],
            ephemeral: true // Kept private to the user to avoid channel text clutter
        });

        // If there's only one category enabled, we don't need an interactive button collector
        if (categoryKeys.length <= 1) return;

        // 5. Create a component collector to catch button presses
        const collector = response.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60000 // UI stops listening after 60 seconds of inactivity
        });

        collector.on('collect', async (i) => {
            if (i.customId === 'prev_page') {
                currentPage--;
            } else if (i.customId === 'next_page') {
                currentPage++;
            }

            // Update embed and shift button disabled states
            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [getRow(currentPage)]
            });
        });

        // Disable buttons when the 60-second interaction window expires
        collector.on('end', async () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev').setLabel('◀ Previous').setStyle(ButtonStyle.Primary).setDisabled(true),
                new ButtonBuilder().setCustomId('next').setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(true)
            );
            await interaction.editReply({ components: [disabledRow] }).catch(() => null);
        });
    }
};

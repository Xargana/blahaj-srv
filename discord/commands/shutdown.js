const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shutdown')
        .setDescription('Shuts down the bot gracefully')
        .setDefaultMemberPermissions(0), // Restricts to administrators only
    
    async execute(interaction) {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return await interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true
            });
        }

        await interaction.reply({
            content: 'Shutting down the bot. Goodbye!',
            ephemeral: true
        });

        // Trigger the shutdown process
        console.log(`Manual shutdown triggered by ${interaction.user.tag}`);
        
        // Give Discord API time to send the reply
        setTimeout(async () => {
            try {
                // Get the bot instance
                const bot = interaction.client;
                
                // Use the existing shutdown mechanism
                await bot.sendShutdownNotification(`Manual shutdown triggered by ${interaction.user.tag}`);
                await bot.stop();
            } catch (error) {
                console.error('Error during shutdown command:', error);
            } finally {
                process.exit(0);
            }
        }, 1000);
    },
};
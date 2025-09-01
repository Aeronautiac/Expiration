const { SlashCommandBuilder } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("groupchat remove")
        .setDescription("Remove a user from the group chat.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to remove from the group chat")
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const reply = await game.removeUserFromGroupChat(interaction.client, target, interaction.channel);

        await interaction.editReply({
            content: reply,
            ephemeral: true,
        });
    },
};

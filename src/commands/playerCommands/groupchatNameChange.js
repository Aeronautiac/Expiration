const { SlashCommandBuilder } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("groupchatNameChange")
        .setDescription("Change the name of the group chat.")
        .addStringOption((option) =>
            option
                .setName("newname")
                .setDescription("The new name for the group chat")
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const newName = interaction.options.getString("newname");
        const reply = await game.changeGroupChatName(interaction.client, interaction.user, interaction.channel, newName);

        await interaction.editReply({
            content: reply,
            ephemeral: true,
        });
    },
};

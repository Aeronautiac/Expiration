const { SlashCommandBuilder } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("groupchat add")
        .setDescription("Add a user to the group chat.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to add to the group chat")
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const reply = await game.addUserToGroupChat(interaction.client, target, interaction.channel);

        await interaction.editReply({
            content: reply,
            ephemeral: true,
        });
    },
};

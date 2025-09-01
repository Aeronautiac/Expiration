const { SlashCommandBuilder } = require("discord.js");
const game = require("../../game");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("writename")
        .setDescription("Write a name in the notebook.")
        .addStringOption((option) =>
            option
                .setName("name")
                .setDescription("The name you want to write")
                .setRequired(true)
        )
        .addNumberOption((option) =>
            option
                .setName("delay")
                .setDescription("The number of minutes until the death occurs.")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription(
                    "The death message to be displayed to everyone."
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({});

        if (!(await game.guildIsNotebook(interaction.guild))) {
            await interaction.editReply({
                content: "You must use this command inside of a death note.",
            });
            return;
        }

        const result = await game.writeName(interaction);

        const name = interaction.options.getString("name");
        const message = interaction.options.getString("message");
        const delay = interaction.options.getNumber("delay");

        let relayed = `${name}`;
        if (delay) relayed = relayed.concat(`, dies in ${delay} minutes`);
        if (message) relayed = relayed.concat(`, ${message}`);

        if (result === true) {
            await interaction.editReply({
                content: relayed,
            });
        } else {
            await interaction.editReply({
                content: `${result} [${relayed}]`,
            });
        }
    },
};

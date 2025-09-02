const { SlashCommandBuilder } = require("discord.js");
const game = require("../../game");

function choice(name) {
    return { name: name, value: name };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pseudocide")
        .setDescription("Pseudocide a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to pseudocide.")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("truename")
                .setDescription("The true name to be displayed.")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("role")
                .setDescription("The role to be displayed.")
                .addChoices(
                    choice("Civilian"),
                    choice("Rogue Civilian"),
                    choice("Watari"),
                    choice("L"),
                    choice("Kira"),
                    choice("2nd Kira"),
                    choice("BB"),
                    // choice("Near"),
                    // choice("Mello"),
                    choice("PI"),
                    choice("News Anchor")
                )
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("affiliations")
                .setDescription(
                    "The affiliations to be displayed. Separate with commas. Example: TF Chief, KK, SPK"
                )
                .setRequired(false)
        )
        .addBooleanOption((option) =>
            option
                .setName("hasnotebook")
                .setDescription(
                    "Whether the death message should say they had a notebook or not."
                )
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("deathmessage")
                .setDescription("The death message to be displayed.")
                .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        // do the thing here
        const result = await game.pseudocide(interaction);

        if (result !== true) {
            await interaction.editReply({
                content: result,
                ephemeral: true,
            });
        } else {
            await interaction.editReply({
                content: "Success.",
                ephemeral: true,
            });
        }
    },
};

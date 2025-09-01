const { SlashCommandBuilder } = require("discord.js");
const game = require("../../game");

const KKAbilities = [
    "Blackout", "Public Kidnap", "Anonymous Kidnap"
]
const TFAbilities = [
    "Background Check", "Civilian Arrest", "Unlawful Arrest"
]

function choice(name) {
    return { name: name, value: name };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("startvote")
        .setDescription("Start a vote within your organisation to perform an action.")
        .addStringOption((option) =>
            option
                .setName("action")
                .setDescription("The action you want to vote for")
                .addChoices(
                    // KK and TF abilities combined
                    ...KKAbilities.map(choice),
                    ...TFAbilities.map(choice)
                )
                .setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const action = interaction.options.getString("action");
        const playerData = await game.getPlayerData(interaction.user);

        // Check if player is alive
        if (!playerData.alive) {
            await interaction.editReply({
                content: "You are not alive.",
            });
            return;
        }
        // Check if player is part of organisation
        let ourAffilation = null;
        if (playerData.affiliations.includes("Task Force") || playerData.affiliations.includes("Task Force Chief"))  {
            ourAffilation = "TF";
        } else if (playerData.affiliations.includes("Kira's Kingdom")) {
            ourAffilation = "KK";
        } else {
            await interaction.editReply({
                content: "You are not part of an eligible organisation.",
            });
            return;
        }
        // Check if vote is part of correct organisation (TF cant use KK ability)
        if ((ourAffilation === "TF" && KKAbilities.includes(action)) || (ourAffilation === "KK" && TFAbilities.includes(action))) {
            await interaction.editReply({
                content: "You are not allowed to start a vote for this action.",
            });
            return;
        }
        // Check if organisation ability is on cooldown
        
        // If the ability requires a target or etc, prompt for it

        // Start a poll for the ability

        // Once poll reaches majority, execute or discard the ability

        await interaction.editReply({
            content: reply,
            ephemeral: true,
        });
    },
};

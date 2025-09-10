import { SlashCommandBuilder } from "discord.js";
import game from "../../game";
import type { interaction } from "../../types";
import { createDiscordInteractionChoice } from "../../util";

export default {
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
                    createDiscordInteractionChoice("Civilian"),
                    createDiscordInteractionChoice("Rogue Civilian"),
                    createDiscordInteractionChoice("Watari"),
                    createDiscordInteractionChoice("L"),
                    createDiscordInteractionChoice("Kira"),
                    createDiscordInteractionChoice("2nd Kira"),
                    createDiscordInteractionChoice("BB"),
                    createDiscordInteractionChoice("PI"),
                    createDiscordInteractionChoice("News Anchor")
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
        .addBooleanOption((option) =>
            option
                .setName("hasbugability")
                .setDescription(
                    "Whether the death message should say they had the bug and contact logs abilities or not."
                )
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("deathmessage")
                .setDescription("The death message to be displayed.")
                .setRequired(false)
        ),
    async execute(interaction: interaction) {
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

import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import game from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("spec")
        .setDescription("Make a player a spectator.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to make a spectator")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        if (await game.makeSpectator(target.id)) {
            interaction.editReply({
                content: `Made ${target} a spectator.`,
            });
        } else {
            interaction.editReply({
                content: `Failed to make ${target} a spectator.`,
            });
        }
    },
};
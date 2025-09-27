import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import game from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("unlock2ndkira")
        .setDescription("Unlocks 2nd Kira's notebook.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await game.unlock2ndKira();

        await interaction.editReply({
            content: "2nd Kira can now use their notebook.",
        });
    },
};

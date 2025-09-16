import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import names from "../../core/names";

export default {
    data: new SlashCommandBuilder()
        .setName("syncnicknames")
        .setDescription("Sync nicknames with the main server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await names.sync();

        await interaction.editReply({
            content: "Successfully synced nicknames.",
        });
    },
};

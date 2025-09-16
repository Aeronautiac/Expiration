import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import notebooks from "../../core/notebooks";

export default {
    data: new SlashCommandBuilder()
        .setName("setnotebookowner")
        .setDescription("Set a channel as a notebook.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption((option) =>
            option
                .setName("ownerid")
                .setDescription("The userid of the owner of the notebook")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await notebooks.setOwner(
            interaction.guild.id,
            interaction.options.getString("ownerid")
        );

        await interaction.editReply({
            content: "Success.",
        });
    },
};

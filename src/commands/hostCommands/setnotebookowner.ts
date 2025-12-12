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
        .addStringOption((option) =>
            option
                .setName("ownerid")
                .setDescription("The userid of the owner of the notebook")
                .setRequired(true)
        )
        .addBooleanOption((option) => 
            option
                .setName("fake")
                .setDescription("Is this a fake notebook?")
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        ,

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await notebooks.setOwner(
            interaction.guild.id,
            interaction.options.getString("ownerid"),
            false,
            interaction.options.getBoolean("fake")
        );

        await interaction.editReply({
            content: "Success.",
        });
    },
};

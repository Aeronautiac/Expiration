import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    PermissionFlagsBits,
} from "discord.js";
import abilities from "../../core/abilities";
import game from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("newtruename")
        .setDescription("Give a player a new true name.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to change the name of")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("newname")
                .setDescription("The new true name")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await game.newTrueName(
            interaction.options.getUser("target").id,
            interaction.options.getString("newname")
        );

        await interaction.editReply({
            content: "Success.",
        });
    },
};

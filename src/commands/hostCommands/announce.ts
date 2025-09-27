import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import game from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("announce")
        .setDescription("Make the bot say something in news.")
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription("the message to send")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await game.announce(interaction.options.getString("message"));

        await interaction.editReply({
            content: "Successfully announced.",
        });
    },
};

import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import util from "../../core/util";

export default {
    data: new SlashCommandBuilder()
        .setName("setloggable")
        .setDescription(
            "Set a channel as loggable or disable logging in a channel (allows things like bug and autopsy)"
        )
        .addBooleanOption((option) =>
            option
                .setName("loggable")
                .setDescription(
                    "Turn logging on or off in this channel. True for on, false for off."
                )
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const result = await util.setChannelLoggable(
            interaction.channel.id,
            interaction.options.getBoolean("loggable")
        );
        if (!result.success)
            await interaction.editReply({
                content: result.message,
            });
        else
            await interaction.editReply({
                content: result.message,
            });
    },
};

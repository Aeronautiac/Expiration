import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import game from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("nextday")
        .setDescription(
            "Progress to the next day. (resets contact tokens, decreases cooldowns, etc...)"
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        await game.nextDay();

        await interaction.editReply({
            content: "Successfully progressed to the next day.",
        });
    },
};

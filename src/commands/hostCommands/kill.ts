import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import Player from "../../models/player";
import death from "../../core/death";

export default {
    data: new SlashCommandBuilder()
        .setName("kill")
        .setDescription("Kill a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to kill.")
                .setRequired(true)
        )
        .addBooleanOption((option) =>
            option
                .setName("silent")
                .setDescription(
                    "If this is true, the death will not be announced."
                )
                .setRequired(false)
        )
        .addUserOption((option) =>
            option
                .setName("killer")
                .setDescription("The person who is killing them.")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription("The death message to announce.")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const targetData = await Player.findOne({ userId: target.id });
        if (!targetData) {
            await interaction.editReply({
                content: `Cannot kill ${target} as they have no player data.`,
            });
            return;
        }

        await death.kill(target.id, {
            killerId: interaction.options.getUser("killer")?.id,
            deathMessage: interaction.options.getString("message"),
            dontSendDeathAnnouncement: interaction.options.getBoolean("silent"),
            bypassIPP: true,
        });

        await interaction.editReply({
            content: `Success.`,
        });
    },
};

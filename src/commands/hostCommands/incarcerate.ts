import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import game from "../../core/game";
import Player from "../../models/player";

export default {
    data: new SlashCommandBuilder()
        .setName("incarcerate")
        .setDescription("Incarcerate a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to incarcerate")
                .setRequired(true)
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
                content: `Cannot incarcerate ${target} as they have no player data.`,
            });
            return;
        }

        await game.incarcerate(target.id);

        await interaction.editReply({
            content: `Player ${target} has been incarcerated.`,
        });
    },
};

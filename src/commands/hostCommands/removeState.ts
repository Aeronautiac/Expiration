import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import Player from "../../models/player";
import { config } from "../../configs/config";
import util from "../../core/util";
import { PlayerStateName } from "../../configs/playerStates";

export default {
    data: new SlashCommandBuilder()
        .setName("removestate")
        .setDescription("Remove a state from a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to remove the state from")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("state")
                .setDescription("The state you want to remove")
                .setRequired(true)
                .addChoices(
                    Object.keys(config.playerStates).map(util.interactionChoice)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const targetData = await Player.findOne({ userId: target.id });
        const state = interaction.options.getString("state") as PlayerStateName;
        if (!targetData) {
            await interaction.editReply({
                content: `Cannot remove ${state} from ${target} as they have no player data.`,
            });
            return;
        }

        await util.removeState(target.id, state);

        await interaction.editReply({
            content: `Successfully removed ${state} from ${target}.`,
        });
    },
};

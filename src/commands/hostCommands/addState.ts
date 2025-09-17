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
        .setName("addstate")
        .setDescription("Add a state to a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to add the state to")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("state")
                .setDescription("The state you want to add to the person")
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
                content: `Cannot add ${state} to ${target} as they have no player data.`,
            });
            return;
        }

        await util.addState(target.id, state);

        await interaction.editReply({
            content: `Successfully added ${state} to ${target}.`,
        });
    },
};

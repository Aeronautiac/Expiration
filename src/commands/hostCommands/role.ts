import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import { config } from "../../configs/config";
import util from "../../core/util";
import game from "../../core/game";
import { RoleName } from "../../configs/roles";
import Season from "../../models/season";

export default {
    data: new SlashCommandBuilder()
        .setName("role")
        .setDescription(
            "Give a player a role, and set their alive status to true."
        )
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to give the role to")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("role")
                .setDescription("The role to give the player")
                .addChoices(
                    ...Object.keys(config.roles).map(util.interactionChoice)
                )
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("truename")
                .setDescription("The true name of the player")
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const season = await Season.findOne({});
        if (!season) {
            await interaction.editReply({
                content:
                    "Cannot role user. There is no season data. Run /newseason first.",
            });
            return;
        }

        await game.role(
            interaction.options.getUser("target").id,
            interaction.options.getString("role") as RoleName,
            interaction.options.getString("truename")
        );

        interaction.editReply({
            content: `Successfully gave role **${interaction.options.getString(
                "role"
            )}** to ${interaction.options.getUser("target")}.`,
        });
    },
};

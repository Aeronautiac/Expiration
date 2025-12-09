import {
    ChatInputCommandInteraction,
    CommandInteraction,
    Interaction,
    SlashCommandBuilder,
    User,
} from "discord.js";
import contacting from "../../core/contacting";
import abilities from "../../core/abilities";
import { executionQueue } from "../../core/game";
import Player from "../../models/player";
import util from "../../core/util";
import { RoleName } from "../../configs/roles";
import { config } from "../../configs/config";

export default {
    data: new SlashCommandBuilder()
        .setName("falseanoncontact")
        .setDescription(
            "Anonymously contact another player while posing as a different role."
        )
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to contact")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("asrole")
                .setDescription("The role you wish to present yourself as")
                .addChoices(
                    ...Object.keys(config.roles)
                        .filter(
                            (role) =>
                                config.roles[role].abilities.includes(
                                    "anonymousContact"
                                ) ||
                                config.roles[role].abilities.includes(
                                    "falseAnonymousContact"
                                )
                        )
                        .map(util.interactionChoice)
                )
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const asRole = interaction.options.getString("asrole") as RoleName;

        await executionQueue.executeQueued(async () => {
            const result = await abilities.useAbility(
                interaction.user.id,
                "falseAnonymousContact",
                {
                    asRole,
                    targetId: target.id,
                }
            );
            if (!result.success)
                await interaction.editReply({
                    content:
                        result.message ||
                        `Failed to contact ${interaction.options.getUser(
                            "target"
                        )}`,
                });
            else
                await interaction.editReply({
                    content: result.message,
                });
        });
    },
};

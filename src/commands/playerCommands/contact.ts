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

export default {
    data: new SlashCommandBuilder()
        .setName("contact")
        .setDescription("Contact another player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person you want to contact")
                .setRequired(true)
        )
        .addBooleanOption((option) =>
            option
                .setName("anonymous")
                .setDescription(
                    "Whether this should be an anonymous contact or not"
                )
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const anonymous = interaction.options.getBoolean("anonymous");
        const target = interaction.options.getUser("target");

        await executionQueue.executeQueued(async () => {
            const userData = await Player.findOne({ userId: interaction.user.id });
            const result = anonymous
                ? await abilities.useAbility(
                      interaction.user.id,
                      "anonymousContact",
                      {
                          asRole: userData.role,
                          targetId: target.id,
                      }
                  )
                : await contacting.contact(
                      interaction.user.id,
                      interaction.options.getUser("target").id
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

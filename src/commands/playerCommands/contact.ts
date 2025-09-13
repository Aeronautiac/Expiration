import {
    ChatInputCommandInteraction,
    CommandInteraction,
    Interaction,
    SlashCommandBuilder,
    User,
} from "discord.js";
import contacting from "../../core/contacting";

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

        const result = await contacting.contact(
            interaction.user.id,
            interaction.options.getUser("target").id,
            interaction.options.getBoolean("anonymous")
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
    },
};

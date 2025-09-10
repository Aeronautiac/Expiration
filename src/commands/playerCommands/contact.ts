import { ChatInputCommandInteraction, CommandInteraction, Interaction, SlashCommandBuilder, User } from "discord.js";
import game from "../../game";
import { interaction } from "../../types";

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


        const reply = await game.contact(
            interaction.client,
            interaction.user,
            interaction.options.getUser("target"),
            interaction.options.getBoolean("anonymous")
        );

        await interaction.editReply({
            content: reply,
        });
    },
};

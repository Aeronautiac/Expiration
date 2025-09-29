import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import Player from "../../models/player";

export default {
    data: new SlashCommandBuilder()
        .setName("addtokens")
        .setDescription(
            "Add to a player's token count. (If you wish to subtract tokens, supply a negative number)"
        )
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("the person to give the tokens to")
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("tokens")
                .setDescription("the number of tokens to add")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const target = interaction.options.getUser("target");
        const amt = interaction.options.getInteger("tokens");
        var playerData = await Player.findOne({ userId: target.id });
        if (!playerData) {
            await interaction.editReply({
                content: `${target} has no player data. Cannot modify token value.`,
            });
            return;
        }

        await Player.updateOne({ userId: target.id });

        await interaction.editReply({
            content: `Successfully added ${amt} to ${target}'s token count. They now have ${playerData.contactTokens} tokens.`,
        });
    },
};

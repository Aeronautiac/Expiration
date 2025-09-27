import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import Season from "../../models/season";
import game from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("cleanslate")
        .setDescription("Clears all game data. (USE WITH CAUTION)")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const season = await Season.findOne({});
        if (!season) {
            await interaction.editReply({
                content: `Cannot use clean slate if there is no season data.`,
            });
            return;
        }

        if (season.temporaryChannels.includes(interaction.channel.id)) {
            await interaction.editReply({
                content: `Cannot use clean slate inside of a temporary channel.`,
            });
            return;
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm")
                .setLabel("Confirm")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("cancel")
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            content: "Are you sure you want to do this?",
            components: [row],
        });

        const collector = interaction.channel!.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 15000,
            max: 1,
        });

        collector.on("collect", async (i) => {
            if (i.customId === "confirm") {
                await i.update({
                    content: "Successfully cleared all game data.",
                    components: [],
                });
                game.cleanSlate();
            } else {
                await i.update({ content: "Cancelled.", components: [] });
            }
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                interaction.editReply({
                    content: "No response, cancelled.",
                    components: [],
                });
            }
        });
    },
};

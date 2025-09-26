import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
} from "discord.js";
import abilities from "../../core/abilities";
import game from "../../core/game";
import Organisation from "../../models/organisation";
import { guilds } from "../../configs/guilds";
import { OrganisationName, organisations } from "../../configs/organisations";

export default {
    data: new SlashCommandBuilder()
        .setName("silentprosecute")
        .setDescription("Start a silent prosecution on a player.")
        .addStringOption((option) =>
            option
                .setName("target")
                .setDescription("The ID of the person to prosecute.")
                .setRequired(true)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const orgData = await Organisation.findOne({ name: "Task Force" });
        if (!orgData.memberIds.includes(interaction.user.id)) {
            await interaction.editReply({
                content: "You are not a member of the Task Force.",
            });
            return;
        }

        const guildId = interaction.guildId;
        let orgName: OrganisationName;
        for (const org of Object.keys(organisations)) {
            if (guilds[organisations[org].guild] === guildId) {
                orgName = org as OrganisationName;
                break;
            }
        }
        if (!orgName) {
            await interaction.editReply("This is not an organisation server.");
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
            content: "Are you sure you want to do this? A false silent prosecution will result in your target being unaffected and your identity being revealed and you being blacklisted from the Task Force.",
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
                    content: "Performing silent prosecution.",
                    components: [],
                });
                game.silentProsecute(
                    interaction.user.id,
                    interaction.options.getString("target", true)
                );
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

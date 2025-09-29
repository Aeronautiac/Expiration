import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import notebooks from "../../core/notebooks";
import { config } from "../../configs/config";
import Notebook from "../../models/notebook";

export default {
    data: new SlashCommandBuilder()
        .setName("write")
        .setDescription("Write a name in the notebook.")
        .addStringOption((option) =>
            option
                .setName("name")
                .setDescription("The name you want to write.")
                .setRequired(true)
        )
        .addNumberOption((option) =>
            option
                .setName("delay")
                .setDescription("The number of minutes until the death occurs.")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription(
                    "The death message to be displayed to everyone."
                )
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({});

        // is the server a death note server?
        const notebook = await Notebook.findOne({
            guildId: interaction.guildId,
        });
        if (!notebook) {
            await interaction.editReply({
                content: "You can only use this command in a notebook server.",
            });
            return;
        }

        const name = interaction.options.getString("name");
        const deathMessage = interaction.options.getString("message");
        const delayArg = interaction.options.getNumber("delay");
        const delay = delayArg
            ? Math.min(Math.max(delayArg, 0), config.deathNoteDelayCap)
            : undefined;

        let relayed = `${name}`;
        if (delay) relayed = relayed.concat(`, dies in ${delay} minutes`);
        if (deathMessage) relayed = relayed.concat(`, ${deathMessage}`);

        const result = await notebooks.write(
            interaction.user.id,
            interaction.guildId,
            name,
            {
                deathMessage,
                delay,
            }
        );

        if (result.success) {
            await interaction.editReply({
                content: relayed,
            });
        } else {
            await interaction.editReply({ content: relayed });
            await interaction.followUp({
                content: result.message || "Failed to use write name.",
            });
        }
    },
};

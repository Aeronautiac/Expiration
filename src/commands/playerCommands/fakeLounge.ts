import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
} from "discord.js";
import abilities from "../../core/abilities";
import { executionQueue } from "../../core/game";

export default {
    data: new SlashCommandBuilder()
        .setName("fakelounge")
        .setDescription("Create a fake lounge between two players.")
        .addUserOption((option) =>
            option
                .setName("contactor")
                .setDescription("The person who started the lounge")
                .setRequired(true)
        )
        .addUserOption((option) =>
            option
                .setName("contacted")
                .setDescription("The person being contacted")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const contactor = interaction.options.getUser("contactor");
        const contacted = interaction.options.getUser("contacted");
        await executionQueue.executeQueued(async () => {
            const result = await abilities.useAbility(interaction.user.id, "fakeLounge", {
                contactedId: contacted.id,
                contactorId: contactor.id,
            })
            if (!result.success)
                await interaction.editReply({
                    content: result.message,
                });
            else
                await interaction.editReply({
                    content: "Success."
                });
        });
    },
};

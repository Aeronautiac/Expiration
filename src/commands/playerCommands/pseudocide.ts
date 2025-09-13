import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";
import { RoleName } from "../../configs/roles";

function choice(name: string) {
    return {
        name: name,
        value: name,
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName("pseudocide")
        .setDescription("Pseudocide a player.")
        .addUserOption((option) =>
            option
                .setName("target")
                .setDescription("The person to pseudocide.")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("truename")
                .setDescription("The true name to be displayed.")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("role")
                .setDescription("The role to be displayed.")
                .addChoices(
                    choice("Civilian"),
                    choice("Rogue Civilian"),
                    choice("Watari"),
                    choice("L"),
                    choice("Kira"),
                    choice("2nd Kira"),
                    choice("BB"),
                    choice("PI"),
                    choice("News Anchor")
                )
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("affiliations")
                .setDescription(
                    "The affiliations to be displayed. Separate with commas. Example: Task Force, Kira's Kingdom, Task Force Chief (These are also the only options)"
                )
                .setRequired(false)
        )
        .addBooleanOption((option) =>
            option
                .setName("hasnotebook")
                .setDescription(
                    "Whether the death message should say they had a notebook or not."
                )
                .setRequired(false)
        )
        .addBooleanOption((option) =>
            option
                .setName("hasbugability")
                .setDescription(
                    "Whether the death message should say they had the bug and contact logs abilities or not."
                )
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("deathmessage")
                .setDescription("The death message to be displayed.")
                .setRequired(false)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const options = interaction.options;
        const role = options.getString("role") as RoleName;

        const result = await abilities.useAbility(
            interaction.user.id,
            "pseudocide",
            {
                targetId: options.getUser("target").id,
                role: role,
                trueName: options.getString("trueName"),
                hasBugAbility: options.getBoolean("hasbugability"),
                hasNotebook: options.getBoolean("hasnotebook"),
                message: options.getString("deathmessage"),
                affiliationsString: options.getString("affiliations"),
            }
        );
        if (!result.success)
            await interaction.editReply({
                content: result.message || "Failed to use pseudocide.",
            });
        else
            await interaction.editReply({
                content: "Success.",
            });
    },
};

import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import abilities from "../../core/abilities";
import Player from "../../models/player";
import { guilds } from "../../configs/guilds";
import Lounge from "../../models/lounge";
import Season from "../../models/season";
import game from "../../core/game";
import { discordRoles } from "../../configs/discordRoles";

export default {
    data: new SlashCommandBuilder()
        .setName("confirmkiraidentity")
        .setDescription("As 2nd Kira, you need to confirm Kira's identity to use your Death Note."),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const season = await Season.findOne({});
        if (!season || !season.flags.has("active")) {
            await interaction.editReply({
                content: "The season is not yet active.",
            });
            return;
        }

        const playerData = await Player.findOne({ userId: interaction.user.id });
        if (!playerData || playerData.role !== "2nd Kira" || !playerData.flags.has("alive") || playerData.flags.has("kiraConnection")) {
            await interaction.editReply({
                content: "You cannot use this command.",
            });
            return;
        }
        if (playerData.flags.has("kiraConnectionCooldown")) {
            await interaction.editReply({
                content: "You are on cooldown.",
            });
            return;
        }
        if (interaction.guildId !== guilds.main) {
            await interaction.editReply({
                content: "This can only be used in a public lounge.",
            });
            return;
        }

        // get loungeId from the last chars in the channel's name. Also make sure it's a lounge channel
        const currentChannel = interaction.channel;
        const ourLoungeId = currentChannel.name.includes("lounge") ? Number(currentChannel.name.split("-").pop()) : null;
        const lounge = await Lounge.findOne({ loungeId: ourLoungeId });

        if (!lounge || lounge.anonymous) {
            await interaction.editReply({
                content: "This can only be used in a public lounge.",
            });
            return;
        }

        await interaction.deferReply({
            ephemeral: false
        });

        const kiraPlayerUserId = (await Player.findOne({ role: "Kira" })).userId;
        const kiraIsInLounge = lounge.contactedId === kiraPlayerUserId || lounge.contactorId == kiraPlayerUserId;
        if (kiraIsInLounge) {
            game.unlock2ndKira();

            await interaction.editReply({
                content: `@everyone <@&${discordRoles.Kira}> is present in this lounge. <@&${discordRoles["2nd Kira"]}> can now write in their Death Note.`,
            });
        } else {
            await interaction.editReply({
                content: `@everyone <@&${discordRoles.Kira}> is not present in this lounge.`,
            });
        }
    },
};

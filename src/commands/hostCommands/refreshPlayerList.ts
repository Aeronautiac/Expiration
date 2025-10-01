import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextChannel,
} from "discord.js";
import Player from "../../models/player";
import { config } from "../../configs/config";
import util from "../../core/util";
import { PlayerStateName } from "../../configs/playerStates";

export default {
    data: new SlashCommandBuilder()
        .setName("refreshplayerlist")
        .setDescription("Refresh the player list to see all player roles and true names.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        });

        const roleRevealMessage = await util.produceListOfRoles(true);
        const mainGuild = await interaction.client.guilds.fetch(config.guilds.main);
        const playerListChannel = (await mainGuild.channels.fetch()).find(channel => channel.name === config.channels.playerList) as TextChannel;

        await playerListChannel.send(roleRevealMessage);

        await interaction.editReply({
            content: `Successfully refreshed the player list.`,
        });
    },
};

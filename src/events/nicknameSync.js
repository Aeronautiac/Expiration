const game = require("../game");
const { Events } = require("discord.js");
const gameConfig = require("../../gameconfig.json");

module.exports = {
    name: Events.GuildMemberAdd,
    
    async execute(member) {
        const guild = member.guild;
        if (guild.id === gameConfig.guildIds.main) return;

        const mainGuild = await member.client.guilds.fetch(
            gameConfig.guildIds.main
        );
        const mainMember = await mainGuild.members
            .fetch(member.id)
            .catch(() => null);
        if (!mainMember) return;

        await game.setNickname(member.client, member.user, mainMember.displayName);
    },
};

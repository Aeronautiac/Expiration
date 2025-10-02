import { Events, GuildMember } from "discord.js";
import Player from "../models/player";

export default {
    name: Events.GuildMemberAdd,

    async execute(member: GuildMember) {
        const playerData = await Player.findOne({ userId: member.user.id });
        if (playerData && !playerData.flags.get("spectator")) {
            const role = (await member.guild.roles.fetch()).find(r => r.name === playerData.role);
            if (role) {
                await member.roles.add(role);
                return;
            }

            const guildName = member.guild.name.toLowerCase();
            if (guildName === "task force") {
                await member.roles.add((await member.guild.roles.fetch()).find(r => r.name === "Task Force"));
            } else if (guildName === "kira's kingdom") {
                await member.roles.add((await member.guild.roles.fetch()).find(r => r.name === "Kira's Kingdom"));
            }
        }
    },
};

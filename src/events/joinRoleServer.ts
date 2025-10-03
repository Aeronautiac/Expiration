import { Events, GuildMember } from "discord.js";
import Player from "../models/player";
import Notebook from "../models/notebook";
import Season from "../models/season";

export default {
    name: Events.GuildMemberAdd,

    async execute(member: GuildMember) {
        const playerData = await Player.findOne({ userId: member.user.id });
        const season = await Season.findOne({});

        // kick unauthorized members if a season is active
        if (
            season &&
            season.flags.get("active") &&
            (!playerData || !playerData.invites.has(member.guild.id))
        )
            await member.kick().catch(console.error);

        if (playerData && !playerData.flags.get("spectator")) {
            const role = (await member.guild.roles.fetch()).find(
                (r) => r.name === playerData.role
            );
            if (role) {
                await member.roles.add(role);
                return;
            }

            const guildName = member.guild.name.toLowerCase();
            if (guildName === "task force") {
                await member.roles.add(
                    (
                        await member.guild.roles.fetch()
                    ).find((r) => r.name === "Task Force")
                );
            } else if (guildName === "kira's kingdom") {
                await member.roles.add(
                    (
                        await member.guild.roles.fetch()
                    ).find((r) => r.name === "Kira's Kingdom")
                );
            }

            const notebook = await Notebook.findOne({
                guildId: member.guild.id,
            });
            if (!notebook) return;

            if (
                notebook.temporaryOwner === member.id ||
                (notebook.currentOwner === member.id &&
                    !notebook.temporaryOwner)
            ) {
                await member.roles.add(
                    (
                        await member.guild.roles.fetch()
                    ).find((r) => r.name === "Death Note Wielder")
                );
            }
        }
    },
};

import { Events, GuildMember } from "discord.js";
import names from "../core/names";

module.exports = {
    name: Events.GuildMemberAdd,

    async execute(member: GuildMember) {
        await names.setNick(
            member.user.id,
            await names.getDisplay(member.user.id)
        );
    },
};

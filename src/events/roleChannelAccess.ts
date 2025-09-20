import { Events, GuildMember } from "discord.js";
import names from "../core/names";
import access from "../core/access";

export default {
    name: Events.GuildMemberAdd,

    async execute(member: GuildMember) {
        await access.grantChannels(member.user.id);
    },
};

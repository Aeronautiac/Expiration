import Agenda, { Job } from "agenda";
import game from "./core/game";
import { ScheduledKillData } from "./types/ScheduledKillData";
import { RoleName } from "./configs/roles";

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI } });

agenda.define("scheduledKill", async (job: Job<ScheduledKillData>) => {
    const { userId, deathMessage, killerId } = job.attrs.data;
    await game.kill(userId, { deathMessage, killerId });
});

agenda.define(
    "pseudocideRevival",
    async (job: Job<{ userId: string; roleOnDeath: RoleName }>) => {
        const { userId, roleOnDeath } = job.attrs.data;
        await game.role(userId, roleOnDeath);
        await game.announce(`It appears that <@${userId}> never actually died! They were found half-naked and unconscious in the middle of a crowded street in Tokyo.\n
        When questioned, they claimed to have no recollection of how they arrived there.\n
        Their death appears to have been staged using an uncanny replica dummy.\n
        Authorities have now deemed them “sufficiently reintegrated into society.”`);
    }
);

agenda.define(
    "kidnapRelease",
    async (job: Job<{ userId: string }>) => {
        const { userId } = job.attrs.data;
        await game.kidnapRelease(userId);
    }
)

export default agenda;

// remember to call agenda.start() in your main file to start processing jobs
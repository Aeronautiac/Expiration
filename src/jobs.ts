import Agenda, { Job } from "agenda";
import game from "./core/game";
import { ScheduledKillData } from "./types/ScheduledKillData";
import { RoleName } from "./configs/roles";
import death from "./core/death";

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI } });

agenda.define("scheduledKill", async (job: Job<ScheduledKillData>) => {
    const { userId, deathMessage, killerId } = job.attrs.data;
    await death.kill(userId, { deathMessage, killerId });
});

agenda.define(
    "pseudocideRevival",
    async (job: Job<{ userId: string; roleOnDeath: RoleName }>) => {
        const { userId, roleOnDeath } = job.attrs.data;
        await game.role(userId, roleOnDeath);
        await game.announce(
            `@everyone It appears that <@${userId}> never actually died! They were found half-naked and unconscious in the middle of a crowded street in Tokyo.\nWhen questioned, they claimed to have no recollection of how they arrived there.\nTheir death appears to have been staged using an uncanny replica dummy.\nAuthorities have now allowed them to re-enter society.`
        );
    }
);

agenda.define("kidnapRelease", async (job: Job<{ userId: string }>) => {
    const { userId } = job.attrs.data;
    await game.kidnapRelease(userId);
});

agenda.define("releaseIncarcerated", async (job: Job<{ userId: string }>) => {
    const { userId } = job.attrs.data;
    await game.removeIncarcerated(userId);
});

agenda.define("endBlackout", async (job: Job<{}>) => {
    await game.endBlackout();
});

export default agenda;

// remember to call agenda.start() in your main file to start processing jobs

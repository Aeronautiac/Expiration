import Agenda, { Job } from "agenda";
import game from "./core/game";
import { ScheduledKillData } from "./types/ScheduledKillData";

const agenda = new Agenda({db: {address: process.env.MONGODB_URI}});

agenda.define("scheduledKill", async (job: Job<ScheduledKillData>) => {
    const { userId, deathMessage, killerId } = job.attrs.data;
    await game.kill(userId, { deathMessage, killerId });
});

agenda.start();

export default agenda;
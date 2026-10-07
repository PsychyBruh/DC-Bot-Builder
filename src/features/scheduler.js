// One timer drives every periodic feature. Each job has its own interval and never overlaps itself.
const jobs = [];

function every(ms, name, fn) {
  jobs.push({ ms, name, fn, last: 0, running: false });
}

export function startFeatureScheduler(client) {
  every(60_000, "polls", async () => (await import("./voting.js")).closeExpiredPolls(client));
  every(60_000, "raid-expiry", async () => (await import("./safety.js")).checkLockdownExpiry(client));
  every(60_000, "playtests", async () => (await import("./roblox.js")).runPlaytests(client));
  every(60_000, "schedules", async () => (await import("./automation.js")).runSchedules(client));
  every(60_000, "stats-flush", async () => (await import("./stats.js")).flushMessageCounts());
  every(5 * 60_000, "birthdays", async () => (await import("./automation.js")).runBirthdays(client));
  every(5 * 60_000, "weekly-report", async () => (await import("./automation.js")).runWeeklyReport(client));
  every(5 * 60_000, "leaderboards", async () => (await import("./roblox.js")).runDailyLeaderboards(client));
  every(6 * 60_000, "roblox-status", async () => {
    const { updateRobloxStatus } = await import("./automation.js");
    for (const g of client.guilds.cache.values()) await updateRobloxStatus(g);
  });
  every(10 * 60_000, "counters", async () => {
    const { updateCounters } = await import("./automation.js");
    for (const g of client.guilds.cache.values()) await updateCounters(g);
  });
  every(60 * 60_000, "inactive-tickets", async () => (await import("./clean.js")).checkInactiveTickets(client));
  every(60 * 60_000, "forum-tidy", async () => (await import("./clean.js")).tidyForums(client));
  every(24 * 60 * 60_000, "achievements", async () => (await import("./roblox.js")).syncAllAchievements(client));

  const tick = () => {
    const now = Date.now();
    for (const job of jobs) {
      if (job.running || now - job.last < job.ms) continue;
      job.running = true;
      job.last = now;
      Promise.resolve()
        .then(job.fn)
        .catch((err) => console.error(`scheduler ${job.name} failed:`, err.message))
        .finally(() => { job.running = false; });
    }
  };
  setTimeout(tick, 15_000); // let caches warm up first
  setInterval(tick, 30_000);
}

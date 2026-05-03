import { statfs } from "node:fs/promises";
import os from "node:os";
import { setTimeout as wait } from "node:timers/promises";
import { requireAdminUser } from "~/server/utils/auth";

type CpuSnapshot = {
  idle: number;
  total: number;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

function usagePercent(used: number, total: number) {
  if (total <= 0) return 0;
  return clampPercent((used / total) * 100);
}

function readCpuSnapshot(): CpuSnapshot {
  return os.cpus().reduce(
    (snapshot, cpu) => {
      const total = cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
      snapshot.idle += cpu.times.idle;
      snapshot.total += total;
      return snapshot;
    },
    { idle: 0, total: 0 }
  );
}

async function readCpuUsage() {
  const cpus = os.cpus();
  const start = readCpuSnapshot();
  await wait(120);
  const end = readCpuSnapshot();
  const totalDelta = end.total - start.total;
  const idleDelta = end.idle - start.idle;
  const usedPercent = totalDelta > 0 ? 100 - (idleDelta / totalDelta) * 100 : 0;

  return {
    model: cpus[0]?.model || "Unknown CPU",
    cores: cpus.length,
    usagePercent: clampPercent(usedPercent)
  };
}

async function readDiskUsage() {
  try {
    const stats = await statfs(process.cwd());
    const total = Number(stats.blocks) * Number(stats.bsize);
    const free = Number(stats.bavail) * Number(stats.bsize);
    const used = Math.max(0, total - free);

    return {
      path: process.cwd(),
      total,
      used,
      free,
      usagePercent: usagePercent(used, total)
    };
  } catch {
    return null;
  }
}

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = Math.max(0, totalMemory - freeMemory);
  const [cpu, disk] = await Promise.all([readCpuUsage(), readDiskUsage()]);

  return {
    sampledAt: new Date().toISOString(),
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(os.uptime()),
    cpu,
    memory: {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      usagePercent: usagePercent(usedMemory, totalMemory)
    },
    disk
  };
});

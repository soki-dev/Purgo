const os = require('os');
const { runPowerShell, parseJsonSafe } = require('./powershell');

const DISK_SCRIPT = `
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
  Select-Object DeviceID, Size, FreeSpace |
  ConvertTo-Json -Compress
`;

const CPU_SCRIPT = `(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average`;

async function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

  let cpuLoad = 0;
  try {
    const out = await runPowerShell(CPU_SCRIPT);
    cpuLoad = Math.round(parseFloat(out.trim())) || 0;
  } catch {
    cpuLoad = 0;
  }

  let disks = [];
  try {
    const raw = parseJsonSafe(await runPowerShell(DISK_SCRIPT));
    disks = raw
      .filter((d) => d && d.Size)
      .map((d) => {
        const total = Number(d.Size);
        const free = Number(d.FreeSpace);
        const usedPercent = total ? Math.round(((total - free) / total) * 100) : 0;
        return { drive: d.DeviceID, totalBytes: total, freeBytes: free, usedPercent };
      });
  } catch {
    disks = [];
  }

  const worstDiskUsage = disks.length ? Math.max(...disks.map((d) => d.usedPercent)) : 0;
  const healthScore = Math.max(
    0,
    100 - Math.round(cpuLoad * 0.2 + usedMemPercent * 0.3 + worstDiskUsage * 0.3)
  );

  return {
    cpuLoad,
    memory: { totalBytes: totalMem, freeBytes: freeMem, usedPercent: usedMemPercent },
    disks,
    healthScore,
    platform: `${os.type()} ${os.release()}`,
    hostname: os.hostname()
  };
}

module.exports = { getSystemInfo };

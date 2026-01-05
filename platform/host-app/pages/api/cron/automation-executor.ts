import type { NextApiRequest, NextApiResponse } from "next";
import { getReadyTasks, executeTask } from "@/lib/automation/executor";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const tasks = await getReadyTasks();
    const results = [];

    for (const { task, schedule } of tasks) {
      const result = await executeTask(task, schedule);
      results.push(result);
    }

    return res.status(200).json({
      success: true,
      executed: results.length,
      results,
    });
  } catch (error) {
    console.error("[Cron] Executor error:", error);
    return res.status(500).json({ error: String(error) });
  }
}

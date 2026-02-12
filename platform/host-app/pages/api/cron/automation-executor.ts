import type { NextApiResponse } from "next";
import { getReadyTasks, executeTask } from "@/lib/automation/executor";
import { createHandler } from "@/lib/api";
import { logger } from "@/lib/logger";

export default createHandler({
  auth: "cron",
  methods: {
    POST: async (_req, res: NextApiResponse) => {
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
        logger.error("[Cron] Executor error", error);
        return res.status(500).json({ error: String(error) });
      }
    },
  },
});

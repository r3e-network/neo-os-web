import type { NextApiRequest, NextApiResponse } from "next";
import { handleMorpheusRuntimeProxy } from "@/lib/morpheus-runtime-proxy";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  return handleMorpheusRuntimeProxy(req, res, { family: "session" });
}

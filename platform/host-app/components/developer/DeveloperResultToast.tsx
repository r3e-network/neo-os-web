"use client";

import { motion, AnimatePresence } from "framer-motion";

type DeveloperResultToastProps = {
  result: { success: boolean; message: string } | null;
  showForm: boolean;
};

export function DeveloperResultToast({
  result,
  showForm,
}: DeveloperResultToastProps) {
  return (
    <AnimatePresence>
      {result && !showForm && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 right-6 z-[130]"
        >
          <div
            role="alert"
            className={`rounded-xl p-4 shadow-2xl backdrop-blur-xl ${
              result.success
                ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                : "bg-red-500/20 border border-red-500/30 text-red-400"
            }`}
          >
            {result.message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

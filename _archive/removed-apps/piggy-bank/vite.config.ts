import { createAppConfig } from "../vite.shared";
import { nodePolyfills } from "vite-plugin-node-polyfills";

declare const __dirname: string;
export default createAppConfig(__dirname, {
  plugins: [
    nodePolyfills({
      include: ["buffer", "process", "util", "stream", "events", "string_decoder", "crypto", "vm", "path"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  alias: {
    ethers: "ethers/dist/ethers.esm.min.js",
  },
  optimizeDeps: {
    include: ["ethers", "snarkjs", "circomlibjs", "pinia", "@walletconnect/modal"],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});

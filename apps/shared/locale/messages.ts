import { baseMessages } from "./base-messages";
import { commonMessages } from "./common";

export const messages = {
  ...commonMessages,
  ...baseMessages,
} as const;

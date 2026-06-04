import type { EventBus } from "./EventBus";
import { NOTIFICATION_EVENT } from "./NotificationService";

export class ClipboardService {
  constructor(
    private eventBus: EventBus,
    private t: (key: string) => string,
  ) {}

  /** Copy text to clipboard with automatic notification */
  async copy(text: string, successKey = "copied"): Promise<boolean> {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      // Emit on the canonical NOTIFICATION_EVENT channel that MiniAppRoot /
      // NotificationService listen on — emitting the bare "notification" string
      // meant copy success/failure toasts were silently dropped.
      this.eventBus.emit(NOTIFICATION_EVENT, { message: this.t(successKey), type: "success" });
      return true;
    } catch {
      this.eventBus.emit(NOTIFICATION_EVENT, { message: this.t("copyFailed"), type: "error" });
      return false;
    }
  }
}

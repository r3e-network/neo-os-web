/**
 * Professional Game Audio Manager
 * Provides high-fidelity feedback for blockchain gaming interactions.
 */

class AudioManager {
    private sounds: Record<string, string> = {
        flip: 'https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3',
        win: 'https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3',
        lose: 'https://assets.mixkit.co/active_storage/sfx/2015/2015-preview.mp3',
        click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
    };

    private enabled: boolean = true;
    private readonly MAX_CONCURRENT_AUDIO = 4;
    private activeAudio: HTMLAudioElement[] = [];

    private release(audio: HTMLAudioElement) {
        const idx = this.activeAudio.indexOf(audio);
        if (idx !== -1) this.activeAudio.splice(idx, 1);
        try {
            audio.pause();
            audio.src = "";
        } catch (e) {
            console.warn("[fogplay] audio release failed:", e instanceof Error ? e.message : String(e));
        }
    }

    play(name: string) {
        if (!this.enabled || !this.sounds[name]) return;
        if (typeof window === "undefined" || typeof Audio === "undefined") return;

        while (this.activeAudio.length >= this.MAX_CONCURRENT_AUDIO) {
            const oldest = this.activeAudio[0];
            if (!oldest) break;
            this.release(oldest);
        }

        const audio = new Audio(this.sounds[name]);
        this.activeAudio.push(audio);

        audio.addEventListener("ended", () => this.release(audio));
        audio.addEventListener("error", () => this.release(audio));
        audio.addEventListener("pause", () => this.release(audio));

        audio.play().catch((e: unknown) => {
            console.warn("[fogplay] audio play failed:", e instanceof Error ? e.message : String(e));
            this.release(audio);
        });
    }

    toggle(val: boolean) {
        this.enabled = val;
    }
}

export const audioManager = new AudioManager();

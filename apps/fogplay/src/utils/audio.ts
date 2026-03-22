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
    private activeContexts: uni.InnerAudioContext[] = [];

    private releaseContext(context: uni.InnerAudioContext) {
        const idx = this.activeContexts.indexOf(context);
        if (idx !== -1) this.activeContexts.splice(idx, 1);
        try { context.destroy(); } catch (_e: unknown) { console.warn("[fogplay] audio context already destroyed:", _e instanceof Error ? _e.message : String(_e)); }
    }

    play(name: string) {
        if (!this.enabled || !this.sounds[name]) return;

        // Evict oldest context if at capacity
        while (this.activeContexts.length >= this.MAX_CONCURRENT_AUDIO) {
            this.releaseContext(this.activeContexts[0]);
        }

        // In UniApp, we use uni.createInnerAudioContext
        const context = uni.createInnerAudioContext();
        this.activeContexts.push(context);
        context.src = this.sounds[name];
        context.play();

        context.onEnded(() => this.releaseContext(context));
        context.onError(() => this.releaseContext(context));
        context.onPause(() => this.releaseContext(context));
    }

    toggle(val: boolean) {
        this.enabled = val;
    }
}

export const audioManager = new AudioManager();

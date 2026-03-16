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

    play(name: string) {
        if (!this.enabled || !this.sounds[name]) return;

        // In UniApp, we use uni.createInnerAudioContext
        const context = uni.createInnerAudioContext();
        context.src = this.sounds[name];
        context.play();

        context.onEnded(() => {
            context.destroy();
        });

        context.onError(() => {
            context.destroy();
        });
    }

    toggle(val: boolean) {
        this.enabled = val;
    }
}

export const audioManager = new AudioManager();

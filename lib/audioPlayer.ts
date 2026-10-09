/**
 * Universal Mobile-Ready Audio Player
 * iOS Safari ve Android Chrome'da sesli mesajların ilk dokunuşta gecikmesiz,
 * takılmadan ve arka arkaya tıklama gerektirmeden anında çalmasını sağlar.
 */

class UniversalAudioPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private currentBufferSource: AudioBufferSourceNode | null = null;
  private currentId: string | null = null;
  private isLoading: boolean = false;
  private listeners: Map<string, (state: { isPlaying: boolean; isLoading: boolean; currentId: string | null }) => void> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioElement();
    }
  }

  private initAudioElement() {
    if (this.audioElement) return;
    try {
      this.audioElement = new Audio();
      this.audioElement.preload = 'auto';
      // iOS Safari için kritik
      (this.audioElement as any).playsInline = true;

      this.audioElement.addEventListener('playing', () => {
        this.isLoading = false;
        this.notifyState();
      });

      this.audioElement.addEventListener('pause', () => {
        if (!this.isLoading) {
          this.notifyState();
        }
      });

      this.audioElement.addEventListener('ended', () => {
        this.currentId = null;
        this.isLoading = false;
        this.notifyState();
      });

      this.audioElement.addEventListener('error', (e) => {
        console.warn('HTML5 Audio oynatma hatası, Web Audio API yedeğine geçiliyor:', e);
        // HTML5 Audio codec hatası verirse (özellikle Safari'de WebM için)
        if (this.currentId && this.audioElement?.src) {
          this.fallbackWebAudioPlay(this.currentId, this.audioElement.src);
        } else {
          this.stop();
        }
      });
    } catch (e) {
      console.warn('Audio elementi başlatılamadı:', e);
    }
  }

  // Web Audio API ile doğrudan bayt çözme yedeği (Safari'de WebM formatları için)
  private async fallbackWebAudioPlay(id: string, url: string) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const decodedBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

      if (this.currentBufferSource) {
        try {
          this.currentBufferSource.stop();
          this.currentBufferSource.disconnect();
        } catch {}
      }

      const source = this.audioCtx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(this.audioCtx.destination);

      source.onended = () => {
        if (this.currentId === id) {
          this.currentId = null;
          this.isLoading = false;
          this.notifyState();
        }
      };

      source.start(0);
      this.currentBufferSource = source;
      this.isLoading = false;
      this.currentId = id;
      this.notifyState();
    } catch (err) {
      console.error('Web Audio API yedeği de başarısız oldu:', err);
      this.stop();
    }
  }

  public subscribe(key: string, callback: (state: { isPlaying: boolean; isLoading: boolean; currentId: string | null }) => void) {
    this.listeners.set(key, callback);
    // İlk durumu hemen gönder
    callback({
      isPlaying: Boolean(this.currentId && !this.isLoading),
      isLoading: this.isLoading,
      currentId: this.currentId,
    });
    return () => {
      this.listeners.delete(key);
    };
  }

  private notifyState() {
    const isPlaying = Boolean(this.currentId && !this.isLoading && this.audioElement && !this.audioElement.paused);
    const isBufferPlaying = Boolean(this.currentBufferSource && this.currentId && !this.isLoading);
    const activePlaying = isPlaying || isBufferPlaying;

    this.listeners.forEach((cb) => {
      cb({
        isPlaying: activePlaying,
        isLoading: this.isLoading,
        currentId: this.currentId,
      });
    });
  }

  public async toggle(id: string, url: string) {
    // Aynı ses çalıyorsa veya yükleniyorsa -> Durdur
    if (this.currentId === id) {
      this.stop();
      return;
    }

    // Önceki çalanı temizle
    this.stop(false);

    this.initAudioElement();
    if (!this.audioElement) return;

    this.currentId = id;
    this.isLoading = true;
    this.notifyState();

    try {
      this.audioElement.pause();
      this.audioElement.src = url;
      this.audioElement.currentTime = 0;
      this.audioElement.load();

      // play() promise'ini doğrudan kullanıcı etkileşimi bağlamında başlat
      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        await playPromise;
        // Oynatma başarıyla başladı
        this.isLoading = false;
        this.notifyState();
      }
    } catch (error: any) {
      console.warn('audio.play() doğrudan oynatılamadı:', error);
      // NotAllowedError veya format hatası durumunda Web Audio API yedeğini dene
      if (url) {
        await this.fallbackWebAudioPlay(id, url);
      } else {
        this.stop();
      }
    }
  }

  public stop(notify = true) {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {}
    }

    if (this.currentBufferSource) {
      try {
        this.currentBufferSource.stop();
        this.currentBufferSource.disconnect();
      } catch {}
      this.currentBufferSource = null;
    }

    this.currentId = null;
    this.isLoading = false;
    if (notify) {
      this.notifyState();
    }
  }

  public getCurrentId(): string | null {
    return this.currentId;
  }
}

// Singleton global ses oynatıcı örneği
export const globalAudioPlayer = new UniversalAudioPlayer();

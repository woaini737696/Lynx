"use client";

// 全双工语音通话：后缀音反馈（backchannel）
// 短停顿时播放"嗯"反馈音，让用户感知 AI 正在倾听，类似真人对话的"嗯哼"。
// 优先用 Web Audio API 合成短促"嗯"音（零延迟、不依赖网络/TTS）；
// 回退到浏览器内置 SpeechSynthesis 朗读"嗯"。

export class BackchannelPlayer {
  private ctx: AudioContext | null = null;

  /** 播放一次"嗯"后缀音 */
  play(): void {
    try {
      this.playWithWebAudio();
      return;
    } catch {
      /* fallthrough */
    }
    this.playWithSpeechSynthesis();
  }

  private playWithWebAudio(): void {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) throw new Error("AudioContext unavailable");
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new Ctx();
    }
    const ctx = this.ctx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    // "嗯"近似：基频 ~160Hz，持续约 250ms，带轻微频率下降，低音量
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.25);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  private playWithSpeechSynthesis(): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance("嗯");
      u.lang = "zh-CN";
      u.volume = 0.4;
      u.rate = 1.3;
      u.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* noop */
    }
  }
}

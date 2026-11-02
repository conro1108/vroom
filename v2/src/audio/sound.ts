// The game's whole audio surface. Owns the context and its lifecycle (lazy creation,
// the iOS gesture unlock, hidden-tab suspend) and the saved mute and volumes, and
// routes game calls to engine.ts, sfx.ts and music.ts. Every public method is safe
// before unlock() and in a page with no AudioContext, and a failure in here must
// never reach the game loop.
import type { Car, CarEvent } from "../sim/car";
import { Engine } from "./engine";
import { Music } from "./music";
import { buildRig, type Rig } from "./rig";
import { Sfx } from "./sfx";

const KEY = "vroom.audio";
const PUMP_MS = 50;
const MUSIC_TRIM = 0.62; // the 1.0 setting still sits under the engine
const GESTURES = ["pointerup", "touchend", "click", "keydown"];

export class Sound {
  private rig: Rig | null = null;
  private engineVoice: Engine | null = null;
  private sfx: Sfx | null = null;
  private music: Music | null = null;
  private theme = "";
  private counting = false;
  private paused = false;
  private _muted = false;
  private _music = 0.8;
  private _sfx = 1;

  /** `ctx` is for offline rendering; normally the context is made at unlock(). */
  constructor(ctx?: BaseAudioContext) {
    this.load();
    if (ctx) {
      this.wire(ctx);
      return;
    }
    // iOS drops the context to "interrupted" after a call or an app switch, and only
    // a gesture brings it back, so any tap anywhere has to be able to revive it.
    if (typeof window !== "undefined") {
      const again = () => this.unlock();
      for (const g of GESTURES) window.addEventListener(g, again, { passive: true, capture: true });
      document.addEventListener("visibilitychange", () => this.visibility());
    }
  }

  get muted() {
    return this._muted;
  }

  get musicVolume() {
    return this._music;
  }
  set musicVolume(v: number) {
    this._music = unit(v);
    this.applyLevels();
    this.save();
  }

  get sfxVolume() {
    return this._sfx;
  }
  set sfxVolume(v: number) {
    this._sfx = unit(v);
    this.applyLevels();
    this.save();
  }

  setMuted(m: boolean) {
    this._muted = m;
    this.applyLevels();
    this.save();
  }

  /** Freezes everything in place, music position included. Not saved, unlike mute. */
  setPaused(p: boolean) {
    if (p === this.paused) return;
    this.paused = p;
    const ctx = this.rig?.ctx as AudioContext | undefined;
    if (!ctx || !isLive(ctx)) return;
    guard(() => void (p ? ctx.suspend() : ctx.resume()).catch(() => {}));
  }

  unlock() {
    guard(() => {
      if (!this.rig) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.wire(new Ctx({ latencyHint: "interactive" }));
        setInterval(() => this.pump(), PUMP_MS);
      }
      const ctx = this.rig!.ctx as AudioContext;
      if (ctx.state === "running" || this.paused || !isLive(ctx)) return;
      ctx.resume().catch(() => {});
      // older iOS only counts the context as unlocked once something has played in the gesture
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      s.connect(ctx.destination);
      s.start();
    });
  }

  /** Called on every load, including the menu's showcase, so it can't assume a race. */
  startRace(theme: string) {
    this.theme = theme;
    this.counting = false;
    this.setPaused(false);
    guard(() => {
      this.engineVoice?.setLive(false);
      this.music?.play(theme);
    });
  }

  beep(kind: 0 | 1) {
    guard(() => {
      if (!this.rig) return;
      // silence for the lights, then the tune lands on GO
      if (!this.counting) {
        this.counting = true;
        this.music?.stop(0.5);
        this.engineVoice?.setLive(true);
      }
      const root = this.music?.root ?? 60;
      this.sfx?.beep(root, kind === 1);
      if (kind === 1) this.music?.play(this.theme, true);
    });
  }

  lap(final: boolean) {
    guard(() => {
      if (final) {
        this.sfx?.finalLap(this.music?.root ?? 60);
        this.music?.lift();
      } else {
        this.sfx?.lapChime(this.music?.root ?? 60);
      }
    });
  }

  event(e: CarEvent) {
    guard(() => this.sfx?.event(e));
  }

  engine(speedFrac: number, car: Car) {
    guard(() => this.engineVoice?.update(speedFrac, car));
  }

  /** Race over: let the engine die away under the results. */
  finish() {
    guard(() => this.engineVoice?.setLive(false, 0.5));
  }

  /** Public so an offline render can drive the clock itself. */
  pump() {
    const ctx = this.rig?.ctx;
    if (ctx && (ctx.state === "running" || !isLive(ctx))) guard(() => this.music?.pump());
  }

  private wire(ctx: BaseAudioContext) {
    this.rig = buildRig(ctx);
    this.engineVoice = new Engine(this.rig);
    this.sfx = new Sfx(this.rig);
    this.music = new Music(this.rig);
    this.applyLevels();
    if (this.theme) this.music.play(this.theme);
  }

  private applyLevels() {
    const r = this.rig;
    if (!r) return;
    const t = r.ctx.currentTime;
    r.out.gain.setTargetAtTime(this._muted ? 0 : 1, t, 0.015);
    r.music.gain.setTargetAtTime(this._music * MUSIC_TRIM, t, 0.03);
    r.sfx.gain.setTargetAtTime(this._sfx, t, 0.03);
    if (this.music) this.music.silent = this._muted;
  }

  private visibility() {
    const ctx = this.rig?.ctx as AudioContext | undefined;
    if (!ctx || this.paused) return;
    // timers stall in a hidden tab, which would leave the music in gaps
    guard(() => void (document.hidden ? ctx.suspend() : ctx.resume()).catch(() => {}));
  }

  private load() {
    guard(() => {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      this._muted = s.muted === true;
      if (typeof s.music === "number") this._music = unit(s.music);
      if (typeof s.sfx === "number") this._sfx = unit(s.sfx);
    });
  }

  private save() {
    guard(() => localStorage.setItem(KEY, JSON.stringify({ muted: this._muted, music: this._music, sfx: this._sfx })));
  }
}

/** Offline contexts have no close(), and their state means something else. */
const isLive = (ctx: BaseAudioContext) => "close" in ctx;

const unit = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1);

let warned = false;

function guard(f: () => void) {
  try {
    f();
  } catch (e) {
    if (!warned) console.warn("audio:", e);
    warned = true;
  }
}

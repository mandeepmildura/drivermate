// Wraps the Web Speech API for hands-free instruction playback.
//
// Browsers block speechSynthesis until the user has interacted with the page,
// so the run screen surfaces an "Unlock audio" button that calls unlockSpeech()
// from inside the click handler. After that the rest of the app can speak()
// freely until the page is reloaded.

const MUTE_STORAGE_KEY = 'drivermate.muted';
const DEDUPE_WINDOW_MS = 60_000;

let unlocked = false;
const recentlySpoken = new Map<string, number>();

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isUnlocked(): boolean {
  return unlocked;
}

export function isMuted(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
}

export function setMuted(value: boolean): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MUTE_STORAGE_KEY, value ? '1' : '0');
  }
  if (value && isSpeechSupported()) window.speechSynthesis.cancel();
}

export function unlockSpeech(): void {
  if (!isSpeechSupported() || unlocked) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  window.speechSynthesis.speak(u);
  unlocked = true;
}

interface SpeakOptions {
  rate?: number;
  pitch?: number;
  /** When false, allow this text to repeat even within the dedupe window. */
  dedupe?: boolean;
  /** When true, cancel any in-flight utterance first (e.g. urgent updates). */
  preempt?: boolean;
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (!isSpeechSupported() || isMuted() || !unlocked) return;

  if (opts.dedupe !== false) {
    const last = recentlySpoken.get(trimmed);
    if (last && Date.now() - last < DEDUPE_WINDOW_MS) return;
    recentlySpoken.set(trimmed, Date.now());
  }

  if (opts.preempt) window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(trimmed);
  u.rate = opts.rate ?? 1;
  u.pitch = opts.pitch ?? 1;

  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => v.lang === 'en-AU') ??
    voices.find((v) => v.lang.startsWith('en-AU')) ??
    voices.find((v) => v.lang.startsWith('en'));
  if (preferred) u.voice = preferred;

  window.speechSynthesis.speak(u);
}

export function cancelSpeech(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

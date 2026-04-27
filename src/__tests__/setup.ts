// Jest-style setup for Vitest. happy-dom gives us window/document; we add a
// fake IndexedDB so Dexie has something to talk to in node, and stub
// import.meta.env so modules that read VITE_* don't blow up at import time.
import 'fake-indexeddb/auto';

// happy-dom doesn't ship navigator.onLine — default it to true for sync tests
if (typeof navigator !== 'undefined' && !('onLine' in navigator)) {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
}

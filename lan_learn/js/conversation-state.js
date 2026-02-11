// Global Conversation State (single source of truth)
// - conversationNumber must never reset automatically
// - stored in localStorage and broadcast via window event

(function () {
  const STORAGE_KEY = 'gtongue_conversation_state_v1';
  const EVENT_NAME = 'gtongue:conversationStateChanged';

  const defaultState = {
    // The one GLOBAL conversation number that all pages should reflect
    conversationNumber: 1,
    // Helps consumers interpret dropdown binding (manual vs ai)
    mode: 'manual' // 'manual' | 'ai'
  };

  function safeParse(json, fallback) {
    try {
      const v = JSON.parse(json);
      return v && typeof v === 'object' ? v : fallback;
    } catch {
      return fallback;
    }
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? safeParse(raw, null) : null;
    const merged = {
      ...defaultState,
      ...(stored || {})
    };

    // Guardrails
    const n = Number(merged.conversationNumber);
    merged.conversationNumber = Number.isFinite(n) && n >= 1 ? Math.floor(n) : defaultState.conversationNumber;
    merged.mode = merged.mode === 'ai' ? 'ai' : 'manual';

    return merged;
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // non-fatal
      console.warn('Failed to persist conversation state', e);
    }
  }

  let state = load();

  function emit() {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { ...state } }));
  }

  const ConversationState = {
    get() {
      return { ...state };
    },

    /**
     * Set global conversation number.
     * This MUST be called whenever dropdown/header/content changes.
     */
    setConversationNumber(conversationNumber, mode) {
      const n = Number(conversationNumber);
      if (!Number.isFinite(n) || n < 1) return;
      const next = {
        ...state,
        conversationNumber: Math.floor(n),
        mode: mode === 'ai' ? 'ai' : 'manual'
      };
      state = next;
      save(state);
      emit();
    },

    /**
     * Convenience: keep any UI elements in sync (header labels, etc.)
     * Pages can call this after navigation.
     */
    syncUI() {
      const { conversationNumber } = state;
      const numberEls = document.querySelectorAll('[data-global-conversation-number]');
      numberEls.forEach((el) => {
        el.textContent = String(conversationNumber);
      });
    },

    onChange(handler) {
      if (typeof handler !== 'function') return () => {};
      const fn = (e) => handler(e.detail);
      window.addEventListener(EVENT_NAME, fn);
      return () => window.removeEventListener(EVENT_NAME, fn);
    }
  };

  window.ConversationState = ConversationState;

  // Initial UI sync for any already-rendered nodes
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ConversationState.syncUI());
  } else {
    ConversationState.syncUI();
  }
})();


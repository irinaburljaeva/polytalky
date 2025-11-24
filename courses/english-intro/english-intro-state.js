// courses/english-intro/english-intro-state.js
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  doc,
  setDoc,
  arrayUnion,
  getDoc
} from "https://www.gstatic.com/firebase/10.7.1/firebase-firestore.js";

(function (global) {
  const STORAGE_KEY = "englishIntroState-v1";

  const defaultState = {
    completedLessons: [],   // ['lesson-01-hello', ...]
    lastLessonId: null,
    xp: 0,
    streakDays: 0,
    lastStudyDate: null,    // 'YYYY-MM-DD'
    vocab: []               // { id, word, translation, lessonId, tags, example }
  };

  function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed, vocab: parsed.vocab || [] };
    } catch (e) {
      console.warn("englishIntro: cannot load state", e);
      return { ...defaultState };
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("englishIntro: cannot save state", e);
    }
  }

  function addXp(state, amount) {
    const today = todayStr();
    state.xp += amount;
    if (!state.lastStudyDate) {
      state.streakDays = 1;
    } else if (state.lastStudyDate !== today) {
      state.streakDays += 1;
    }
    state.lastStudyDate = today;
  }

  const api = {
    getState() {
      return load();
    },

    /** Отметить урок пройденным + выдать XP */
    completeLesson(lessonId, xpAmount = 10) {
      const state = load();
      if (!state.completedLessons.includes(lessonId)) {
        state.completedLessons.push(lessonId);
        state.lastLessonId = lessonId;
        addXp(state, xpAmount);
        save(state);
      } else {
        state.lastLessonId = lessonId;
        save(state);
      }
    },

    /** Вернуть массив id пройденных уроков */
    getCompletedLessons() {
      return load().completedLessons;
    },

    getLastLessonId() {
      return load().lastLessonId;
    },

    getXp() {
      return load().xp;
    },

    getStreakDays() {
      return load().streakDays;
    },

    /** Добавить слово в словарик */
    addVocab({ word, translation, lessonId = null, tags = [], example = "" }) {
      if (!word || !translation) return;
      const state = load();
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      state.vocab.push({ id, word, translation, lessonId, tags, example });
      save(state);
    },

    /** Удалить слово по id (если понадобится) */
    removeVocab(id) {
      const state = load();
      state.vocab = (state.vocab || []).filter((w) => w.id !== id);
      save(state);
    },

    /** Получить все слова словарика */
    getVocab() {
      return load().vocab || [];
    },

    /** Очистить всё (для тестов / отладки) */
    resetAll() {
      save({ ...defaultState });
    }
  };

  global.EnglishIntro = api;
})(window);

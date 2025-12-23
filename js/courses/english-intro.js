// ==============================================
//   PolyTalky — English Intro (универсальный код курса)
// ==============================================

// Firebase Auth + Firestore
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  doc,
  setDoc,
  arrayUnion,
  getDoc,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { saveProAnswer } from "/js/pro-submissions.js";

// firebaseInit.js уже создал глобальные объекты
const auth = window.firebaseAuth;
const db   = window.firebaseDb;

// Конфиг урока (из HTML)
const config = window.lessonConfig || {};

const LESSON_ID        = config.lessonId        || "";
const LESSON_SLUG      = config.lessonSlug      || "";
const COURSE_ID        = config.courseId        || "";
const COURSE_TITLE     = config.courseTitle     || COURSE_ID || "";
const LESSON_TITLE     = config.lessonTitle     || LESSON_ID || "";
const LESSON_QA_DOC_ID = config.lessonQaDocId   || LESSON_ID;
const SUBMISSIONS_ROOT = config.submissionsRoot || "lessonSubmissions";
const TOTAL_STEPS      = config.totalSteps      || null;
const AUDIO_NEXT_STEP  = config.audioNextStep   || null;
const VOCAB_CATEGORY   = config.vocabCategory   || "";
const HAS_HELLO_TASK   = !!config.hasHelloTask;
const AWARD_ON_COMPLETE = config.awardOnComplete || null;

// Состояние пользователя
let currentUser = null;
let isProUser   = false;

function getUserKey() {
  if (!currentUser) return null;
  if (currentUser.email) return currentUser.email.toLowerCase(); 
  return currentUser.uid;
}

//
// ====== ЗАГРУЗКА ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ (PRO) ======
//
async function loadUserProfile(user) {
  isProUser = false;
  if (!user) return;

  try {
    const email = user.email || null;
    const uid   = user.uid   || null;

    const usersCol = collection(db, "users");

    const emailRef = email ? doc(usersCol, email) : null;
    const uidRef   = uid   ? doc(usersCol, uid)   : null;

    const [emailSnap, uidSnap] = await Promise.all([
      emailRef ? getDoc(emailRef) : null,
      uidRef   ? getDoc(uidRef)   : null
    ]);

    const emailData = emailSnap && emailSnap.exists() ? emailSnap.data() : null;
    const uidData   = uidSnap   && uidSnap.exists()   ? uidSnap.data()   : null;

    const merged = { ...(uidData || {}), ...(emailData || {}) };

    // универсальное определение PRO
    const proGlobal = merged.proGlobal === true;
    const legacyPro = merged.proActive || merged.isPro || merged.hasPro || (merged.pro && merged.pro.active);

    let proValidUntil = merged.proValidUntil || merged.proUntil || null;
    if (proValidUntil && typeof proValidUntil.toDate === "function") {
      proValidUntil = proValidUntil.toDate();
    }

    let active = proGlobal || legacyPro;

    if (proValidUntil instanceof Date) {
      if (proValidUntil <= new Date()) active = false;
    }

    isProUser = !!active;

  } catch (e) {
    console.error("Ошибка загрузки профиля PRO:", e);
  }
}

//
// ====== ПОДГРУЗКА ПРОШЛЫХ ОТВЕТОВ (ЛЮБЫХ!) ======
//
const audioPlay = document.getElementById("audio-playback");
const audioFeedback = document.getElementById("audio-feedback");
async function loadProAnswers() {
  if (!currentUser || !isProUser || !LESSON_ID) return;

  try {
    const answersCol = collection(db, SUBMISSIONS_ROOT, LESSON_ID, "answers");

    let qRef = query(
      answersCol,
      where("userUid", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(50)                 // ← загружаем ВСЕ задания урока
    );

    let snap = await getDocs(qRef);

    // fallback по email
    if (snap.empty && currentUser.email) {
      qRef = query(
        answersCol,
        where("userEmail", "==", currentUser.email),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      snap = await getDocs(qRef);
    }

    if (snap.empty) return;

    const docs = snap.docs.map(d => d.data());

    //
    // 1) Универсальная подстановка текстовых ответов по taskId
    //
    docs.forEach(docData => {
      if (!docData.taskId) return;

      const el = document.querySelector(`[data-task-id="${docData.taskId}"]`);
      if (!el) return;

      if (typeof docData.answerText === "string") {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.value = docData.answerText;
        } else if (el.isContentEditable) {
          el.innerText = docData.answerText;
        } else {
          el.textContent = docData.answerText;
        }
      }
    });

    //
    // 2) Логика hello — только если урок поддерживает это задание
    //
    if (HAS_HELLO_TASK) {
      const helloInput = document.getElementById("task-hello-input");
      if (helloInput) {
        const helloDoc = docs.find(d => d.taskId === "hello");
        if (helloDoc && helloDoc.answerText) {
          helloInput.value = helloDoc.answerText;
        }
      }
    }

    //
    // 3) Аудио — подставляем первую запись
    //
    const audioDoc = docs.find(d => d.answerAudioBase64);
    if (audioDoc && audioDoc.answerAudioBase64 && audioPlay) {
      audioPlay.src =
        "data:audio/webm;base64," + audioDoc.answerAudioBase64;
      audioPlay.style.display = "block";
    }

  } catch (e) {
    console.error("Ошибка подгрузки PRO-ответов:", e);
  }
}

//
// ====== Авторизация ======
//
const feedbackLink = document.getElementById("feedback-link");
const loginBtn     = document.getElementById("login-btn");
const userStatus   = document.getElementById("user-status");

if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    window.open("/student/", "_blank");
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    if (userStatus) userStatus.textContent = `Вы вошли как: ${user.email}`;
    if (loginBtn)   loginBtn.classList.add("hidden");

    await loadUserProfile(user);
    await loadProAnswers();

    if (feedbackLink) {
      feedbackLink.classList.toggle("hidden", !isProUser);
    }
  } else {
    currentUser = null;
    isProUser   = false;
    if (userStatus) userStatus.textContent = "Вы не авторизованы";
    if (loginBtn)   loginBtn.classList.remove("hidden");
    if (feedbackLink) feedbackLink.classList.add("hidden");
  }

  //
  // НЕ-PRO: подставляем своё сохранённое hello (если урок это поддерживает)
  //
  if (!isProUser && HAS_HELLO_TASK) {
    const helloInput = document.getElementById("task-hello-input");
    if (helloInput) {
      const key   = `${LESSON_ID}_hello`;
      const saved = localStorage.getItem(key);
      if (saved) helloInput.value = saved;
    }
  }
});

//
// ====== Переходы между шагами ======
//
const stepPanels = document.querySelectorAll(".step-panel");
const stepDots   = document.querySelectorAll(".step-dot");
let currentStep  = 1;
let maxStepReached = 1;

function showStep(n) {
  stepPanels.forEach(p => p.classList.remove("step-panel--visible"));
  const panel = document.getElementById(`step-${n}`);
  if (panel) panel.classList.add("step-panel--visible");

  stepDots.forEach(dot => {
    dot.classList.remove("step-dot--active", "step-dot--done");
    const s = Number(dot.dataset.step);
    if (s < n) dot.classList.add("step-dot--done");
    if (s === n) dot.classList.add("step-dot--active");
  });

  const total = TOTAL_STEPS || stepDots.length;
  if (n === total) {
    saveLessonProgressAndBadge().catch(console.error);
  }

  currentStep = n;
  if (n > maxStepReached) maxStepReached = n;
}

stepDots.forEach(dot => {
  dot.addEventListener("click", () => {
    const t = Number(dot.dataset.step);
    if (!t) return;
    if (t > maxStepReached) return;
    showStep(t);
  });
});

document.querySelectorAll(".next-step-btn").forEach(btn => {
  if (btn.id === "task-hello-submit") return;
  btn.addEventListener("click", () => {
    const next = Number(btn.dataset.next);
    if (next) showStep(next);
  });
});

//
// ====== Приветствие (только если урок его поддерживает) ======
const helloInput    = document.getElementById("task-hello-input");
const helloBtn      = document.getElementById("task-hello-submit");
const helloFeedback = document.getElementById("hello-feedback");

if (HAS_HELLO_TASK && helloBtn && helloInput) {
  helloBtn.addEventListener("click", async () => {
    const val = helloInput.value.trim();
    if (!val) {
      alert("Напишите любое английское приветствие 🙂");
      return;
    }

    if (helloFeedback) helloFeedback.classList.remove("hidden");

    if (currentUser && isProUser) {
      try {
        await saveProAnswer({
          db,
          user: currentUser,
          submissionsRoot: SUBMISSIONS_ROOT,

          courseId: COURSE_ID,
          courseTitle: COURSE_TITLE,

          lessonId: LESSON_ID,
          lessonTitle: LESSON_TITLE,

          taskId: "hello",
          step: 1,
          answerText: val
        });
      } catch (e) {
        console.error("Ошибка сохранения hello:", e);
      }
    } else {
      const key = `${LESSON_ID}_hello`;
      localStorage.setItem(key, val);
    }

    setTimeout(() => {
      if (helloFeedback) helloFeedback.classList.add("hidden");
      showStep(2);
    }, 1200);
  });
}

//
// ====== Аудиозапись и отправка аудио ======
let mediaRecorder = null;
let audioChunks   = [];
let audioStream   = null;

const recordBtn        = document.getElementById("record-btn");
const stopBtn          = document.getElementById("stop-btn");
const recordingWrapper = document.getElementById("recording-wrapper");
const recordingBar     = document.getElementById("recording-bar");
const recordingStatus  = document.getElementById("recording-status");

let recordingInterval = null;
let recordingProgress = 0;

if (recordBtn && stopBtn && audioPlay) {

  const canRecord =
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined";

  if (!canRecord) {
    recordBtn.disabled = true;
    stopBtn.disabled   = true;
    recordBtn.textContent = "Запись недоступна в этом браузере";
        if (recordingWrapper) recordingWrapper.classList.add("hidden");
  }

  else {
    recordBtn.addEventListener("click", async () => {
      try {
        audioChunks = [];

        if (audioStream) {
          audioStream.getTracks().forEach(t => t.stop());
        }

        audioStream   = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(audioStream);

        mediaRecorder.addEventListener("dataavailable", e => {
          if (e.data && e.data.size > 0) {
            audioChunks.push(e.data);
          }

        });

        mediaRecorder.addEventListener("stop", () => {
          if (audioStream) {
            audioStream.getTracks().forEach(t => t.stop());
            audioStream = null;
          }

          if (recordingInterval) {
            clearInterval(recordingInterval);
            recordingInterval = null;
          }

               if (!audioChunks.length) {
            if (recordingWrapper) recordingWrapper.classList.add("hidden");
            if (recordingStatus) {
              recordingStatus.classList.add("hidden");
              recordingStatus.textContent = "● Идёт запись…";
            }
            if (recordingBar) recordingBar.style.width = "0%";

            if (audioFeedback) {
              audioFeedback.textContent = "Кажется, запись не сохранилась. Попробуйте ещё раз 😊";
              audioFeedback.classList.remove("hidden");
              setTimeout(() => audioFeedback.classList.add("hidden"), 2500);
            }
            return;
          }

          const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
          const url       = URL.createObjectURL(audioBlob);
          audioPlay.src   = url;
          audioPlay.style.display = "block";

          if (recordingWrapper) recordingWrapper.classList.add("hidden");
          if (recordingStatus) {
            recordingStatus.textContent = "✓ Запись завершена";
            setTimeout(() => {
              recordingStatus.classList.add("hidden");
              recordingStatus.textContent = "● Идёт запись…";
            }, 1500);
          }
          if (recordingBar) recordingBar.style.width = "100%";

          const nextStepAfterAudio = AUDIO_NEXT_STEP || stepDots.length;



          // сохранить PRO-аудио
      const retryBtn = document.getElementById("retry-btn");
          if (retryBtn) retryBtn.classList.add("hidden");

function showAudioError(msg) {
  if (audioFeedback) {
    audioFeedback.textContent = msg;
    audioFeedback.classList.remove("hidden");
  }
  if (retryBtn) retryBtn.classList.remove("hidden");
}

function hideRetry() {
  if (retryBtn) retryBtn.classList.add("hidden");
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.onloadend = () => {
      const base64 = (reader.result || "").toString().split(",")[1] || "";
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

// ... внутри mediaRecorder.addEventListener("stop", () => { ... })
const nextStepAfterAudio = AUDIO_NEXT_STEP || stepDots.length;

// Спрячем "перезаписать" на успешном сценарии
hideRetry();

// сохранить PRO-аудио (и только потом переходить дальше)
(async () => {
  try {
    if (currentUser && isProUser) {
      const base64 = await blobToBase64(audioBlob);
      if (!base64) {
        throw new Error("Empty base64 audio");
      }

      await saveProAnswer({
        db,
        user: currentUser,
        submissionsRoot: SUBMISSIONS_ROOT,

        courseId: COURSE_ID,
        courseTitle: COURSE_TITLE,

        lessonId: LESSON_ID,
        lessonTitle: LESSON_TITLE,

        taskId: "audio",
        step: AUDIO_NEXT_STEP || currentStep,
        answerAudioBase64: base64
      });
    }

    // ✅ успех
    if (audioFeedback) {
      audioFeedback.textContent = "⭐️ Отлично получилось! Вы молодец.";
      audioFeedback.classList.remove("hidden");
    }

    setTimeout(() => {
      if (audioFeedback) audioFeedback.classList.add("hidden");
      showStep(nextStepAfterAudio);
    }, 1800);

  } catch (e) {
    console.error("Ошибка сохранения аудио:", e);

    // ❌ ошибка — остаёмся на шаге, даём перезаписать
    showAudioError("Не удалось сохранить запись 😔 Нажмите «Перезаписать» и попробуйте ещё раз.");
  
  }
})();

        //
        // Старт записи
        //
                mediaRecorder.start();
        recordBtn.disabled = true;
        stopBtn.disabled   = false;
        if (audioFeedback) audioFeedback.classList.add("hidden");

        if (recordingWrapper && recordingBar && recordingStatus) {
          recordingWrapper.classList.remove("hidden");
          recordingStatus.classList.remove("hidden");
          recordingStatus.textContent = "● Идёт запись…";
          recordingProgress = 0;
          recordingBar.style.width = "0%";

          if (recordingInterval) {
            clearInterval(recordingInterval);
          }
          recordingInterval = setInterval(() => {
            recordingProgress += 3;
            if (recordingProgress > 100) recordingProgress = 100;
            recordingBar.style.width = recordingProgress + "%";
          }, 200);
        }
      } catch (err) {
        console.error("Ошибка при записи:", err);
        alert("Не удалось получить доступ к микрофону. Проверьте разрешения в браузере и попробуйте ещё раз.");
        if (recordingWrapper) recordingWrapper.classList.add("hidden");
        if (recordingStatus)  recordingStatus.classList.add("hidden");
      }
    });

    //
    // Остановка записи
    //
      stopBtn.addEventListener("click", () => {
      if (!mediaRecorder) {
        console.warn("mediaRecorder не инициализирован");
        return;
      }
      if (mediaRecorder.state !== "recording") {
        console.warn("Запись не активна");
        return;
      }

      try {
        mediaRecorder.stop();
        recordBtn.disabled = false;
        stopBtn.disabled   = true;
      } catch (err) {
        console.error("Ошибка при остановке записи:", err);
        recordBtn.disabled = false;
        stopBtn.disabled   = true;
      }
    });
  }
}


//
// ====== Q&A ======
const qaModal      = document.getElementById("qa-modal");
const qaCloseBtn   = document.getElementById("qa-close");
const qaList       = document.getElementById("qa-list");
const qaForm       = document.getElementById("qa-form");
const qaText       = document.getElementById("qa-text");
const qaSubmitBtn  = document.getElementById("qa-submit");
const qaOpenBtns   = document.querySelectorAll("[data-open-qa]");

if (qaOpenBtns && qaModal && qaList && qaForm && qaText && qaSubmitBtn) {
  qaOpenBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      qaModal.classList.remove("hidden");
      qaModal.classList.add("flex");
      loadQuestions().catch(console.error);
    });
  });

  qaForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = qaText.value.trim();
    if (!text) {
      alert("Напишите вопрос, пожалуйста ");
      return;
    }

    if (!currentUser) {
      alert("Чтобы задать вопрос, нужно войти в аккаунт на странице /student/.");
      return;
    }

    qaSubmitBtn.disabled = true;
    qaSubmitBtn.textContent = "Отправляем...";

    try {
      const colRef = collection(db, "lessons", LESSON_QA_DOC_ID, "questions");

      await addDoc(colRef, {
        text,
        userId:    currentUser.email || currentUser.uid,
        userEmail: currentUser.email || null,
        createdAt: serverTimestamp(),
        answer: null
      });

      qaText.value = "";
      await loadQuestions();
    } catch (err) {
      console.error(err);
      alert("Не удалось отправить вопрос, попробуйте позже.");
    } finally {
      qaSubmitBtn.disabled = false;
      qaSubmitBtn.textContent = "Отправить →";
    }
  });

  qaCloseBtn.addEventListener("click", () => {
    qaModal.classList.add("hidden");
    qaModal.classList.remove("flex");
  });

  qaModal.addEventListener("click", (e) => {
    if (e.target === qaModal) {
      qaModal.classList.add("hidden");
      qaModal.classList.remove("flex");
    }
  });

  async function loadQuestions() {
    const colRef = collection(db, "lessons", LESSON_QA_DOC_ID, "questions");
    const qRef   = query(colRef, orderBy("createdAt", "desc"));
    const snap   = await getDocs(qRef);

    qaList.innerHTML = "";

    if (snap.empty) {
      qaList.innerHTML = `
        <p class="text-xs text-gray-500">
          Пока вопросов нет — вы можете быть первым 🙂
        </p>`;
      return;
    }

    snap.forEach(docSnap => {
      const data = docSnap.data();

      const item = document.createElement("div");
      item.className = "mb-4 pb-3 border-b border-gray-200";

      const author = data.userEmail || "Ученик";

      item.innerHTML = `
        <p class="text-[0.85rem] font-medium text-gray-800">
          ❓ ${data.text}
        </p>
        <p class="text-[0.7rem] text-gray-400 mt-1">
          от ${author}
        </p>
        ${
          data.answer
          ? `<p class="text-[0.8rem] text-emerald-800 mt-2"><b>Ответ:</b> ${data.answer}</p>`
          : `<p class="text-[0.75rem] text-gray-400 mt-2">Ответ появится позже.</p>`
        }
      `;

      qaList.appendChild(item);
    });
  }
}

//
// ====== Озвучка слов ======
let englishVoices = [];

if ("speechSynthesis" in window && window.speechSynthesis) {
  const loadVoices = () => {
    englishVoices = window.speechSynthesis
      .getVoices()
      .filter(v => v.lang && v.lang.toLowerCase().startsWith("en"));
  };
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}
function speakWord(word) {
  if (!("speechSynthesis" in window) || !window.speechSynthesis) return;
if (!englishVoices.length) {
  englishVoices = window.speechSynthesis
  .getVoices()
  .filter(v => v.lang && v.lang.toLowerCase().startsWith("en"));
}
  
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang   = "en-US";
  utter.rate   = 0.8;

  if (englishVoices.length > 0) {
    utter.voice = englishVoices[0];
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}
window.speakWord = speakWord;

document.querySelectorAll(".word-tip").forEach(tip => {
  tip.addEventListener("click", () => {
    const word = tip.textContent.trim();
    if (word) speakWord(word);
  });
});

// ====== Сохранение прогресса, XP и streak ======
async function saveLessonProgressAndBadge() {
  if (!currentUser || !db) return;

  const userKey = getUserKey();
  if (!userKey) return;

  try {
    // === 1) Прогресс по уроку ===
    const progressCol = collection(db, "progress");
    const progressId  = `${COURSE_ID}__${LESSON_ID}__${userKey}`;
    const progressRef = doc(progressCol, progressId);

    await setDoc(
      progressRef,
      {
        userId:      userKey,
        courseId:    COURSE_ID,
        lessonId:    LESSON_ID,
        lessonSlug:  LESSON_SLUG,
        completedAt: serverTimestamp()
      },
      { merge: true }
    );

    // === 2) Выдача бейджа (если указан) ===
    if (AWARD_ON_COMPLETE) {
      const userRef = doc(db, "users", userKey);
      await setDoc(
        userRef,
        { badges: arrayUnion(AWARD_ON_COMPLETE) },
        { merge: true }
      );
    }

    // === 3) XP + streak (вариант А) ===
    const userRef = doc(db, "users", userKey);
    const snap = await getDoc(userRef);

    const today = new Date().toISOString().slice(0, 10);

    let xp = 0;
    let streakDays = 1;
    let lastStudyDate = today;

    if (snap.exists()) {
      const data = snap.data();

      // XP
      xp = (data.xp || 0) + 10;

      // STREAK
      if (data.lastStudyDate === today) {
        // уже занимались сегодня — streak не растёт
        streakDays = data.streakDays || 1;
      } else {
        // новый день — увеличиваем streak
        streakDays = (data.streakDays || 0) + 1;
      }
    } else {
      xp = 10; // первый урок в жизни
      streakDays = 1;
    }

    await setDoc(
      userRef,
      {
        xp,
        streakDays,
        lastStudyDate: today
      },
      { merge: true }
    );

  } catch (e) {
    console.error("Ошибка сохранения прогресса / XP / streak:", e);
  }
}
// ====== Словарик (слова из таблиц) ======
const openVocabBtn    = document.getElementById("open-vocab-btn");
const vocabModal      = document.getElementById("vocab-modal");
const vocabClose      = document.getElementById("vocab-close");
const vocabSaveBtn    = document.getElementById("vocab-save");
const vocabSelectAll  = document.getElementById("vocab-select-all");
const vocabListVowels = document.getElementById("vocab-vowels");
const vocabAuthWarn   = document.getElementById("vocab-auth-warning");

function buildVocabEntries() {
  const entries = [];
  // 🔥 если customVocab есть — берем только его
  if (config.customVocab && Array.isArray(config.customVocab)) {
    return config.customVocab.map(item => ({
      word: item.word.toLowerCase(),
      translation: item.ru || ""
    }));
  }

  // === Урок 4: берём слова из скрытого источника ===
  if (LESSON_SLUG === "lesson-04-tenses") {
    const tips = document.querySelectorAll("#lesson4-vocab-source .word-tip");
    const map = new Map();

    tips.forEach(tip => {
      const word = tip.textContent.trim().toLowerCase();
      const ru   = (tip.dataset.ru || "").trim();

      if (word && !map.has(word)) map.set(word, ru);
    });

    return Array.from(map.entries()).map(([word, translation]) => ({
      word,
      translation
    }));
  }

 
  // Урок 3: слова перечислены вручную
  if (LESSON_SLUG === "lesson-03") {
    document.querySelectorAll(".vocab-list li").forEach(li => {
      const word = li.textContent.trim().toLowerCase();
      if (word && /^[a-z]+$/.test(word)) {
        entries.push({ word, translation: "" });
      }
    });
    return entries;
  }

  // Урок 1 (и другие со словарём в таблицах)
  const tips = document.querySelectorAll("#step-3 .word-tip");
  const map  = new Map();

  tips.forEach(tip => {
    const w  = tip.textContent.trim().toLowerCase();
    const ru = (tip.dataset.ru || "").trim();
    if (/^[a-z]+$/.test(w) && !map.has(w)) {
      map.set(w, ru);
    }
  });

  return Array.from(map.entries()).map(([word, translation]) => ({
    word,
    translation
  }));
}

function renderVocabWords() {
  if (!vocabListVowels) return;

  const entries = buildVocabEntries();
  vocabListVowels.innerHTML = "";

  entries.forEach(({ word, translation }) => {
    const label = document.createElement("label");
    label.className = "flex items-center gap-2 text-[0.85rem]";

    const ruPart = translation
      ? `<span class="text-gray-400 text-[0.78rem] ml-1">— ${translation}</span>`
      : "";

    label.innerHTML = `
      <input type="checkbox"
             class="vocab-word"
             data-word="${word}"
             data-ru="${translation}"
             data-category="${VOCAB_CATEGORY}">
      <span>${word}</span>
      ${ruPart}
    `;

    vocabListVowels.appendChild(label);
  });
}

function initVocabModal() {
  // Если какого-то элемента нет (например, в уроке без словарика) — тихо выходим
  if (!openVocabBtn || !vocabModal || !vocabClose || !vocabSaveBtn || !vocabSelectAll) {
    return;
  }

  openVocabBtn.addEventListener("click", () => {
    vocabModal.classList.remove("hidden");
    vocabModal.classList.add("flex");

    renderVocabWords();

    if (!currentUser) {
      if (vocabAuthWarn) vocabAuthWarn.classList.remove("hidden");
      vocabSaveBtn.disabled = true;
    } else {
      if (vocabAuthWarn) vocabAuthWarn.classList.add("hidden");
      vocabSaveBtn.disabled = false;
    }
  });

  vocabClose.addEventListener("click", () => {
    vocabModal.classList.add("hidden");
    vocabModal.classList.remove("flex");
  });

  vocabSelectAll.addEventListener("click", () => {
    const boxes = document.querySelectorAll(".vocab-word");
    const anyUnchecked = Array.from(boxes).some(b => !b.checked);
    boxes.forEach(b => { b.checked = anyUnchecked; });
  });

  async function saveWordsToFirestore(entries) {
    if (!currentUser) return;
    const userKey = getUserKey();
    if (!userKey) return;

    const colRef = collection(db, `users/${userKey}/vocabulary`);

    for (const { word, translation } of entries) {
      await addDoc(colRef, {
        word,
        translation: translation || "",
        lesson:      LESSON_SLUG,
        courseId:    COURSE_ID,
        category:    VOCAB_CATEGORY || "",
        addedAt:     serverTimestamp()
      });
    }
  }

  vocabSaveBtn.addEventListener("click", async () => {
    if (!currentUser) {
      alert("Войдите, чтобы сохранить слова.");
      return;
    }

    const checked = Array
      .from(document.querySelectorAll(".vocab-word"))
      .filter(cb => cb.checked)
      .map(cb => ({
        word: cb.dataset.word,
        translation: cb.dataset.ru || ""
      }));

    if (checked.length === 0) {
      alert("Выберите хотя бы одно слово.");
      return;
    }

    vocabSaveBtn.disabled  = true;
    vocabSaveBtn.textContent = "Сохраняем...";

    await saveWordsToFirestore(checked);

    vocabSaveBtn.textContent = "Готово!";
    setTimeout(() => {
      vocabModal.classList.add("hidden");
      vocabModal.classList.remove("flex");
      vocabSaveBtn.disabled   = false;
      vocabSaveBtn.textContent = "Добавить выбранные →";
    }, 700);
  });
}

initVocabModal();

// Старт: показываем первый шаг
showStep(1);

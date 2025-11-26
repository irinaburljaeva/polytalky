// ==============================================
//   PolyTalky — English Intro: общая логика курса
// ==============================================

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
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase (инициализирован в firebase-init.js в <head>)
const auth = window.firebaseAuth;
const db   = window.firebaseDb;

// Конфиг текущего урока
const config = window.lessonConfig || {};

const LESSON_ID        = config.lessonId        || "";
const LESSON_SLUG      = config.lessonSlug      || "";
const COURSE_ID        = config.courseId        || "";
const LESSON_QA_DOC_ID = config.lessonQaDocId   || LESSON_ID;
const SUBMISSIONS_ROOT = config.submissionsRoot || "lessonSubmissions";
const TOTAL_STEPS      = config.totalSteps      || null;
const AUDIO_NEXT_STEP  = config.audioNextStep   || null;
const VOCAB_CATEGORY   = config.vocabCategory   || "";

// Состояние пользователя
let currentUser = null;
let isProUser   = false;

// Хелпер ключа пользователя
function getUserKey() {
  if (!currentUser) return null;
  if (currentUser.email) return currentUser.email.toLowerCase();
  return currentUser.uid;
}

// ====== Профиль пользователя / PRO ======
async function loadUserProfile(user) {
  isProUser = false;
  if (!user) return;

  try {
    const email = user.email || null;
    const uid   = user.uid   || null;
    if (!email && !uid) return;

    const usersCol = collection(db, "users");
    const emailRef = email ? doc(usersCol, email) : null;
    const uidRef   = uid   ? doc(usersCol, uid)   : null;

    const [emailSnap, uidSnap] = await Promise.all([
      emailRef ? getDoc(emailRef) : Promise.resolve(null),
      uidRef   ? getDoc(uidRef)   : Promise.resolve(null),
    ]);

    const emailData = emailSnap && emailSnap.exists() ? (emailSnap.data() || {}) : null;
    const uidData   = uidSnap   && uidSnap.exists()   ? (uidSnap.data()   || {}) : null;

    const merged = { ...(uidData || {}), ...(emailData || {}) };
    if (!Object.keys(merged).length) {
      isProUser = false;
      return;
    }

    const proGlobal = merged.proGlobal === true;
    let proValidUntil = merged.proValidUntil || merged.proUntil || null;
    if (proValidUntil && typeof proValidUntil.toDate === "function") {
      proValidUntil = proValidUntil.toDate();
    }

    const legacyPro =
      merged.proActive ||
      merged.isPro ||
      merged.hasPro ||
      (merged.pro && merged.pro.active);

    let active = !!(proGlobal || legacyPro);

    if (proValidUntil instanceof Date) {
      const now = new Date();
      if (proValidUntil <= now) {
        active = false;
      }
    }

    isProUser = active;
  } catch (e) {
    console.error("Не удалось загрузить профиль пользователя:", e);
    isProUser = false;
  }
}

// ====== Загрузка PRO-ответов (hello + аудио) ======
const audioPlay = document.getElementById("audio-playback");

async function loadProAnswers() {
  if (!currentUser || !isProUser || !LESSON_ID) return;

  const userKey = getUserKey();
  if (!userKey) return;

  try {
    const ref  = doc(db, SUBMISSIONS_ROOT, LESSON_ID, "answers", userKey);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();

    // hello-ответ (если поле есть)
    const helloInput = document.getElementById("task-hello-input");
    if (data.helloAnswer && helloInput) {
      helloInput.value = data.helloAnswer;
    }

    // аудио-ответ
    if (data.audioAnswerBase64 && audioPlay) {
      const url = "data:audio/webm;base64," + data.audioAnswerBase64;
      audioPlay.src = url;
      audioPlay.style.display = "block";
    }
  } catch (e) {
    console.error("Не удалось загрузить ответы по уроку:", e);
  }
}

// ====== Элементы шапки ======
const feedbackLink = document.getElementById("feedback-link");
const loginBtn     = document.getElementById("login-btn");
const userStatus   = document.getElementById("user-status");

if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    window.open("/student/", "_blank");
  });
}

// ====== Авторизация ======
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    if (userStatus) userStatus.textContent = `Вы вошли как: ${user.email}`;
    if (loginBtn)   loginBtn.classList.add("hidden");

    await loadUserProfile(user);
    await loadProAnswers();

    if (feedbackLink) {
      if (isProUser) feedbackLink.classList.remove("hidden");
      else           feedbackLink.classList.add("hidden");
    }
  } else {
    currentUser = null;
    isProUser   = false;
    if (userStatus) userStatus.textContent = "Вы не авторизованы";
    if (loginBtn)   loginBtn.classList.remove("hidden");
    if (feedbackLink) feedbackLink.classList.add("hidden");
  }

  // Для НЕ-PRO в уроке 1 подставляем приветствие из localStorage
  if (!isProUser && LESSON_SLUG === "lesson-01-hello") {
    const helloInput = document.getElementById("task-hello-input");
    if (helloInput) {
      const saved = localStorage.getItem("lesson1_hello") || "";
      if (saved) helloInput.value = saved;
    }
  }
});

// ====== Общие UI-элементы ======
const stepPanels      = document.querySelectorAll(".step-panel");
const stepDots        = document.querySelectorAll(".step-dot");

const openVocabBtn    = document.getElementById("open-vocab-btn");
const vocabModal      = document.getElementById("vocab-modal");
const vocabClose      = document.getElementById("vocab-close");
const vocabAuthWarn   = document.getElementById("vocab-auth-warning");
const vocabSaveBtn    = document.getElementById("vocab-save");
const vocabSelectAll  = document.getElementById("vocab-select-all");

const qaModal      = document.getElementById("qa-modal");
const qaCloseBtn   = document.getElementById("qa-close");
const qaList       = document.getElementById("qa-list");
const qaForm       = document.getElementById("qa-form");
const qaText       = document.getElementById("qa-text");
const qaSubmitBtn  = document.getElementById("qa-submit");
const qaOpenBtns   = document.querySelectorAll("[data-open-qa]");

const audioFeedback = document.getElementById("audio-feedback");

let currentStep = 1;
let maxStepReached = 1;

// ====== Прогресс + бейдж (только для урока 1) ======
async function saveLessonProgressAndBadge() {
  if (!currentUser || LESSON_SLUG !== "lesson-01-hello") return;

  const userKey = getUserKey();
  if (!userKey) return;

  try {
    // прогресс по курсу
    await setDoc(
      doc(db, "users", userKey),
      {
        progress: {
          [COURSE_ID]: {
            percent:     25,
            lastLessonId: LESSON_SLUG
          }
        }
      },
      { merge: true }
    );

    // бейдж
    const badgeId = "english-intro-lesson1";
    const badgePayload = {
      badgeId,
      title:    "Первое hello",
      courseId: COURSE_ID,
      lesson:   LESSON_SLUG,
      earnedAt: serverTimestamp()
    };

    await Promise.all([
      setDoc(
        doc(db, `users/${userKey}/badges/${badgeId}`),
        badgePayload,
        { merge: true }
      ),
      setDoc(
        doc(db, "users", userKey),
        { badges: arrayUnion(badgeId) },
        { merge: true }
      )
    ]);
  } catch (e) {
    console.error("Не удалось сохранить прогресс/бейдж:", e);
  }
}

// ====== Переход по шагам ======
function showStep(n) {
  stepPanels.forEach(p => p.classList.remove("step-panel--visible"));
  const panel = document.getElementById(`step-${n}`);
  if (panel) panel.classList.add("step-panel--visible");

  stepDots.forEach(dot => {
    dot.classList.remove("step-dot--active", "step-dot--done");
    const step = Number(dot.dataset.step);
    if (step < n)   dot.classList.add("step-dot--done");
    if (step === n) dot.classList.add("step-dot--active");
  });

  const total = TOTAL_STEPS || stepDots.length;
  if (n === total) {
    // В уроке 1 — сохраняем прогресс и выдаём бейдж
    saveLessonProgressAndBadge().catch(console.error);
  }

  currentStep = n;
  if (n> maxStepReached) {
    maxStepReached = n;
  }
}
// Клик по иконкам шагов: можно переходить только на уже достигнутые шаги
stepDots.forEach(dot => {
  dot.addEventListener("click", () => {
    const targetStep = Number(dot.dataset.step);
    if (!targetStep) return;

    // Нельзя прыгнуть дальше, чем уже дошли
    if (targetStep > maxStepReached) return;

    showStep(targetStep);
  });
});
// next-кнопки (кроме hello — у него своя логика)
document.querySelectorAll(".next-step-btn").forEach(btn => {
  if (btn.id === "task-hello-submit") return;
  btn.addEventListener("click", () => {
    const next = Number(btn.dataset.next);
    if (next) showStep(next);
  });
});

// ====== Сохранение заданий PRO (общая функция) ======
async function saveProSubmission(partialData) {
  if (!currentUser || !isProUser || !LESSON_ID) return;
  const userKey = getUserKey();
  if (!userKey) return;

  const answerRef = doc(
    db,
    SUBMISSIONS_ROOT,
    LESSON_ID,
    "answers",
    userKey
  );

  const baseData = {
    userEmail:  currentUser.email || null,
    userUid:    currentUser.uid,
    isPro:      true,
    courseId:   COURSE_ID,
    lessonSlug: LESSON_SLUG,
    updatedAt:  serverTimestamp()
  };

  await setDoc(
    answerRef,
    { createdAt: serverTimestamp(), ...baseData, ...partialData },
    { merge: true }
  );
}

// ====== Урок 1: мини-задание «приветствие» ======
const helloInput    = document.getElementById("task-hello-input");
const helloBtn      = document.getElementById("task-hello-submit");
const helloFeedback = document.getElementById("hello-feedback");

if (helloBtn && helloInput && LESSON_SLUG === "lesson-01-hello") {
  helloBtn.addEventListener("click", async () => {
    const val = helloInput.value.trim();
    if (!val) {
      alert("Напишите любое английское приветствие :)");
      return;
    }

    if (helloFeedback) helloFeedback.classList.remove("hidden");

    if (currentUser && isProUser) {
      // PRO: сохраняем для куратора
      try {
        await saveProSubmission({ helloAnswer: val });
      } catch (e) {
        console.error("Не удалось сохранить приветствие для PRO:", e);
      }
    } else {
      // НЕ PRO: просто в localStorage
      localStorage.setItem("lesson1_hello", val);
    }

    setTimeout(() => {
      if (helloFeedback) helloFeedback.classList.add("hidden");
      showStep(2);
    }, 1100);
  });
}

// ====== Аудиозапись ======
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
  } else {
    recordBtn.addEventListener("click", async () => {
      try {
        audioChunks = [];

        if (audioStream) {
          audioStream.getTracks().forEach(track => track.stop());
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
            audioStream.getTracks().forEach(track => track.stop());
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

          if (isProUser && currentUser) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res    = reader.result || "";
              const base64 = typeof res === "string"
                ? (res.split(",")[1] || "")
                : "";

              if (base64) {
                saveProSubmission({
                  audioAnswerBase64: base64
                }).catch(console.error);
              }
            };
            reader.readAsDataURL(audioBlob);
          }

          if (audioFeedback) {
            audioFeedback.textContent = "⭐️ Отлично получилось! Вы молодец.";
            audioFeedback.classList.remove("hidden");
          }

          setTimeout(() => {
            if (audioFeedback) audioFeedback.classList.add("hidden");
            showStep(nextStepAfterAudio);
          }, 1800);
        });

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

// ====== Q&A: модалка + Firestore ======
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
      alert("Напишите вопрос, пожалуйста 🙂");
      return;
    }

    if (!currentUser) {
      alert("Чтобы задать вопрос, нужно войти в аккаунт на странице /student/.");
      return;
    }

    qaSubmitBtn.disabled   = true;
    qaSubmitBtn.textContent = "Отправляем...";

    try {
      const colRef = collection(db, "lessons", LESSON_QA_DOC_ID, "questions");

      await addDoc(colRef, {
        text,
        userId:    currentUser.email || currentUser.uid,
        userEmail: currentUser.email || null,
        createdAt: serverTimestamp(),
        answer:    null
      });

      qaText.value = "";
      await loadQuestions();
    } catch (err) {
      console.error(err);
      alert("Не получилось отправить вопрос. Попробуйте ещё раз позже.");
    } finally {
      qaSubmitBtn.disabled   = false;
      qaSubmitBtn.textContent = "Отправить вопрос →";
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

    const snapshot = await getDocs(qRef);
    qaList.innerHTML = "";

    if (snapshot.empty) {
      qaList.innerHTML = `
        <p class="text-xs text-gray-500">
          Пока вопросов нет — вы можете быть первым, кто задаст вопрос 🙂
        </p>
      `;
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const item = document.createElement("div");
      item.className = "mb-3 pb-3 border-b border-gray-200 last:border-b-0";

      const author = data.userEmail || "Участник курса";
      const answerHtml = data.answer
        ? `<p class="text-[0.8rem] text-emerald-800 mt-2">
             <span class="font-semibold">Ответ:</span> ${data.answer}
           </p>`
        : `<p class="text-[0.75rem] text-gray-400 mt-2">
             Ответ скоро появится.
           </p>`;

      item.innerHTML = `
        <p class="text-[0.8rem] text-gray-800 font-medium">
          ❓ ${data.text}
        </p>
        <p class="text-[0.7rem] text-gray-400 mt-1">
          от ${author}
        </p>
        ${answerHtml}
      `;

      qaList.appendChild(item);
    });
  }
}

// ====== Озвучка слов из таблицы ======
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

// ====== Словарик (слова из таблиц) ======
function buildVocabEntries() {
  const entries = [];

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
    word, translation
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

if (openVocabBtn && vocabModal && vocabClose && vocabSaveBtn && vocabSelectAll) {
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

// Старт: показываем первый шаг
showStep(1);

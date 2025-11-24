// ==============================================
//   PolyTalky — English Intro: общая логика курса
// ==============================================

// Firebase (инициализирован в firebase-init.js)
const auth = window.firebaseAuth;
const db   = window.firebaseDb;

// Конфиг урока
const config = window.lessonConfig || {};

let currentUser = null;
let isProUser   = false;

function getUserKey() {
  if (!currentUser) return null;
   if (currentUser.email) return currentUser.email.toLowerCase();
         return currentUser.uid;
      }

     async function loadUserProfile(user) {
  // по умолчанию считаем, что PRO нет
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

    // объединяем данные, как в личном кабинете
    const merged = {
      ...(uidData || {}),
      ...(emailData || {}),
    };

    if (!Object.keys(merged).length) {
      isProUser = false;
      return;
    }
// основная логика PRO — как в student/index.html
    const proGlobal = merged.proGlobal === true;

    // поддерживаем и новое поле, и возможные старые варианты
    let proValidUntil = merged.proValidUntil || merged.proUntil || null;
    if (proValidUntil && typeof proValidUntil.toDate === "function") {
      proValidUntil = proValidUntil.toDate();
    }

    // запасной вариант: старые поля (на случай старых пользователей)
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
      async function loadProAnswers() {
  if (!currentUser || !isProUser) return;

  const userKey = getUserKey();
  const ref = doc(db, "lessonSubmissions", LESSON_ID, "answers", userKey);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;
  const data = snap.data();

// загрузка аудио
  if (data.audioAnswerBase64) {
    const url = "data:audio/webm;base64," + data.audioAnswerBase64;
    audioPlay.src = url;
    audioPlay.style.display = "block";
  }
}
const feedbackLink = document.getElementById("feedback-link");
const loginBtn     = document.getElementById("login-btn");
const userStatus   = document.getElementById("user-status");
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userStatus.textContent = `Вы вошли как: ${user.email}`;
    loginBtn.classList.add("hidden");
    await loadUserProfile(user);
    await loadProAnswers();
 // === показываем/скрываем кнопку проверенных заданий ===
    if (isProUser) {
      feedbackLink.classList.remove("hidden");
    } else {
      feedbackLink.classList.add("hidden");
    }

    } else {
    currentUser = null;
    isProUser   = false;
    userStatus.textContent = "Вы не авторизованы";
    loginBtn.classList.remove("hidden");
    feedbackLink.classList.add("hidden");
  }
   // ====== UI-элементы ======
      const stepPanels = document.querySelectorAll(".step-panel");
      const stepPanels = document.querySelectorAll(".step-panel");
      const stepDots   = document.querySelectorAll(".step-dot");
      const openVocabBtn    = document.getElementById("open-vocab-btn");
      const vocabModal      = document.getElementById("vocab-modal");
      const vocabClose      = document.getElementById("vocab-close");
      const vocabAuthWarn   = document.getElementById("vocab-auth-warning");
      const vocabSaveBtn    = document.getElementById("vocab-save");
      const vocabSelectAll  = document.getElementById("vocab-select-all");
// Q&A
      const qaModal      = document.getElementById("qa-modal");
      const qaCloseBtn   = document.getElementById("qa-close");
      const qaList       = document.getElementById("qa-list");
      const qaForm       = document.getElementById("qa-form");
      const qaText       = document.getElementById("qa-text");
      const qaSubmitBtn  = document.getElementById("qa-submit");
      const qaOpenBtns   = document.querySelectorAll("[data-open-qa]");
      
  function showStep(n) {
        stepPanels.forEach(p => p.classList.remove("step-panel--visible"));
        const panel = document.getElementById(`step-${n}`);
        if (panel) panel.classList.add("step-panel--visible");
        stepDots.forEach(dot => {
          dot.classList.remove("step-dot--active", "step-dot--done");
          const step = Number(dot.dataset.step);
          if (step < n)  dot.classList.add("step-dot--done");
          if (step === n) dot.classList.add("step-dot--active");
        });
        if (n === totalSteps) {
   saveLessonProgress().catch(console.error);
        }

        currentStep = n;
      }
      document.querySelectorAll(".next-step-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const next = Number(btn.dataset.next);
          if (next) showStep(next);
        });
      });
      // ====== Сохранение заданий PRO ======
      async function saveProSubmission(partialData) {
        if (!currentUser || !isProUser) return;
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
          userEmail: currentUser.email || null,
          userUid: currentUser.uid,
          isPro: true,
          courseId: COURSE_ID,
          lessonSlug: LESSON_SLUG,
          updatedAt: serverTimestamp()
        };
        await setDoc(
          answerRef,
          { createdAt: serverTimestamp(), ...baseData, ...partialData },
          { merge: true }
        );
      }
// ====== Аудиозапись ======
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;

const recordBtn        = document.getElementById("record-btn");
const stopBtn          = document.getElementById("stop-btn");
const audioPlay        = document.getElementById("audio-playback");
const recordingWrapper = document.getElementById("recording-wrapper");
const recordingBar     = document.getElementById("recording-bar");
const recordingStatus  = document.getElementById("recording-status");

let recordingInterval = null;
let recordingProgress = 0;

if (recordBtn && stopBtn && audioPlay) {
  // Проверяем, поддерживает ли браузер запись
  const canRecord =  navigator.mediaDevices &&
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
       audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

          const audioNextStep = config.audioNextStep || stepDots.length;
        // Если PRO — сохраняем аудио (base64) для проверки куратором
        if (isProUser && currentUser) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result || "";
            const base64 = typeof res === "string" ? (res.split(",")[1] || "") : "";

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
        // Переход на финальный шаг — только после успешной записи
        setTimeout(() => {
          if (audioFeedback) audioFeedback.classList.add("hidden");
          showStep(audioNextStep);
        }, 1800);
      });

             
        mediaRecorder.start();
        recordBtn.disabled = true;
        stopBtn.disabled   = false;
        audioFeedback.classList.add("hidden");

              // Показать индикатор записи
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
        if (recordingStatus) recordingStatus.classList.add("hidden");
                                                        
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
        stopBtn.disabled = true;

      }
    });
  }
}

             // ====== Q&A: модалка + Firestore ======
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

        qaSubmitBtn.disabled  = true;
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
  //озвучка
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

  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US";

  utter.rate = 0.8;
  utter.pitch = 1.0;
  utter.volume = 1.0;
  
  if (englishVoices.length > 0) {
    utter.voice = englishVoices[0];
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}
  
// Включаем озвучку по клику на слова из таблицы
document.querySelectorAll(".word-tip").forEach(tip => {
  tip.addEventListener("click", () => {
    const word = tip.textContent.trim();
    if (word) {
      speakWord(word);
    }
  });
});

      // ====== Окно словаря ======
      openVocabBtn.addEventListener("click", () => {
        vocabModal.classList.remove("hidden");
        vocabModal.classList.add("flex");

        renderVowelWords();

        if (!currentUser) {
          vocabAuthWarn.classList.remove("hidden");
          vocabSaveBtn.disabled = true;
        } else {
          vocabAuthWarn.classList.add("hidden");
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
        boxes.forEach(b => b.checked = anyUnchecked);
      });

      async function saveWordsToFirestore(entries) {
        if (!currentUser) return;
        const userKey = getUserKey();
        if (!userKey) return;

        const colRef = collection(db, `users/${userKey}/vocabulary`);

vocabSaveBtn.addEventListener("click", async () => {
        if (!currentUser) {
          alert("Войдите, чтобы сохранить слова.");
          return;
        }
        const checked = Array.from(document.querySelectorAll(".vocab-word"))
          .filter(cb => cb.checked)
          .map(cb => ({
            word: cb.dataset.word,
            translation: cb.dataset.ru || ""
          }));


        const checked = Array.from(document.querySelectorAll(".vocab-word"))
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

// js/pro-submissions.js
// Универсальное сохранение PRO-заданий в формат, который понимает review.html

import {
  collection,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Универсальное сохранение PRO-задания.
 *
 * Параметры:
 *  db, user
 *  courseId, courseTitle
 *  lessonId, lessonTitle
 *  submissionsRoot (по умолчанию "lessonSubmissions")
 *  taskId, step
 *  answerText, answerAudioBase64, answerImageBase64
 *  meta — любые дополнительные поля (объект)
 */
export async function saveProAnswer({
  db,
  user,
  courseId,
  courseTitle,
  lessonId,
  lessonTitle,
  submissionsRoot = "lessonSubmissions",

  taskId = null,
  step = null,

  answerText = null,
  answerAudioBase64 = null,
  answerImageBase64 = null,

  meta = {}
}) {
  try {
    // Базовая валидация
    if (!db || !user || !lessonId || !courseId) {
      console.error("saveProAnswer: отсутствуют обязательные параметры", {
        hasDb: !!db,
        hasUser: !!user,
        lessonId,
        courseId
      });
      return null;
    }

    // taskId обязателен — без него потом невозможно подставить ответ в урок
    if (!taskId) {
      console.error("saveProAnswer: вызов без taskId — сохранение отменено.");
      return null;
    }

    // Должен быть хотя бы один тип ответа
    if (!answerText && !answerAudioBase64 && !answerImageBase64) {
      console.warn(
        "saveProAnswer: нет данных ответа (text/audio/image) — ничего не сохраняем."
      );
      return null;
    }

    // Ключ ученика: сначала email, потом uid
    const userKeyRaw = (user.email || user.uid || "").trim();
    if (!userKeyRaw) {
      console.error("saveProAnswer: у user нет ни email, ни uid");
      return null;
    }
    const userKey = userKeyRaw.toLowerCase();

    // Коллекция с ответами по уроку
    const answersCol = collection(db, submissionsRoot, lessonId, "answers");

    // Документ: email(or uid) + taskId
    // Пример: "iraburljaeva@gmail.com__hello-text"
    let docId = userKey + "__" + String(taskId);
    const answerRef = doc(answersCol, docId);

    // определяем тип ответа
    let answerType = "text";
    if (answerAudioBase64 && answerText)      answerType = "text+audio";
    else if (answerAudioBase64)              answerType = "audio";
    else if (answerImageBase64 && answerText) answerType = "text+image";
    else if (answerImageBase64)              answerType = "image";
    else if (answerText)                     answerType = "text";

    const now = serverTimestamp();

    // Проверяем, существует ли документ, чтобы не перетирать createdAt
    const existingSnap = await getDoc(answerRef);
    const isNew        = !existingSnap.exists();
    const existingData = isNew ? null : existingSnap.data() || {};

    const payload = {
      userEmail: user.email || null,
      userUid:   user.uid   || null,
      userKey, // для удобного поиска в консоли

      courseId,
      courseTitle: courseTitle || courseId,

      lessonId,
      lessonTitle: lessonTitle || lessonId,

      taskId,
      step,

      answerType,
      answerText:          answerText          ?? existingData.answerText          ?? null,
      answerAudioBase64:   answerAudioBase64   ?? existingData.answerAudioBase64   ?? null,
      answerImageBase64:   answerImageBase64   ?? existingData.answerImageBase64   ?? null,

      status: existingData.status || "pending", // review.html фильтрует по этому полю
      meta: {
        ...(existingData.meta || {}),
        ...(meta || {})
      },

      updatedAt: now
    };

    // createdAt проставляем только один раз — при первом сохранении
    if (isNew || !existingData.createdAt) {
      payload.createdAt = now;
    }

    await setDoc(answerRef, payload, { merge: true });
    return docId;
  } catch (err) {
    console.error("saveProAnswer: ошибка при сохранении ответа", err);
    return null;
  }
}

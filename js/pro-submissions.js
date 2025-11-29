// js/pro-submissions.js
// Универсальное сохранение PRO-заданий в формате, который понимает review.html

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Сохраняет задание PRO-пользователя в коллекцию
 * {submissionsRoot}/{lessonId}/answers/{autoId}
 * в формате, который ждёт админка review.html.
 *
 * options = {
 *   db,
 *   submissionsRoot: "lessonSubmissions",
 *   courseId,
 *   courseTitle,
 *   lessonId,
 *   lessonTitle,
 *   user,          // объект currentUser из Firebase Auth
 *   data,          // partialData из урока (helloAnswer, audioAnswerBase64, taskText и т.п.)
 *   extra          // доп. поля: { taskId, step, ... } (по желанию)
 * }
 */
export async function saveProForReview(options = {}) {
  const {
    db,
    submissionsRoot = "lessonSubmissions",
    courseId,
    courseTitle,
    lessonId,
    lessonTitle,
    user,
    data = {},
    extra = {}
  } = options;

  if (!db || !lessonId || !courseId || !user) return;

  const colRef = collection(db, submissionsRoot, lessonId, "answers");

  // Определяем текст ответа
  const textAnswer =
    data.answerText ??
    data.helloAnswer ??
    data.text ??
    null;

  // Тип ответа
  let answerType = data.answerType || "text";
  const hasAudio = !!data.audioAnswerBase64;
  if (!answerType) {
    if (hasAudio && textAnswer) answerType = "text+audio";
    else if (hasAudio)          answerType = "audio";
    else                        answerType = "text";
  }

  const payload = {
    // Идентификация курса/урока
    courseId,
    courseTitle: courseTitle || courseId,
    lessonId,
    lessonTitle: lessonTitle || lessonId,

    // Пользователь
    userEmail: user.email || null,
    userUid:   user.uid   || null,

    // Ответ
    answerText: textAnswer,
    answerType,
    taskText: data.taskText || null,
    audioBase64: data.audioAnswerBase64 || null,

    // Статус проверки
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    // Любые дополнительные метаданные
    ...extra
  };

  await addDoc(colRef, payload);
}

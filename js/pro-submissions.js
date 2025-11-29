// js/pro-submissions.js
// Универсальное сохранение PRO-заданий в формат, который понимает review.html

import {
  collection,
  doc,
  setDoc,
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
  if (!db || !user || !lessonId || !courseId) return null;

  // Ключ ученика: сначала email, потом uid
  const userKeyRaw = (user.email || user.uid || "").trim();
  if (!userKeyRaw) return null;
  const userKey = userKeyRaw.toLowerCase();

  // Коллекция с ответами по уроку
  const answersCol = collection(db, submissionsRoot, lessonId, "answers");

  // Документ: сначала email, потом taskId
  // Пример: "iraburljaeva@gmail.com__hello"
  let docId = userKey;
  if (taskId) docId += `__${taskId}`;

  const answerRef = doc(answersCol, docId);

  // определяем тип ответа
  let answerType = "text";
  if (answerAudioBase64 && answerText) answerType = "text+audio";
  else if (answerAudioBase64)         answerType = "audio";
  else if (answerImageBase64)         answerType = "image";
  else if (answerText)                answerType = "text";

  const now = serverTimestamp();

  const payload = {
    userEmail: user.email || null,
    userUid:   user.uid   || null,

    courseId,
    courseTitle: courseTitle || courseId,

    lessonId,
    lessonTitle: lessonTitle || lessonId,

    taskId,
    step,

    answerType,
    answerText,
    answerAudioBase64,
    answerImageBase64,

    status: "pending",       // именно по этому полю фильтрует review.html
    meta:   meta || {},

    updatedAt: now,
    // createdAt запишется один раз и дальше не будет трогаться
    createdAt: now
  };

  await setDoc(answerRef, payload, { merge: true });
  return docId;
}

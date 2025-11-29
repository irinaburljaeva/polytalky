import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Универсальное сохранение PRO-задания.
 * Используется для всех курсов и любых типов заданий.
 */
export async function saveProAnswer({
  db,
  courseId,
  courseTitle,
  lessonId,
  lessonTitle,
  user,
  taskId = null,
  step = null,
  answerText = null,
  answerAudioBase64 = null,
  answerImageBase64 = null,
  meta = {}
}) {
  if (!db || !user || !lessonId) return null;

  const answersCol = collection(
    db,
    "lessonSubmissions",
    lessonId,
    "answers"
  );

  // определяем тип ответа
  let answerType = "text";
  if (answerAudioBase64 && answerText) answerType = "text+audio";
  else if (answerAudioBase64) answerType = "audio";
  else if (answerImageBase64) answerType = "image";
  else if (answerText) answerType = "text";

  const payload = {
    userEmail: user.email,
    userUid: user.uid,

    courseId,
    courseTitle,
    lessonId,
    lessonTitle,

    taskId,
    step,

    answerType,
    answerText,
    answerAudioBase64,
    answerImageBase64,

    status: "pending",                // обязательно для review.html

    meta: meta || {},

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(answersCol, payload);
  return docRef.id;
}

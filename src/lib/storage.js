import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/lib/firebase'

/**
 * 사진 업로드 후 다운로드 URL 반환
 * @param {string} path — Storage 경로 (예: 'lostReports/{reportId}/photo1.jpg')
 * @param {File|Blob} file — 업로드할 파일
 * @returns {Promise<string>} — 다운로드 URL
 */
export async function uploadPhoto(path, file) {
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

/**
 * Storage 파일 삭제
 * @param {string} path — Storage 경로
 */
export async function deletePhoto(path) {
  const storageRef = ref(storage, path)
  await deleteObject(storageRef)
}

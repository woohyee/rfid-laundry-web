const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

/**
 * Cloudinary unsigned upload로 사진 업로드
 * @param {string} folder — Cloudinary 폴더 경로 (예: 'lostReports/abc123')
 * @param {File|Blob} file — 업로드할 파일
 * @returns {Promise<string>} — 이미지 URL (secure_url)
 */
export async function uploadPhoto(folder, file) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', folder)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Upload failed (${res.status})`)
  }

  const data = await res.json()
  return data.secure_url
}

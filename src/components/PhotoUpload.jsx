import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
}

/**
 * 사진 업로드 컴포넌트 (Depot용 — 갤러리 선택)
 * @param {{ photos: File[], onChange: (files: File[]) => void, maxPhotos?: number }} props
 */
export default function PhotoUpload({ photos, onChange, maxPhotos = 5 }) {
  const [compressing, setCompressing] = useState(false)
  const inputRef = useRef(null)

  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    setCompressing(true)
    try {
      const compressed = await Promise.all(
        files.map(file => imageCompression(file, COMPRESSION_OPTIONS))
      )
      const updated = [...photos, ...compressed].slice(0, maxPhotos)
      onChange(updated)
    } finally {
      setCompressing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removePhoto(index) {
    onChange(photos.filter((_, i) => i !== index))
  }

  return (
    <div>
      {/* 미리보기 */}
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {photos.map((file, i) => (
            <div key={i} className="relative">
              <img
                src={URL.createObjectURL(file)}
                alt={`Photo ${i + 1}`}
                className="w-20 h-20 object-cover rounded-lg border border-zinc-300"
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold"
              >
                X
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 업로드 버튼 */}
      {photos.length < maxPhotos && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={compressing}
          className="px-4 py-2 rounded-lg border-2 border-dashed border-zinc-300 text-zinc-500 hover:border-[#E07B0F] hover:text-[#E07B0F] transition-colors disabled:opacity-50"
        >
          {compressing ? 'Compressing...' : `Add Photo (${photos.length}/${maxPhotos})`}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />
    </div>
  )
}

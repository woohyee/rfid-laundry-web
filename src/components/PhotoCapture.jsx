import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
}

/**
 * 사진 촬영 컴포넌트 (Factory용 — 카메라 직접 실행 + 갤러리)
 * @param {{ photos: File[], onChange: (files: File[]) => void, maxPhotos?: number, required?: boolean }} props
 */
export default function PhotoCapture({ photos, onChange, maxPhotos = 5, required = false }) {
  const [compressing, setCompressing] = useState(false)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  async function handleFile(e) {
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
      if (cameraRef.current) cameraRef.current.value = ''
      if (galleryRef.current) galleryRef.current.value = ''
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

      {/* 촬영/선택 버튼 */}
      {photos.length < maxPhotos && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={compressing}
            className="flex-1 px-4 py-3 rounded-lg bg-[#E07B0F] text-white font-bold hover:bg-[#c96a0d] transition-colors disabled:opacity-50"
          >
            {compressing ? 'Compressing...' : 'Take Photo'}
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={compressing}
            className="px-4 py-3 rounded-lg border-2 border-zinc-300 text-zinc-500 hover:border-[#E07B0F] hover:text-[#E07B0F] transition-colors disabled:opacity-50"
          >
            Gallery
          </button>
        </div>
      )}

      {required && photos.length === 0 && (
        <p className="text-sm text-red-500 mt-1">At least 1 photo required</p>
      )}

      <p className="text-xs text-zinc-400 mt-1">{photos.length}/{maxPhotos} photos</p>

      {/* 카메라 (뒷면 카메라 직접 실행) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      {/* 갤러리 */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'

// HID 리더기는 숫자+Enter를 자동입력 → onKeyDown에서 Enter 감지
export default function TagScanner({ onScan, placeholder = "Scan RFID tag...", autoFocus = true, disabled = false }) {
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (autoFocus && !disabled) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [disabled])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && value.trim()) {
      const cleaned = value.trim()
      // 숫자만 허용 (불량 태그 또는 스캔 오류 방지)
      if (!/^\d+$/.test(cleaned)) {
        setValue('')
        return
      }
      onScan(cleaned)
      setValue('')
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full border-2 border-blue-400 rounded-lg px-4 py-3 text-xl font-mono focus:outline-none focus:border-blue-600 disabled:opacity-40"
    />
  )
}

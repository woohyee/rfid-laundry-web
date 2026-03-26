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

  // 다른 탭/창 갔다 돌아올 때 자동 포커스
  useEffect(() => {
    if (!autoFocus || disabled) return
    function onWindowFocus() {
      inputRef.current?.focus()
    }
    // 페이지 아무 곳 클릭 시 포커스 (모달 등 제외)
    function onDocClick(e) {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        inputRef.current.focus()
      }
    }
    window.addEventListener('focus', onWindowFocus)
    document.addEventListener('click', onDocClick)
    return () => {
      window.removeEventListener('focus', onWindowFocus)
      document.removeEventListener('click', onDocClick)
    }
  }, [autoFocus, disabled])

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
      className="w-full border-2 border-[#E07B0F] rounded-lg px-4 py-3 text-2xl font-mono font-bold text-gray-900 focus:outline-none focus:border-[#C46A09] disabled:opacity-40"
    />
  )
}

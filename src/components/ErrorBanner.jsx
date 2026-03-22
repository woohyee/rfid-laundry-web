export default function ErrorBanner({ message, onClose }) {
  if (!message) return null
  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
      <span>{message}</span>
      <button onClick={onClose} className="font-bold ml-4">✕</button>
    </div>
  )
}

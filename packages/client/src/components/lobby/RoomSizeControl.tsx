import { useTheme } from "../../theme"

interface RoomSizeControlProps {
  currentSize: number
  minSize?: number
  maxSize?: number
  disabled: boolean
  onSizeChange: (newSize: number) => void
}

/**
 * RoomSizeControl — numeric stepper for configuring the total player slot count.
 *
 * Allows values between 2 and 10 (inclusive). Defaults to 4.
 * Disabled when settings are locked (game in progress).
 * The parent component is responsible for dispatching the UPDATE_ROOM_SIZE message.
 */
export default function RoomSizeControl({
  currentSize,
  minSize = 2,
  maxSize = 10,
  disabled,
  onSizeChange,
}: RoomSizeControlProps) {
  const theme = useTheme()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val)) {
      const clamped = Math.round(Math.min(maxSize, Math.max(minSize, val)))
      onSizeChange(clamped)
    }
  }

  function decrement() {
    if (currentSize > minSize) {
      onSizeChange(currentSize - 1)
    }
  }

  function increment() {
    if (currentSize < maxSize) {
      onSizeChange(currentSize + 1)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="room-size-control"
        className={`text-sm font-medium ${theme.bodyText}`}
      >
        Room Size
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={decrement}
          disabled={disabled || currentSize <= minSize}
          aria-label="Decrease room size"
          className={`flex h-[44px] w-[44px] items-center justify-center rounded-lg text-lg font-bold shadow-sm transition active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 ${theme.btnGhost}`}
        >
          −
        </button>
        <input
          id="room-size-control"
          type="number"
          value={currentSize}
          onChange={handleChange}
          min={minSize}
          max={maxSize}
          step={1}
          disabled={disabled}
          aria-valuemin={minSize}
          aria-valuemax={maxSize}
          aria-valuenow={currentSize}
          className={`min-h-[44px] w-16 rounded-lg border-2 bg-transparent px-3 py-2 text-center text-base font-semibold shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${theme.bodyText} ${theme.listItem}`}
        />
        <button
          type="button"
          onClick={increment}
          disabled={disabled || currentSize >= maxSize}
          aria-label="Increase room size"
          className={`flex h-[44px] w-[44px] items-center justify-center rounded-lg text-lg font-bold shadow-sm transition active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 ${theme.btnGhost}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

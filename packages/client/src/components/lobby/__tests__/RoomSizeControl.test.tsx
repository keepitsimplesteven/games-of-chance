import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import RoomSizeControl from "../RoomSizeControl"

describe("RoomSizeControl", () => {
  it("renders with the provided currentSize value", () => {
    render(
      <RoomSizeControl currentSize={4} disabled={false} onSizeChange={vi.fn()} />
    )

    const input = screen.getByRole("spinbutton")
    expect(input).toHaveValue(4)
  })

  it("defaults min to 2 and max to 10", () => {
    render(
      <RoomSizeControl currentSize={4} disabled={false} onSizeChange={vi.fn()} />
    )

    const input = screen.getByRole("spinbutton")
    expect(input).toHaveAttribute("min", "2")
    expect(input).toHaveAttribute("max", "10")
  })

  it("does not call onSizeChange when clicking - at min value", async () => {
    const onSizeChange = vi.fn()
    render(
      <RoomSizeControl currentSize={2} disabled={false} onSizeChange={onSizeChange} />
    )

    const decrementBtn = screen.getByRole("button", { name: /decrease/i })
    await userEvent.click(decrementBtn)

    expect(onSizeChange).not.toHaveBeenCalled()
  })

  it("does not call onSizeChange when clicking + at max value", async () => {
    const onSizeChange = vi.fn()
    render(
      <RoomSizeControl currentSize={10} disabled={false} onSizeChange={onSizeChange} />
    )

    const incrementBtn = screen.getByRole("button", { name: /increase/i })
    await userEvent.click(incrementBtn)

    expect(onSizeChange).not.toHaveBeenCalled()
  })

  it("disables all controls when disabled is true", () => {
    render(
      <RoomSizeControl currentSize={4} disabled={true} onSizeChange={vi.fn()} />
    )

    const input = screen.getByRole("spinbutton")
    const decrementBtn = screen.getByRole("button", { name: /decrease/i })
    const incrementBtn = screen.getByRole("button", { name: /increase/i })

    expect(input).toBeDisabled()
    expect(decrementBtn).toBeDisabled()
    expect(incrementBtn).toBeDisabled()
  })

  it("calls onSizeChange(currentSize + 1) when clicking +", async () => {
    const onSizeChange = vi.fn()
    render(
      <RoomSizeControl currentSize={5} disabled={false} onSizeChange={onSizeChange} />
    )

    const incrementBtn = screen.getByRole("button", { name: /increase/i })
    await userEvent.click(incrementBtn)

    expect(onSizeChange).toHaveBeenCalledWith(6)
  })

  it("calls onSizeChange(currentSize - 1) when clicking -", async () => {
    const onSizeChange = vi.fn()
    render(
      <RoomSizeControl currentSize={5} disabled={false} onSizeChange={onSizeChange} />
    )

    const decrementBtn = screen.getByRole("button", { name: /decrease/i })
    await userEvent.click(decrementBtn)

    expect(onSizeChange).toHaveBeenCalledWith(4)
  })
})

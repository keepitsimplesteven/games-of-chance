import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import SchemaField from "../SchemaField"
import type { SettingsFieldSchema } from "@games-of-chance/shared"

describe("SchemaField", () => {
  // ── Number input renders with correct min/max/step attributes ──────────

  describe("number field", () => {
    const numberField: SettingsFieldSchema = {
      key: "CORRECT_GUESS_CHIPS",
      label: "Points per correct guess",
      type: "number",
      defaultValue: 10,
      constraints: { min: 1, max: 100, step: 1 },
    }

    it("renders with correct min/max/step attributes", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={numberField} value={10} onChange={onChange} disabled={false} />
      )

      const input = screen.getByLabelText("Points per correct guess") as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.type).toBe("number")
      expect(input.min).toBe("1")
      expect(input.max).toBe("100")
      expect(input.step).toBe("1")
    })

    it("renders with fractional step", () => {
      const fractionalField: SettingsFieldSchema = {
        key: "STREAK_MULTIPLIER",
        label: "Streak multiplier",
        type: "number",
        defaultValue: 2,
        constraints: { min: 1, max: 10, step: 0.5 },
      }
      const onChange = vi.fn()
      render(
        <SchemaField field={fractionalField} value={2} onChange={onChange} disabled={false} />
      )

      const input = screen.getByLabelText("Streak multiplier") as HTMLInputElement
      expect(input.step).toBe("0.5")
    })

    it("fires onChange when value changes", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={numberField} value={10} onChange={onChange} disabled={false} />
      )

      const input = screen.getByLabelText("Points per correct guess")
      fireEvent.change(input, { target: { value: "25" } })
      expect(onChange).toHaveBeenCalledWith("CORRECT_GUESS_CHIPS", 25)
    })
  })

  // ── Boolean toggle renders and fires onChange ─────────────────────────

  describe("boolean field", () => {
    const booleanField: SettingsFieldSchema = {
      key: "ENABLE_STREAKS",
      label: "Enable streaks",
      type: "boolean",
      defaultValue: true,
    }

    it("renders as a switch with correct aria-checked state", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={booleanField} value={true} onChange={onChange} disabled={false} />
      )

      const toggle = screen.getByRole("switch")
      expect(toggle).toBeInTheDocument()
      expect(toggle).toHaveAttribute("aria-checked", "true")
    })

    it("fires onChange with toggled value when clicked", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={booleanField} value={true} onChange={onChange} disabled={false} />
      )

      const toggle = screen.getByRole("switch")
      fireEvent.click(toggle)
      expect(onChange).toHaveBeenCalledWith("ENABLE_STREAKS", false)
    })

    it("fires onChange with true when toggling from false", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={booleanField} value={false} onChange={onChange} disabled={false} />
      )

      const toggle = screen.getByRole("switch")
      expect(toggle).toHaveAttribute("aria-checked", "false")
      fireEvent.click(toggle)
      expect(onChange).toHaveBeenCalledWith("ENABLE_STREAKS", true)
    })
  })

  // ── Select dropdown renders options from schema ───────────────────────

  describe("select field", () => {
    const selectField: SettingsFieldSchema = {
      key: "SCORING_MODE",
      label: "Scoring mode",
      type: "select",
      defaultValue: "grand-prix",
      constraints: {
        options: [
          { label: "Grand Prix", value: "grand-prix" },
          { label: "Chips", value: "chips" },
          { label: "Elimination", value: "elimination" },
        ],
      },
    }

    it("renders all options from schema constraints", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={selectField} value="grand-prix" onChange={onChange} disabled={false} />
      )

      const select = screen.getByLabelText("Scoring mode") as HTMLSelectElement
      expect(select).toBeInTheDocument()

      const options = select.querySelectorAll("option")
      expect(options).toHaveLength(3)
      expect(options[0].textContent).toBe("Grand Prix")
      expect(options[0].value).toBe("grand-prix")
      expect(options[1].textContent).toBe("Chips")
      expect(options[1].value).toBe("chips")
      expect(options[2].textContent).toBe("Elimination")
      expect(options[2].value).toBe("elimination")
    })

    it("shows the current value as selected", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={selectField} value="chips" onChange={onChange} disabled={false} />
      )

      const select = screen.getByLabelText("Scoring mode") as HTMLSelectElement
      expect(select.value).toBe("chips")
    })

    it("fires onChange with new value on selection change", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={selectField} value="grand-prix" onChange={onChange} disabled={false} />
      )

      const select = screen.getByLabelText("Scoring mode")
      fireEvent.change(select, { target: { value: "chips" } })
      expect(onChange).toHaveBeenCalledWith("SCORING_MODE", "chips")
    })
  })

  // ── Disabled state renders read-only controls ─────────────────────────

  describe("disabled state", () => {
    it("disables number input when disabled is true", () => {
      const numberField: SettingsFieldSchema = {
        key: "ROUND_COUNT",
        label: "Round count",
        type: "number",
        defaultValue: 10,
        constraints: { min: 1, max: 50, step: 1 },
      }
      const onChange = vi.fn()
      render(
        <SchemaField field={numberField} value={10} onChange={onChange} disabled={true} />
      )

      const input = screen.getByLabelText("Round count") as HTMLInputElement
      expect(input).toBeDisabled()
    })

    it("disables boolean toggle when disabled is true", () => {
      const booleanField: SettingsFieldSchema = {
        key: "AUTO_MODE",
        label: "Auto mode",
        type: "boolean",
        defaultValue: false,
      }
      const onChange = vi.fn()
      render(
        <SchemaField field={booleanField} value={false} onChange={onChange} disabled={true} />
      )

      const toggle = screen.getByRole("switch")
      expect(toggle).toBeDisabled()
    })

    it("does not fire onChange when disabled toggle is clicked", () => {
      const booleanField: SettingsFieldSchema = {
        key: "AUTO_MODE",
        label: "Auto mode",
        type: "boolean",
        defaultValue: false,
      }
      const onChange = vi.fn()
      render(
        <SchemaField field={booleanField} value={false} onChange={onChange} disabled={true} />
      )

      const toggle = screen.getByRole("switch")
      fireEvent.click(toggle)
      expect(onChange).not.toHaveBeenCalled()
    })

    it("disables select dropdown when disabled is true", () => {
      const selectField: SettingsFieldSchema = {
        key: "MODE",
        label: "Mode",
        type: "select",
        defaultValue: "a",
        constraints: {
          options: [
            { label: "Option A", value: "a" },
            { label: "Option B", value: "b" },
          ],
        },
      }
      const onChange = vi.fn()
      render(
        <SchemaField field={selectField} value="a" onChange={onChange} disabled={true} />
      )

      const select = screen.getByLabelText("Mode") as HTMLSelectElement
      expect(select).toBeDisabled()
    })
  })

  // ── Value clamping on out-of-range input ──────────────────────────────

  describe("value clamping on blur", () => {
    const numberField: SettingsFieldSchema = {
      key: "POINTS",
      label: "Points",
      type: "number",
      defaultValue: 10,
      constraints: { min: 1, max: 100, step: 1 },
    }

    it("clamps value to min when below range on blur", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={numberField} value={-5} onChange={onChange} disabled={false} />
      )

      const input = screen.getByLabelText("Points")
      fireEvent.blur(input)
      expect(onChange).toHaveBeenCalledWith("POINTS", 1)
    })

    it("clamps value to max when above range on blur", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={numberField} value={200} onChange={onChange} disabled={false} />
      )

      const input = screen.getByLabelText("Points")
      fireEvent.blur(input)
      expect(onChange).toHaveBeenCalledWith("POINTS", 100)
    })

    it("does not fire onChange on blur when value is within range", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={numberField} value={50} onChange={onChange} disabled={false} />
      )

      const input = screen.getByLabelText("Points")
      fireEvent.blur(input)
      expect(onChange).not.toHaveBeenCalled()
    })

    it("shows validation message for out-of-range value during typing", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={numberField} value={10} onChange={onChange} disabled={false} />
      )

      const input = screen.getByLabelText("Points")
      fireEvent.change(input, { target: { value: "150" } })
      expect(screen.getByRole("alert")).toHaveTextContent("Maximum is 100")
    })

    it("shows validation message when value is below minimum", () => {
      const onChange = vi.fn()
      render(
        <SchemaField field={numberField} value={10} onChange={onChange} disabled={false} />
      )

      const input = screen.getByLabelText("Points")
      fireEvent.change(input, { target: { value: "0" } })
      expect(screen.getByRole("alert")).toHaveTextContent("Minimum is 1")
    })
  })
})

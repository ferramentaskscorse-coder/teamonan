import { C } from "./theme";

export function NavTab({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        color: active ? C.text : C.textFaint,
        borderColor: active ? C.red : "transparent",
      }}
      className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-3 border-b-2 -mb-px font-medium"
    >
      <Icon size={15} />
      {children}
    </button>
  );
}

export function Select({ value, onChange, options, placeholder, disabled }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: C.bgRaised,
        borderColor: C.line,
        color: value ? C.text : C.textFaint,
        opacity: disabled ? 0.5 : 1,
        height: "42px",
        boxSizing: "border-box",
      }}
      className="border rounded-md px-3 py-2 text-sm outline-none w-full"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FieldLabel({ children }) {
  return (
    <div style={{ color: C.textDim }} className="text-xs mb-1.5">
      {children}
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div
      style={{ background: C.bgPanel, borderColor: C.line, color: C.textFaint }}
      className="border border-dashed rounded-md p-8 text-center text-sm"
    >
      {text}
    </div>
  );
}

export function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.6)" }}
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.bgPanel, borderColor: C.line }}
        className="border rounded-md max-w-sm w-full p-5"
      >
        {children}
      </div>
    </div>
  );
}

export function StatCard({ label, value }) {
  return (
    <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md p-4">
      <div style={{ color: C.textFaint }} className="text-xs mb-1">
        {label}
      </div>
      <div style={{ color: C.text }} className="text-2xl font-bold tabular-nums">
        {value}
      </div>
    </div>
  );
}

export function SectionTitle({ children }) {
  return (
    <div style={{ color: C.text }} className="text-sm font-semibold mb-2">
      {children}
    </div>
  );
}

export function TaxaBar({ taxa }) {
  const color = taxa >= 70 ? C.oliveBright : taxa >= 40 ? C.brass : C.red;
  return (
    <div className="flex items-center justify-end gap-2">
      <div style={{ background: C.bgRaised }} className="w-16 h-1.5 rounded-full overflow-hidden">
        <div style={{ background: color, width: `${taxa}%` }} className="h-full" />
      </div>
      <span style={{ color }} className="font-semibold text-xs w-9 text-right">
        {taxa}%
      </span>
    </div>
  );
}

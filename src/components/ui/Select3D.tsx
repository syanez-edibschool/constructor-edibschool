import { forwardRef, SelectHTMLAttributes } from 'react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

const Select3D = forwardRef<HTMLSelectElement, Props>(
  ({ label, error, options, placeholder, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-white/70 tracking-wide">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`
            input-3d select-3d w-full rounded-xl px-4 py-3 text-sm cursor-pointer
            ${error ? 'border-red-500/50' : ''}
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option
              key={o.value}
              value={o.value}
              style={{ background: '#1a1a2e', color: '#fff' }}
            >
              {o.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)

Select3D.displayName = 'Select3D'
export default Select3D

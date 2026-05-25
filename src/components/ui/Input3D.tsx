import { forwardRef, InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input3D = forwardRef<HTMLInputElement, Props>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-white/70 tracking-wide">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={`
              input-3d w-full rounded-xl
              ${icon ? 'pl-10 pr-4' : 'px-4'}
              py-3 text-sm
              ${error ? 'border-red-500/50 focus:border-red-500' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)

Input3D.displayName = 'Input3D'
export default Input3D

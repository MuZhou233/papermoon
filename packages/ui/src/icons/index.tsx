import type { SVGProps } from 'react'
type Props = SVGProps<SVGSVGElement> & { size?: number }
export function IconCloseOutline16({ size = 16, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
    >
      <path d="m4 4 8 8m0-8-8 8" />
    </svg>
  )
}
export function IconCheckOutline16({ size = 16, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
    >
      <path d="m3 8 3 3 7-7" />
    </svg>
  )
}
export function BookIcon({ size = 20, ...props }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      {...props}
    >
      <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" />
      <path d="M12 5v15" />
    </svg>
  )
}

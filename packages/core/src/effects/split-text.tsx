import { forwardRef } from "react"

interface Props {
  children: string
  className?: string
  style?: React.CSSProperties
  as?: "span" | "div" | "h1" | "h2" | "h3" | "p"
}

export const SplitText = forwardRef<HTMLElement, Props>(function SplitText(
  { children, className, style, as = "span" },
  ref,
) {
  const Tag = as as "span"
  const words = children.split(" ")
  return (
    <Tag
      ref={ref as React.Ref<HTMLSpanElement>}
      className={className}
      style={style}
      aria-label={children}
    >
      {words.map((word, i) => (
        <span key={i} className="word-wrap">
          <span className="word-inner split-word">
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </Tag>
  )
})

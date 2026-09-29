interface Props {
  className?: string
}

export function AuroraBlobs({ className }: Props) {
  return (
    <>
      <div
        className={`aurora-blob-1 absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full pointer-events-none ${className ?? ""}`}
        aria-hidden
      />
      <div
        className={`aurora-blob-2 absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full pointer-events-none ${className ?? ""}`}
        aria-hidden
      />
    </>
  )
}

export type BackdropPhoto = 'colour' | 'warm'

/**
 * A still CC0 photo behind the scene: sharp around the core, blurring out toward the edges.
 * Three copies of the photo (blurred, softer, sharp) are masked by size of the short side
 * (vmin), so a phone, a laptop and a 2K monitor all show the same picture.
 */
export function Backdrop({ photo, focusY = 50 }: { photo: BackdropPhoto; focusY?: number }) {
  const cls = `r3d-photo r3d-photo-${photo}`
  return (
    <div className="r3d-backdrop" style={{ ['--fy' as string]: `${focusY}%` }} aria-hidden="true">
      <div className={`${cls} r3d-photo-far`} />
      <div className={`${cls} r3d-photo-mid`} />
      <div className={`${cls} r3d-photo-core`} />
      <div className="r3d-wash" />
      <div className="r3d-vignette" />
      <div className="r3d-grain" />
    </div>
  )
}

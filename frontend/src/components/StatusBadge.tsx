import type { CapsuleStatus } from '../api'

const LABELS: Record<CapsuleStatus, string> = {
  scheduled: 'Scheduled',
  delivered: 'Delivered',
  opened: 'Opened',
  cancelled: 'Cancelled',
}

export function StatusBadge({ status }: { status: CapsuleStatus }) {
  return <span className={`badge badge-${status}`}>{LABELS[status]}</span>
}

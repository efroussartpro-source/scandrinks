/**
 * Notice.tsx — Message affiché sous le viseur après une action.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2)
 *
 * Après « Valider », le message donne le nouveau stock et propose « Annuler »
 * pendant 5 secondes.
 */
import { formatDelta, formatStock } from '../domain/stock'
import { NOT_A_PRODUCT_MESSAGE, type Notice as FlowNotice } from './scanFlow'

interface NoticeProps {
  notice: FlowNotice
  undoing: boolean
  onUndo: () => void
}

export default function Notice({ notice, undoing, onUndo }: NoticeProps) {
  switch (notice.kind) {
    case 'saved':
      return (
        <div role="status" className="message message-ok notice">
          <span>
            ✓ {formatDelta(notice.delta)} {notice.productName} — stock : {formatStock(notice.stock, notice.packSize)}
          </span>
          <button type="button" disabled={undoing} onClick={onUndo}>
            {undoing ? 'Annulation…' : 'Annuler'}
          </button>
        </div>
      )
    case 'cancelled':
      return (
        <p role="status" className="message notice">
          Annulé — stock : {formatStock(notice.stock, notice.packSize)}
        </p>
      )
    case 'not_a_product':
      return (
        <p role="status" className="message notice">
          {NOT_A_PRODUCT_MESSAGE}
        </p>
      )
    case 'error':
      return (
        <p role="alert" className="message message-error notice">
          {notice.message}
        </p>
      )
  }
}

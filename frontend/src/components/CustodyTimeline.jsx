import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import Icon from './Icon'
import FormSection from './forms/FormSection'
import FormField from './forms/FormField'

export default function CustodyTimeline({ evidenceId }) {
  const { syncWithBackend, showToast } = useApp()
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(false)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [toUser, setToUser] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadCustody = useCallback(async () => {
    if (!evidenceId) return
    setLoading(true)
    try {
      const res = await syncWithBackend(`/ledger/evidence/${evidenceId}/custody`)
      if (res?.success && res?.data && Array.isArray(res.data)) {
        setTimeline(res.data)
      } else {
        setTimeline([])
      }
    } catch (e) {
      console.error('Failed to load custody timeline:', e)
      setTimeline([])
    } finally {
      setLoading(false)
    }
  }, [evidenceId, syncWithBackend])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      loadCustody()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [loadCustody])

  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!toUser.trim()) {
      showToast('Recipient officer/custodian ID is required', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await syncWithBackend(`/ledger/evidence/${evidenceId}/custody/transfer`, 'POST', {
        to_user_id: toUser.trim(),
        reason: reason.trim() || 'Official custody transfer'
      })
      if (res?.success && res?.data) {
        showToast('Custody transferred and secured in blockchain ledger.')
        setToUser('')
        setReason('')
        setShowTransferForm(false)
        await loadCustody()
      } else {
        showToast(res?.error || 'Failed to transfer custody', 'error')
      }
    } catch (err) {
      console.error('Custody transfer failed:', err)
      showToast('Custody transfer failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="custody-timeline">
      <div className="custody-timeline__header">
        <div className="custody-timeline__title">
          <h4>Chain of Custody</h4>
          <Icon name="clock" className="icon-sm" />
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--xs"
          onClick={() => setShowTransferForm(!showTransferForm)}
        >
          <Icon name="user" className="icon-xs" /> Transfer Custody
        </button>
      </div>

      {showTransferForm && (
        <form onSubmit={handleTransfer} className="my-3">
          <FormSection title="Transfer Custody" subtitle="Record the recipient and reason in the tamper-evident ledger">
            <FormField label="Transfer To" required hint="Officer ID or custodian name">
              <input
                type="text"
                value={toUser}
                onChange={e => setToUser(e.target.value)}
                placeholder="e.g. Officer Sharma (INV-04)"
                required
              />
            </FormField>
            <FormField label="Reason for Transfer">
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Forensic Lab Analysis"
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn--ghost btn--xs" onClick={() => setShowTransferForm(false)}>Cancel</button>
              <button type="submit" className="btn btn--primary btn--xs" disabled={submitting}>
                {submitting ? 'Recording...' : 'Record Transfer in Ledger'}
              </button>
            </div>
          </FormSection>
        </form>
      )}

      <div className="custody-timeline__content">
        {loading ? (
          <div className="custody-timeline__loading">Loading custody trail...</div>
        ) : timeline.length === 0 ? (
          <div className="custody-timeline__item">
            <span className="custody-timeline__date">Initial Registration</span>
            <span className="custody-timeline__event">Evidence logged into vault — Tamper-evident ledger record created.</span>
          </div>
        ) : (
          <div className="custody-timeline__list">
            <div className="custody-timeline__item">
              <span className="custody-timeline__date">Genesis</span>
              <span className="custody-timeline__event">Evidence registered in case vault</span>
            </div>
            {timeline.map((t, idx) => (
              <div key={t.id || idx} className="custody-timeline__item">
                <span className="custody-timeline__date">
                  {t.transferred_at ? new Date(t.transferred_at).toLocaleString() : 'Transfer'}
                </span>
                <span className="custody-timeline__event">
                  Transferred from <strong>{t.from_user_id || 'Custodian'}</strong> to <strong>{t.to_user_id}</strong>
                  {t.reason && <span className="custody-timeline__reason">Reason: {t.reason}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

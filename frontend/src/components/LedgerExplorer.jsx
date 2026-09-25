import { useApp } from '../context/AppContext'
import Icon from './Icon'

export default function LedgerExplorer() {
  const { verifyChain, showToast } = useApp()

  const handleVerify = async () => {
    const result = await verifyChain()
    if (result?.valid) {
      showToast('Chain integrity verified')
    } else {
      showToast('Chain integrity check failed', 'error')
    }
  }

  return (
    <div className="ledger-explorer">
      <div className="ledger-explorer__header">
        <h2>Evidence Ledger</h2>
        <button className="btn btn--primary" onClick={handleVerify}>
          <Icon name="shield" className="icon-sm" />
          Verify Chain
        </button>
      </div>
      <div className="ledger-explorer__content">
        <p>Blockchain-anchored evidence integrity tracking</p>
      </div>
    </div>
  )
}

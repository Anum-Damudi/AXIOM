import { useApp } from '../context/AppContext'
import Icon from './Icon'

export default function EvidenceUploader() {
  const { selectedCaseId, batchUploadEvidence, showToast } = useApp()

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    
    if (!selectedCaseId) {
      showToast('Please select a case first', 'error')
      return
    }
    
    await batchUploadEvidence(selectedCaseId, files)
  }

  return (
    <div className="evidence-uploader">
      <div className="evidence-uploader__dropzone">
        <Icon name="upload" className="icon-xl" />
        <p>Drag and drop files here or click to upload</p>
        <input 
          type="file" 
          multiple 
          accept="image/*,video/*,application/pdf"
          onChange={handleFileUpload}
          className="evidence-uploader__input"
        />
      </div>
    </div>
  )
}

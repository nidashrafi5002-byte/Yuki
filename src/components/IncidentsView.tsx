import React, { useState } from 'react';
import {
  FileText,
  PlusCircle,
  Calendar,
  MapPin,
  Lock,
  Trash2,
  Printer,
  Eye,
  Shield,
  AlertCircle,
  Download,
  CheckCircle2
} from 'lucide-react';
import { IncidentReport } from '../types';

interface IncidentsViewProps {
  incidents: IncidentReport[];
  onCreateIncident: (incident: any) => Promise<void>;
  onDeleteIncident: (id: string) => Promise<void>;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  onCreateIncident,
  onDeleteIncident,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'HARASSMENT' | 'STALKING' | 'DOMESTIC_ABUSE' | 'CYBER_HARASSMENT' | 'TRAFFICKING_SUSPICION' | 'ASSAULT' | 'OTHER'>('HARASSMENT');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [witnesses, setWitnesses] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [suspectDetails, setSuspectDetails] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !incidentDate) {
      setFormError('Title, Date, and detailed description are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await onCreateIncident({
        title: title.trim(),
        category,
        incidentDate,
        location: location.trim() || 'Not specified',
        description: description.trim(),
        witnesses: witnesses.trim(),
        evidenceNotes: evidenceNotes.trim(),
        suspectDetails: suspectDetails.trim(),
        isEncrypted
      });

      // Reset
      setTitle('');
      setDescription('');
      setLocation('');
      setWitnesses('');
      setEvidenceNotes('');
      setSuspectDetails('');
      setShowAddModal(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to record incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReport = (report: IncidentReport) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Yuki - Confidential Incident Report (${report.id})</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
          .header { border-bottom: 2px solid #dc2626; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 22px; font-weight: bold; color: #b91c1c; }
          .meta { font-size: 12px; color: #555; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; text-transform: uppercase; font-size: 12px; color: #666; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 2px; }
          .content-box { background: #f9f9f9; border: 1px solid #ddd; padding: 12px; border-radius: 6px; font-size: 14px; white-space: pre-wrap; }
          .footer { margin-top: 40px; font-size: 11px; color: #777; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">YUKI SAFETY &bull; CONFIDENTIAL INCIDENT DOCUMENT</div>
            <div class="meta">Document ID: ${report.id} | Generated: ${new Date().toLocaleString()}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Incident Category &amp; Title</div>
          <div><strong>[${report.category}]</strong> ${report.title}</div>
        </div>

        <div class="section">
          <div class="section-title">Date, Time &amp; Location</div>
          <div>Date: ${report.incidentDate} | Location: ${report.location}</div>
        </div>

        <div class="section">
          <div class="section-title">Detailed Event Description</div>
          <div class="content-box">${report.description}</div>
        </div>

        ${report.suspectDetails ? `
        <div class="section">
          <div class="section-title">Perpetrator / Suspect Description</div>
          <div class="content-box">${report.suspectDetails}</div>
        </div>` : ''}

        ${report.witnesses ? `
        <div class="section">
          <div class="section-title">Witnesses &amp; Potential Security Cameras</div>
          <div class="content-box">${report.witnesses}</div>
        </div>` : ''}

        ${report.evidenceNotes ? `
        <div class="section">
          <div class="section-title">Preserved Evidence &amp; Digital Trails</div>
          <div class="content-box">${report.evidenceNotes}</div>
        </div>` : ''}

        <div class="footer">
          This document is generated by Yuki for formal legal, police (FIR), or crisis counselling reference. It contains contemporaneous notes recorded by the user.
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="container-fluid max-w-7xl py-4 px-3">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2">
            <FileText className="text-danger" size={26} />
            <h3 className="fw-bold mb-0">Confidential Incident Vault</h3>
          </div>
          <p className="text-muted small mb-0">
            Securely record contemporaneous notes, evidence records, and witness details for police or legal aid.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-danger d-flex align-items-center gap-2 fw-semibold px-3 py-2 rounded-3 shadow-sm"
          onClick={() => setShowAddModal(true)}
        >
          <PlusCircle size={18} />
          <span>Record New Incident</span>
        </button>
      </div>

      {/* Info Card */}
      <div className="card border-0 shadow-sm rounded-4 p-3 bg-white mb-4">
        <div className="d-flex align-items-start gap-3">
          <div className="p-2 rounded-3 bg-danger bg-opacity-10 text-danger mt-1">
            <Shield size={20} />
          </div>
          <div className="small text-muted">
            <strong className="text-dark">Contemporaneous Evidence Protocol:</strong> Under legal guidelines, notes written immediately or shortly after an incident carry higher evidential value in court proceedings and police FIRs. Record exact times, vehicle numbers, clothing, and audio/photo evidence safely.
          </div>
        </div>
      </div>

      {/* Incidents List */}
      <div className="row g-3">
        {incidents.length === 0 ? (
          <div className="col-12 text-center py-5 bg-white rounded-4 shadow-sm">
            <FileText size={48} className="text-muted opacity-50 mb-3 mx-auto" />
            <h5 className="fw-bold">No Incidents Recorded</h5>
            <p className="text-muted small mb-3">
              Your vault is empty. You can record suspicious behavior, stalking, harassment, or domestic threats here.
            </p>
            <button className="btn btn-danger btn-sm" onClick={() => setShowAddModal(true)}>
              Record Incident
            </button>
          </div>
        ) : (
          incidents.map((report) => (
            <div key={report.id} className="col-md-6 col-lg-4">
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle small">
                      {report.category}
                    </span>
                    {report.isEncrypted && (
                      <span className="badge bg-light text-secondary border small d-flex align-items-center gap-1">
                        <Lock size={11} /> Protected
                      </span>
                    )}
                  </div>

                  <h5 className="fw-bold text-dark mt-2 mb-1 text-truncate" title={report.title}>
                    {report.title}
                  </h5>

                  <div className="d-flex align-items-center gap-2 small text-muted mb-2">
                    <Calendar size={13} />
                    <span>{report.incidentDate}</span>
                    <span>&bull;</span>
                    <MapPin size={13} />
                    <span className="text-truncate">{report.location}</span>
                  </div>

                  <p className="text-secondary small mb-3 line-clamp-3" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {report.description}
                  </p>
                </div>

                <div className="border-top pt-3 mt-2 d-flex justify-content-between align-items-center">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 rounded-3"
                    onClick={() => setSelectedIncident(report)}
                  >
                    <Eye size={15} />
                    <span>View Details</span>
                  </button>

                  <div className="d-flex gap-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-dark p-1.5 rounded-2"
                      onClick={() => handlePrintReport(report)}
                      title="Print / Save PDF"
                    >
                      <Printer size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger p-1.5 rounded-2"
                      onClick={() => onDeleteIncident(report.id)}
                      title="Delete Report"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Record New Incident Modal */}
      {showAddModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4 shadow-xl overflow-hidden">
              <div className="modal-header bg-danger text-white py-3">
                <div className="d-flex align-items-center gap-2">
                  <FileText size={22} />
                  <h5 className="modal-title fw-bold mb-0">Record Incident to Safety Vault</h5>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddModal(false)} />
              </div>

              <div className="modal-body p-4">
                {formError && <div className="alert alert-danger py-2 small mb-3">{formError}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-md-8">
                      <label className="form-label small fw-semibold text-secondary">Incident Title *</label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        placeholder="e.g. Followed on Street, Stalking outside office"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-secondary">Category *</label>
                      <select
                        className="form-select rounded-3"
                        value={category}
                        onChange={(e: any) => setCategory(e.target.value)}
                      >
                        <option value="HARASSMENT">Harassment</option>
                        <option value="STALKING">Stalking / Following</option>
                        <option value="DOMESTIC_ABUSE">Domestic Violence / Threats</option>
                        <option value="CYBER_HARASSMENT">Cyber Bullying / Sextortion</option>
                        <option value="TRAFFICKING_SUSPICION">Trafficking Concern</option>
                        <option value="ASSAULT">Physical Assault</option>
                        <option value="OTHER">Other Incident</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">Date of Incident *</label>
                      <input
                        type="date"
                        className="form-control rounded-3"
                        value={incidentDate}
                        onChange={(e) => setIncidentDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">Location / Landmark *</label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        placeholder="e.g. Bus Stop near Central Market"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-semibold text-secondary">Comprehensive Event Description *</label>
                      <textarea
                        className="form-control rounded-3"
                        rows={4}
                        placeholder="What took place? Exact words spoken, movements, sequence of events..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">Suspect / Perpetrator Description</label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        placeholder="Clothing, approximate age, vehicle number, height..."
                        value={suspectDetails}
                        onChange={(e) => setSuspectDetails(e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold text-secondary">Witnesses &amp; Nearby CCTV</label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        placeholder="Shopkeeper names, security guards, friends present..."
                        value={witnesses}
                        onChange={(e) => setWitnesses(e.target.value)}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-semibold text-secondary">Preserved Evidence Notes</label>
                      <input
                        type="text"
                        className="form-control rounded-3"
                        placeholder="Screenshots saved in secure folder, audio recording filename, photos..."
                        value={evidenceNotes}
                        onChange={(e) => setEvidenceNotes(e.target.value)}
                      />
                    </div>

                    <div className="col-12 mt-4 d-flex justify-content-end gap-2">
                      <button
                        type="button"
                        className="btn btn-light"
                        onClick={() => setShowAddModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-danger px-4 fw-semibold"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Saving...' : 'Save Incident in Vault'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incident Details Modal */}
      {selectedIncident && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 rounded-4 shadow-xl">
              <div className="modal-header py-3">
                <div>
                  <span className="badge bg-danger bg-opacity-10 text-danger mb-1">
                    {selectedIncident.category}
                  </span>
                  <h5 className="modal-title fw-bold mb-0">{selectedIncident.title}</h5>
                </div>
                <button type="button" className="btn-close" onClick={() => setSelectedIncident(null)} />
              </div>

              <div className="modal-body p-4">
                <div className="row g-3 mb-3 text-muted small">
                  <div className="col-sm-6 d-flex align-items-center gap-1.5">
                    <Calendar size={15} />
                    <span><strong>Date:</strong> {selectedIncident.incidentDate}</span>
                  </div>
                  <div className="col-sm-6 d-flex align-items-center gap-1.5">
                    <MapPin size={15} />
                    <span><strong>Location:</strong> {selectedIncident.location}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <h6 className="fw-bold text-secondary text-uppercase small">Full Description:</h6>
                  <div className="p-3 bg-light rounded-3 text-dark small" style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedIncident.description}
                  </div>
                </div>

                {selectedIncident.suspectDetails && (
                  <div className="mb-3">
                    <h6 className="fw-bold text-secondary text-uppercase small">Suspect Details:</h6>
                    <p className="text-dark small mb-0">{selectedIncident.suspectDetails}</p>
                  </div>
                )}

                {selectedIncident.witnesses && (
                  <div className="mb-3">
                    <h6 className="fw-bold text-secondary text-uppercase small">Witnesses:</h6>
                    <p className="text-dark small mb-0">{selectedIncident.witnesses}</p>
                  </div>
                )}

                {selectedIncident.evidenceNotes && (
                  <div className="mb-3">
                    <h6 className="fw-bold text-secondary text-uppercase small">Evidence Notes:</h6>
                    <p className="text-dark small mb-0">{selectedIncident.evidenceNotes}</p>
                  </div>
                )}
              </div>

              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-outline-dark d-flex align-items-center gap-2"
                  onClick={() => handlePrintReport(selectedIncident)}
                >
                  <Printer size={16} />
                  <span>Print FIR Complaint Summary</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedIncident(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

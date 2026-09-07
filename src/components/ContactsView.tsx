import React, { useState } from "react";
import {
  Users,
  UserPlus,
  Phone,
  Mail,
  ShieldCheck,
  Star,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Share2,
  Info,
  X
} from "lucide-react";
import { TrustedContact } from "../types";

interface ContactsViewProps {
  contacts: TrustedContact[];
  onAddContact: (contact: any) => Promise<void>;
  onEditContact?: (id: string, contact: any) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
  onSetPrimary: (id: string) => Promise<void>;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onAddContact,
  onEditContact,
  onDeleteContact,
  onSetPrimary
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testModalContact, setTestModalContact] = useState<TrustedContact | null>(null);
  const [editingContact, setEditingContact] = useState<TrustedContact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<TrustedContact | null>(null);

  // Add Form state
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Mother");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [canReceiveSMS, setCanReceiveSMS] = useState(true);
  const [canReceiveWhatsApp, setCanReceiveWhatsApp] = useState(true);
  const [canReceiveEmail, setCanReceiveEmail] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);

  // Edit Form state
  const [editName, setEditName] = useState("");
  const [editRelationship, setEditRelationship] = useState("Mother");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCanReceiveSMS, setEditCanReceiveSMS] = useState(true);
  const [editCanReceiveWhatsApp, setEditCanReceiveWhatsApp] = useState(true);
  const [editCanReceiveEmail, setEditCanReceiveEmail] = useState(false);
  const [editIsPrimary, setEditIsPrimary] = useState(false);

  // Messages state
  const [errorMessage, setErrorMessage] = useState("");
  const [editErrorMessage, setEditErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const validateMobile = (num: string): boolean => {
    const digits = num.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  };

  const handleOpenAddForm = () => {
    setErrorMessage("");
    setShowAddForm(prev => !prev);
  };

  const handleStartEdit = (contact: TrustedContact) => {
    setEditingContact(contact);
    setEditName(contact.name);
    setEditRelationship(contact.relationship || "Mother");
    setEditPhone(contact.phone);
    setEditEmail(contact.email || "");
    setEditCanReceiveSMS(contact.canReceiveSMS !== false);
    setEditCanReceiveWhatsApp(contact.canReceiveWhatsApp !== false);
    setEditCanReceiveEmail(contact.canReceiveEmail === true);
    setEditIsPrimary(contact.isPrimary === true);
    setEditErrorMessage("");
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!name.trim()) {
      setErrorMessage("Please provide a contact name.");
      return;
    }

    if (!phone.trim()) {
      setErrorMessage("Please enter a mobile phone number.");
      return;
    }

    if (!validateMobile(phone)) {
      setErrorMessage("Please enter a valid mobile number with country code (e.g. +91 98765 43210 or 10-digit number).");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddContact({
        name: name.trim(),
        relationship,
        phone: phone.trim(),
        email: email.trim(),
        canReceiveSMS,
        canReceiveWhatsApp,
        canReceiveEmail,
        isPrimary: contacts.length === 0 ? true : isPrimary
      });

      // Reset form
      setName("");
      setPhone("");
      setEmail("");
      setRelationship("Mother");
      setIsPrimary(false);
      setShowAddForm(false);
      setSuccessMessage(`${name.trim()} has been added to your trusted safety circle.`);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add trusted contact. Please verify your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !onEditContact) return;
    setEditErrorMessage("");

    if (!editName.trim()) {
      setEditErrorMessage("Contact name cannot be empty.");
      return;
    }

    if (!editPhone.trim()) {
      setEditErrorMessage("Mobile phone number cannot be empty.");
      return;
    }

    if (!validateMobile(editPhone)) {
      setEditErrorMessage("Please enter a valid mobile number with country code (e.g. +91 98765 43210).");
      return;
    }

    setIsSubmitting(true);
    try {
      await onEditContact(editingContact.id, {
        name: editName.trim(),
        relationship: editRelationship,
        phone: editPhone.trim(),
        email: editEmail.trim(),
        canReceiveSMS: editCanReceiveSMS,
        canReceiveWhatsApp: editCanReceiveWhatsApp,
        canReceiveEmail: editCanReceiveEmail,
        isPrimary: editIsPrimary
      });

      setSuccessMessage(`${editName.trim()} updated successfully.`);
      setEditingContact(null);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err: any) {
      setEditErrorMessage(err.message || "Failed to update contact. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;
    const targetName = contactToDelete.name;
    setIsSubmitting(true);
    try {
      await onDeleteContact(contactToDelete.id);
      setContactToDelete(null);
      setSuccessMessage(`${targetName} removed from trusted contacts.`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete contact.");
      setContactToDelete(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMakePrimary = async (id: string, contactName: string) => {
    try {
      await onSetPrimary(id);
      setSuccessMessage(`${contactName} designated as primary emergency contact.`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update primary contact.");
    }
  };

  return (
    <div className="container-fluid max-w-7xl py-4 px-3">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2">
            <Users className="text-danger" size={26} />
            <h3 className="fw-bold mb-0">Trusted Safety Circle</h3>
          </div>
          <p className="text-muted small mb-0">
            Emergency alerts, live tracking links, and SMS/WhatsApp broadcasts are dispatched instantly to your trusted circle.
          </p>
        </div>

        <button
          type="button"
          id="btn-add-contact-toggle"
          className="btn btn-danger d-flex align-items-center gap-2 fw-semibold px-3 py-2 rounded-3 shadow-sm"
          onClick={handleOpenAddForm}
        >
          <UserPlus size={18} />
          <span>{showAddForm ? "Close Form" : "Add Trusted Contact"}</span>
        </button>
      </div>

      {/* Global Success Notification */}
      {successMessage && (
        <div className="alert alert-success border-0 shadow-sm rounded-4 p-3 mb-4 d-flex align-items-center gap-2">
          <CheckCircle2 className="text-success flex-shrink-0" size={20} />
          <span className="small fw-medium text-success-emphasis">{successMessage}</span>
        </div>
      )}

      {/* Global Error Notification */}
      {errorMessage && !showAddForm && (
        <div className="alert alert-danger border-0 shadow-sm rounded-4 p-3 mb-4 d-flex align-items-center gap-2">
          <AlertCircle className="text-danger flex-shrink-0" size={20} />
          <span className="small fw-medium text-danger-emphasis">{errorMessage}</span>
        </div>
      )}

      {/* Consent & Privacy Notice */}
      <div className="alert alert-info border-0 shadow-sm rounded-4 p-3 mb-4 d-flex align-items-start gap-3">
        <Info className="text-info-emphasis mt-0.5 flex-shrink-0" size={20} />
        <div className="small text-info-emphasis">
          <strong>Privacy & Authorization Guarantee:</strong> We respect your contacts&apos; privacy. Emergency alerts and live GPS tracking links are sent exclusively when you activate Emergency SOS or if a &quot;Walk With Me&quot; timer expires without safe check-in.
        </div>
      </div>

      {/* Add Contact Collapsible Form */}
      {showAddForm && (
        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white" id="card-add-contact">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-2">
              <UserPlus className="text-danger" size={20} />
              <h5 className="fw-bold mb-0">Add Emergency Contact</h5>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-light rounded-circle p-1"
              onClick={() => setShowAddForm(false)}
            >
              <X size={16} />
            </button>
          </div>

          {errorMessage && (
            <div className="alert alert-danger py-2 px-3 small mb-3 rounded-3 d-flex align-items-center gap-2">
              <AlertCircle size={16} className="text-danger flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleAddSubmit} id="form-add-contact">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary">
                  Contact Full Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="input-contact-name"
                  className="form-control rounded-3"
                  placeholder="e.g. Maya Sharma (Mother)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary">
                  Relationship <span className="text-danger">*</span>
                </label>
                <select
                  id="select-contact-relationship"
                  className="form-select rounded-3"
                  value={relationship}
                  onChange={e => setRelationship(e.target.value)}
                >
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Sister">Sister</option>
                  <option value="Brother">Brother</option>
                  <option value="Partner / Spouse">Partner / Spouse</option>
                  <option value="Close Friend">Close Friend</option>
                  <option value="Roommate / Flatmate">Roommate / Flatmate</option>
                  <option value="Colleague">Colleague</option>
                  <option value="Local Women Safety Cell">Local Women Safety Cell</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary">
                  Mobile Phone Number <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  id="input-contact-phone"
                  className="form-control rounded-3 font-monospace"
                  placeholder="e.g. +91 98765 43210 or 9876543210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                />
                <div className="form-text small">Include country code for international or regional dispatch (e.g. +91).</div>
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold text-secondary">
                  Email Address <span className="text-muted">(Optional)</span>
                </label>
                <input
                  type="email"
                  id="input-contact-email"
                  className="form-control rounded-3"
                  placeholder="e.g. mother@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              {/* Notification Preferences */}
              <div className="col-12">
                <span className="small fw-semibold text-secondary d-block mb-2">Emergency Dispatch Channels:</span>
                <div className="d-flex flex-wrap gap-4">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="smsCheck"
                      checked={canReceiveSMS}
                      onChange={e => setCanReceiveSMS(e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="smsCheck">SMS Alert</label>
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="waCheck"
                      checked={canReceiveWhatsApp}
                      onChange={e => setCanReceiveWhatsApp(e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="waCheck">WhatsApp Direct Link</label>
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="emailCheck"
                      checked={canReceiveEmail}
                      onChange={e => setCanReceiveEmail(e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="emailCheck">Email Notice</label>
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="primaryCheck"
                      checked={isPrimary}
                      onChange={e => setIsPrimary(e.target.checked)}
                    />
                    <label className="form-check-label small fw-bold text-danger" htmlFor="primaryCheck">
                      Set as Primary Emergency Contact
                    </label>
                  </div>
                </div>
              </div>

              <div className="col-12 d-flex gap-2 justify-content-end mt-4">
                <button
                  type="button"
                  className="btn btn-light rounded-3 px-3"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-contact"
                  className="btn btn-danger fw-semibold px-4 rounded-3 d-flex align-items-center gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving Contact..." : "Save Trusted Contact"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Contacts List Cards */}
      <div className="row g-3" id="contacts-list-container">
        {contacts.length === 0 ? (
          <div className="col-12 text-center py-5 bg-white rounded-4 shadow-sm">
            <Users size={48} className="text-muted opacity-50 mb-3 mx-auto" />
            <h5 className="fw-bold">No Trusted Contacts Yet</h5>
            <p className="text-muted small mb-3">
              Add your mother, father, friends, or local safety coordinators who should receive your emergency alerts and live GPS link.
            </p>
            <button
              id="btn-add-first-contact"
              className="btn btn-danger btn-sm rounded-3 px-3 py-2 fw-semibold"
              onClick={() => setShowAddForm(true)}
            >
              Add First Contact
            </button>
          </div>
        ) : (
          contacts.map(contact => (
            <div key={contact.id} className="col-md-6 col-lg-4" id={`contact-card-${contact.id}`}>
              <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 d-flex flex-column justify-content-between position-relative">
                <div>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h5 className="fw-bold mb-0 text-dark">{contact.name}</h5>
                      <span className="badge bg-light text-secondary border small mt-1">
                        {contact.relationship}
                      </span>
                    </div>

                    {contact.isPrimary ? (
                      <span className="badge bg-danger text-white d-flex align-items-center gap-1">
                        <Star size={12} fill="white" /> Primary Contact
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-secondary text-decoration-none p-0"
                        onClick={() => handleMakePrimary(contact.id, contact.name)}
                        title="Make Primary Contact"
                      >
                        <small>Set Primary</small>
                      </button>
                    )}
                  </div>

                  <div className="mt-3 small text-muted d-flex flex-column gap-1.5">
                    <div className="d-flex align-items-center gap-2">
                      <Phone size={14} className="text-danger flex-shrink-0" />
                      <span className="font-monospace text-dark fw-medium">{contact.phone}</span>
                    </div>
                    {contact.email && (
                      <div className="d-flex align-items-center gap-2">
                        <Mail size={14} className="text-secondary flex-shrink-0" />
                        <span className="text-truncate">{contact.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Channel Badges */}
                  <div className="d-flex gap-1 mt-3 flex-wrap">
                    {contact.canReceiveSMS && (
                      <span className="badge bg-secondary-subtle text-secondary" style={{ fontSize: "11px" }}>SMS</span>
                    )}
                    {contact.canReceiveWhatsApp && (
                      <span className="badge bg-success-subtle text-success" style={{ fontSize: "11px" }}>WhatsApp</span>
                    )}
                    {contact.canReceiveEmail && (
                      <span className="badge bg-info-subtle text-info-emphasis" style={{ fontSize: "11px" }}>Email</span>
                    )}
                  </div>
                </div>

                <div className="border-top pt-3 mt-3 d-flex justify-content-between align-items-center">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 rounded-2"
                    onClick={() => setTestModalContact(contact)}
                  >
                    <MessageSquare size={14} />
                    <span>Test Alert</span>
                  </button>

                  <div className="d-flex gap-1">
                    {onEditContact && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary p-1.5 rounded-2"
                        onClick={() => handleStartEdit(contact)}
                        title="Edit Contact"
                      >
                        <Edit3 size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger p-1.5 rounded-2"
                      onClick={() => setContactToDelete(contact)}
                      title="Remove Contact"
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

      {/* Edit Contact Modal */}
      {editingContact && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-2">
                  <Edit3 className="text-danger" size={20} />
                  <h5 className="fw-bold mb-0">Edit Contact Details</h5>
                </div>
                <button type="button" className="btn-close" onClick={() => setEditingContact(null)} />
              </div>

              {editErrorMessage && (
                <div className="alert alert-danger py-2 px-3 small mb-3 rounded-3 d-flex align-items-center gap-2">
                  <AlertCircle size={16} className="text-danger flex-shrink-0" />
                  <span>{editErrorMessage}</span>
                </div>
              )}

              <form onSubmit={handleEditSubmit}>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary">Contact Name *</label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary">Relationship *</label>
                    <select
                      className="form-select rounded-3"
                      value={editRelationship}
                      onChange={e => setEditRelationship(e.target.value)}
                    >
                      <option value="Mother">Mother</option>
                      <option value="Father">Father</option>
                      <option value="Sister">Sister</option>
                      <option value="Brother">Brother</option>
                      <option value="Partner / Spouse">Partner / Spouse</option>
                      <option value="Close Friend">Close Friend</option>
                      <option value="Roommate / Flatmate">Roommate / Flatmate</option>
                      <option value="Colleague">Colleague</option>
                      <option value="Local Women Safety Cell">Local Women Safety Cell</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary">Mobile Phone Number *</label>
                    <input
                      type="tel"
                      className="form-control rounded-3 font-monospace"
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary">Email Address (Optional)</label>
                    <input
                      type="email"
                      className="form-control rounded-3"
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <span className="small fw-semibold text-secondary d-block mb-2">Notification Preferences:</span>
                    <div className="d-flex flex-column gap-2">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="editSmsCheck"
                          checked={editCanReceiveSMS}
                          onChange={e => setEditCanReceiveSMS(e.target.checked)}
                        />
                        <label className="form-check-label small" htmlFor="editSmsCheck">SMS Alert</label>
                      </div>
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="editWaCheck"
                          checked={editCanReceiveWhatsApp}
                          onChange={e => setEditCanReceiveWhatsApp(e.target.checked)}
                        />
                        <label className="form-check-label small" htmlFor="editWaCheck">WhatsApp Direct Link</label>
                      </div>
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="editEmailCheck"
                          checked={editCanReceiveEmail}
                          onChange={e => setEditCanReceiveEmail(e.target.checked)}
                        />
                        <label className="form-check-label small" htmlFor="editEmailCheck">Email Notice</label>
                      </div>
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="editPrimaryCheck"
                          checked={editIsPrimary}
                          onChange={e => setEditIsPrimary(e.target.checked)}
                        />
                        <label className="form-check-label small fw-bold text-danger" htmlFor="editPrimaryCheck">
                          Set as Primary Emergency Contact
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 d-flex gap-2 justify-content-end mt-4">
                    <button
                      type="button"
                      className="btn btn-light rounded-3 px-3"
                      onClick={() => setEditingContact(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-danger fw-semibold px-4 rounded-3"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Updating..." : "Update Contact"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {contactToDelete && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg p-4">
              <div className="d-flex align-items-center gap-2 text-danger mb-3">
                <AlertCircle size={24} />
                <h5 className="fw-bold mb-0">Remove Trusted Contact?</h5>
              </div>
              <p className="text-muted small mb-4">
                Are you sure you want to remove <strong>{contactToDelete.name}</strong> ({contactToDelete.phone}) from your trusted safety circle? They will no longer receive emergency alerts or live GPS tracking links.
              </p>
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-light rounded-3 px-3"
                  onClick={() => setContactToDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger rounded-3 px-4 fw-semibold"
                  onClick={handleConfirmDelete}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Removing..." : "Yes, Remove Contact"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Alert Preview Modal */}
      {testModalContact && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0">Emergency Alert Message Preview</h5>
                <button type="button" className="btn-close" onClick={() => setTestModalContact(null)} />
              </div>

              <p className="text-muted small mb-3">
                Here is the exact message that will be transmitted to <strong>{testModalContact.name}</strong> ({testModalContact.phone}) when you trigger SOS:
              </p>

              <div className="bg-light p-3 rounded-3 border font-monospace small mb-4 text-dark">
                🚨 <strong>EMERGENCY ALERT:</strong> Yuki emergency alert activated! I need immediate help. View my real-time GPS location: https://yuki.live/track/sample-token . If you cannot reach me, immediately call 112 (Police) or 1091 (Women Helpline).
              </div>

              <div className="d-flex gap-2">
                <a
                  href={`sms:${testModalContact.phone}?body=${encodeURIComponent("🚨 [TEST ALERT] This is a test of my Yuki emergency safety contact configuration. No action is required.")}`}
                  className="btn btn-outline-secondary w-50 py-2 d-flex align-items-center justify-content-center gap-2 rounded-3"
                >
                  <MessageSquare size={16} />
                  Send Test SMS
                </a>
                <a
                  href={`https://api.whatsapp.com/send?phone=${testModalContact.phone.replace(/[^0-9]/g, "")}&text=${encodeURIComponent("🚨 [TEST ALERT] This is a test of my Yuki emergency safety contact configuration. No action is required.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-success w-50 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold rounded-3"
                >
                  <Share2 size={16} />
                  Test on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

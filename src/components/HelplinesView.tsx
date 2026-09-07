import React, { useState } from 'react';
import { PhoneCall, Search, MessageCircle, ExternalLink, ShieldCheck, Clock, MapPin, CheckCircle } from 'lucide-react';
import { VERIFIED_HELPLINES } from '../data/helplines';
import { VerifiedHelpline } from '../types';

export const HelplinesView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    'All',
    'National Emergency',
    'Women Helpline',
    'Legal & NCW',
    'Cyber Crime',
    'Child Protection',
    'Mental Health'
  ];

  const filteredHelplines = VERIFIED_HELPLINES.filter((h) => {
    const matchesCategory = selectedCategory === 'All' || h.category === selectedCategory;
    const matchesSearch =
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.number.includes(searchQuery) ||
      h.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.region.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="container-fluid max-w-7xl py-4 px-3">
      {/* Header */}
      <div className="mb-4">
        <div className="d-flex align-items-center gap-2 mb-1">
          <PhoneCall className="text-danger" size={26} />
          <h3 className="fw-bold mb-0">Verified Emergency Helplines</h3>
        </div>
        <p className="text-muted small mb-0">
          Official, verified 24/7 emergency dispatch centers and specialized crisis hotlines.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="card border-0 shadow-sm rounded-4 p-3 bg-white mb-4">
        <div className="row g-3 align-items-center">
          <div className="col-md-5">
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <Search size={16} className="text-muted" />
              </span>
              <input
                type="text"
                className="form-control bg-light border-start-0"
                placeholder="Search helpline name, number, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="col-md-7">
            <div className="d-flex gap-1.5 flex-wrap justify-content-md-end">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold ${
                    selectedCategory === cat ? 'btn-danger' : 'btn-light border'
                  }`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Helplines Grid */}
      <div className="row g-3">
        {filteredHelplines.map((item: VerifiedHelpline) => (
          <div key={item.id} className="col-md-6 col-lg-4">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100 d-flex flex-column justify-content-between">
              <div>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle small">
                    {item.category}
                  </span>
                  {item.tollFree && (
                    <span className="badge bg-success-subtle text-success small">Toll Free</span>
                  )}
                </div>

                <h5 className="fw-bold text-dark mt-2 mb-1">{item.name}</h5>
                <p className="text-muted small mb-3">{item.description}</p>

                <div className="d-flex flex-column gap-1.5 small text-secondary mb-3">
                  <div className="d-flex align-items-center gap-1.5">
                    <Clock size={14} className="text-muted" />
                    <span>{item.hours}</span>
                  </div>
                  <div className="d-flex align-items-center gap-1.5">
                    <MapPin size={14} className="text-muted" />
                    <span>{item.region}</span>
                  </div>
                </div>
              </div>

              <div className="border-top pt-3 mt-2">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <span className="text-muted" style={{ fontSize: '11px' }}>Dial Number:</span>
                    <div className="fs-5 fw-bold text-danger font-monospace">{item.number}</div>
                  </div>

                  <div className="d-flex gap-2">
                    {item.whatsapp && (
                      <a
                        href={`https://wa.me/91${item.whatsapp}?text=HELP`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 rounded-3"
                        title="Open WhatsApp Help"
                      >
                        <MessageCircle size={16} />
                        <span className="d-none d-sm-inline">WhatsApp</span>
                      </a>
                    )}

                    <a
                      href={`tel:${item.number.replace(/\s+/g, '')}`}
                      className="btn btn-danger btn-sm d-flex align-items-center gap-1.5 px-3 py-2 rounded-3 fw-bold shadow-xs"
                    >
                      <PhoneCall size={16} />
                      <span>Call Now</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

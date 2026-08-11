import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, ExternalLink, Calendar, MapPin, Briefcase, User, Users, Landmark, TrendingUp, HelpCircle, FileDown, Plus, Trash2, Send, Clock, RefreshCw, Phone } from 'lucide-react';
import { Startup, Note, PipelineStatus, AuditLog } from '../../shared/src/types';
import { apiClient } from './apiClient';
import { safeHref } from '../../shared/src/securityUtils';

interface StartupDetailProps {
  startup: Startup;
  onClose: () => void;
  onUpdateStatus: (status: PipelineStatus) => void;
  onDelete: () => void;
  currentUser: { id: string; email: string };
  // Bumped by the parent whenever a note/status change is made from outside this
  // drawer (e.g. the status-note popup) so the activity feed knows to refetch.
  activityRefreshKey?: number;
}

export default function StartupDetail({
  startup,
  onClose,
  onUpdateStatus,
  onDelete,
  currentUser,
  activityRefreshKey,
}: StartupDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'notes'>('overview');
  const [activityFilter, setActivityFilter] = useState<'all' | 'notes'>('all');
  const [notes, setNotes] = useState<Note[]>([]);
  const [statusHistory, setStatusHistory] = useState<AuditLog[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [cachedSignedUrl, setCachedSignedUrl] = useState<string | null>(null);
  const [signedUrlExpiry, setSignedUrlExpiry] = useState<number | null>(null);

  useEffect(() => {
    fetchActivity();
    // Re-fetch whenever the status changes too, so a status update made from this
    // same drawer (or the pipeline board, once this startup is re-selected) shows
    // up in the activity feed without needing to close and reopen the drawer.
    // activityRefreshKey covers notes/status-changes saved from OUTSIDE this drawer
    // (the status-note popup), which this component would otherwise have no way
    // of knowing about since that's a separate part of the tree.
  }, [startup.id, startup.status, activityRefreshKey]);

  const fetchActivity = async (silent = false) => {
    if (!silent) setNotesLoading(true);
    try {
      const [notesList, auditLogs] = await Promise.all([
        apiClient.getNotes(startup.id),
        apiClient.getAuditLogsForTarget(startup.id)
      ]);
      setNotes(notesList);
      setStatusHistory(auditLogs.filter(log => (log.action || '').toLowerCase().includes('status changed')));
    } catch (e) {
      console.error('Error fetching activity:', e);
    } finally {
      if (!silent) setNotesLoading(false);
    }
  };

  const handleDownloadPitchDeck = async () => {
    setIsDownloading(true);
    try {
      // Check if we have a valid non-expired signed URL cached in state (with 5 minutes safety threshold)
      if (cachedSignedUrl && signedUrlExpiry && Date.now() < signedUrlExpiry - 300000) {
        // noopener,noreferrer prevents the opened document from reaching back
        // via window.opener (reverse tabnabbing), in case a malicious file
        // was ever stored under this path.
        window.open(cachedSignedUrl, '_blank', 'noopener,noreferrer');
        setIsDownloading(false);
        return;
      }

      const signedUrl = await apiClient.getSignedUrl(startup.id, startup.pitch_deck_path);
      if (signedUrl) {
        setCachedSignedUrl(signedUrl);
        // Expiry from Supabase Storage is configured to 3600 seconds (1 hour)
        setSignedUrlExpiry(Date.now() + 3600000);
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('Could not retrieve a valid download link.');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching signed URL for pitch deck.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setIsSubmittingNote(true);
    try {
      const note = await apiClient.addNote(startup.id, newNoteContent);
      if (note) {
        setNotes((prev) => [note, ...prev]);
        setNewNoteContent('');
      }
    } catch (err) {
      console.error('Failed to add note:', err);
      alert('Failed to save your note. Please try again.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this reviewer note?')) return;
    try {
      const success = await apiClient.deleteNote(noteId);
      if (success) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete note.');
    }
  };

  const handleDeleteStartup = async () => {
    setIsDeleting(true);
    try {
      const success = await apiClient.deleteStartup(startup.id);
      if (success) {
        onDelete();
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete startup. Verify permissions.');
    } finally {
      setIsDeleting(false);
    }
  };

  const pipelineStatuses: PipelineStatus[] = [
    'New',
    'Screening',
    'Meeting',
    'Due Diligence',
    'Approved',
    'Rejected',
    'Archived',
  ];

  const getCurrencySymbol = (curr: string) => {
    switch (curr) {
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return '₹';
    }
  };

  const currencySymbol = getCurrencySymbol(startup.currency || 'INR');
  const currencyCode = startup.currency || 'INR';
  const isDraft = startup.status === 'In Progress';

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Side Drawer Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white border-l border-neutral-200 shadow-2xl z-50 flex flex-col h-full"
        id="startup-drawer"
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 tracking-tight flex items-center gap-2 mt-0.5">
              {startup.company_name || <span className="text-neutral-400 italic font-normal">Company name not yet provided</span>}
              {startup.website && (
                <a
                  href={safeHref(startup.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-400 hover:text-neutral-900 inline-flex"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Status bar selector */}
        <div className="px-6 py-3.5 border-b border-neutral-100 bg-neutral-50/20 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status:</span>
            {isDraft ? (
              <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-lg" id="status-badge-draft">
                In Progress -- Not Yet Submitted
              </span>
            ) : (
              <select
                value={startup.status}
                onChange={(e) => onUpdateStatus(e.target.value as PipelineStatus)}
                className="px-3 py-1.5 bg-white border border-neutral-200 hover:border-neutral-900 text-xs font-semibold rounded-lg outline-none cursor-pointer text-neutral-800"
                id="status-select-drawer"
              >
                {pipelineStatuses.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex justify-start sm:justify-end gap-2">
            {!isDraft && (
              <button
                onClick={handleDownloadPitchDeck}
                disabled={isDownloading}
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-medium text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors shadow-xs"
                id="btn-download-pitch-deck"
              >
                {isDownloading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" />
                )}
                Download Pitch Deck
              </button>
            )}

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 bg-red-50 text-red-600 border border-red-150 hover:bg-red-100 rounded-lg transition-colors"
              title="Delete Application"
              id="btn-delete-startup"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-neutral-100 flex gap-6 text-sm">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 font-medium transition-all border-b-2 ${
              activeTab === 'overview'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-900'
            }`}
            id="tab-detail-overview"
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 font-medium transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'notes'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-900'
            }`}
            id="tab-detail-notes"
          >
            Activity & Notes
            <span className="px-1.5 py-0.5 bg-neutral-100 text-[10px] rounded-full text-neutral-600 font-bold">
              {notes.length + statusHistory.length}
            </span>
          </button>
        </div>

        {/* Tab Content Box */}
        <div className="flex-1 overflow-y-auto px-6 py-6" id="drawer-content">
          {activeTab === 'overview' ? (
            <div className="space-y-8 text-sm">
              {/* Sector & HQ Location -- always relevant, shown regardless of submission format */}
              <div className="flex flex-wrap gap-2">
                {startup.sector && (
                  <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-700">
                    {startup.sector === 'Other' && startup.sector_other ? startup.sector_other : startup.sector}
                  </span>
                )}
                {startup.hq_location && (
                  <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-700 inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-neutral-400" />
                    {startup.hq_location}
                  </span>
                )}
              </div>

              {/* Submitted by -- the person who filled out the form, who may not be the founder
                  (e.g. an investment banker or mentor applying on the startup's behalf). */}
              {(startup.submitter_name || startup.submitter_email) && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono">
                    Submitted By
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-600 bg-neutral-50 border border-neutral-200/50 p-4 rounded-xl">
                    <div><span className="text-neutral-400">Name:</span> <span className="font-medium text-neutral-900">{startup.submitter_name || '—'}</span></div>
                    <div><span className="text-neutral-400">Role:</span> <span className="font-medium text-neutral-900">{startup.submitter_role || '—'}</span></div>
                    <div><span className="text-neutral-400">Phone:</span> <span className="font-medium text-neutral-900">{startup.submitter_phone || '—'}</span></div>
                    <div><span className="text-neutral-400">Email:</span> <span className="font-medium text-neutral-900">{startup.submitter_email || '—'}</span></div>
                    {startup.referral_source && (
                      <div className="sm:col-span-2"><span className="text-neutral-400">Heard about us via:</span> <span className="font-medium text-neutral-900">{startup.referral_source}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* One liner & description */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono">
                  Pitch & Executive Summary
                </h3>
                <p className="font-medium text-neutral-900 text-base leading-relaxed">
                  {startup.one_line_pitch || <span className="text-neutral-400 italic font-normal">Not yet provided</span>}
                </p>
                {!startup.problem_statement && startup.description && (
                  <p className="text-neutral-600 leading-relaxed bg-neutral-50 border border-neutral-200/50 p-4 rounded-xl mt-3">
                    {startup.description}
                  </p>
                )}
              </div>

              {/* Structured business fields (new-format submissions) -- legacy rows fall back to
                  the free-text `description` blob above instead. */}
              {(startup.problem_statement || startup.proposed_solution || startup.target_audience || startup.revenue_model) && (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono border-b border-neutral-100 pb-1">
                    The Business
                  </h3>
                  {startup.problem_statement && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Problem Statement</span>
                      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg">{startup.problem_statement}</p>
                    </div>
                  )}
                  {startup.proposed_solution && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Proposed Solution</span>
                      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg">{startup.proposed_solution}</p>
                    </div>
                  )}
                  {startup.target_audience && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Target Audience</span>
                      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg">{startup.target_audience}</p>
                    </div>
                  )}
                  {startup.revenue_model && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Revenue Model</span>
                      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg">{startup.revenue_model}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Financials & Raising Details */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border border-neutral-200/60 rounded-xl p-4 bg-neutral-50/30">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">
                    TARGET RAISE
                  </span>
                  <span className="text-base font-semibold text-neutral-900 font-mono">
                    {currencySymbol}{Number(startup.target_raise || 0).toLocaleString()} {currencyCode}
                  </span>
                </div>
                <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-neutral-150 pt-3 sm:pt-0 sm:pl-4">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">
                    PRIOR CAPITAL
                  </span>
                  <span className="text-base font-semibold text-neutral-900 font-mono">
                    {startup.funding_raised ? `${currencySymbol}${Number(startup.funding_raised).toLocaleString()} ${currencyCode}` : 'Nil'}
                  </span>
                </div>
                <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-neutral-150 pt-3 sm:pt-0 sm:pl-4">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">
                    STAGE
                  </span>
                  <span className="text-base font-semibold text-neutral-900">
                    {startup.stage || '—'}
                  </span>
                </div>
                {startup.current_valuation != null && (
                  <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-neutral-150 pt-3 sm:pt-0 sm:pl-4">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">
                      CURRENT VALUATION
                    </span>
                    <span className="text-base font-semibold text-neutral-900 font-mono">
                      {currencySymbol}{Number(startup.current_valuation).toLocaleString()} {currencyCode}
                    </span>
                  </div>
                )}
              </div>

              {/* Previous funding round (new-format submissions only) */}
              {startup.raised_before && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-neutral-200/60 rounded-xl p-4 bg-neutral-50/30">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">PREVIOUS ROUND RAISED</span>
                    <span className="text-base font-semibold text-neutral-900 font-mono">
                      {startup.previous_round_amount != null ? `${currencySymbol}${Number(startup.previous_round_amount).toLocaleString()} ${currencyCode}` : '—'}
                    </span>
                  </div>
                  <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-neutral-150 pt-3 sm:pt-0 sm:pl-4">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">PREVIOUS ROUND VALUATION</span>
                    <span className="text-base font-semibold text-neutral-900 font-mono">
                      {startup.previous_round_valuation != null ? `${currencySymbol}${Number(startup.previous_round_valuation).toLocaleString()} ${currencyCode}` : '—'}
                    </span>
                  </div>
                  <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-neutral-150 pt-3 sm:pt-0 sm:pl-4">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">MONTH & YEAR</span>
                    <span className="text-base font-semibold text-neutral-900">{startup.previous_round_date || '—'}</span>
                  </div>
                </div>
              )}

              {/* Revenue & Financial Status */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono">
                  Revenue & Financial Status
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-neutral-200/60 rounded-xl p-4 bg-neutral-50/30">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">
                      REVENUE STATUS
                    </span>
                    <span className="text-sm font-semibold text-neutral-900">
                      {startup.revenue_status || 'Pre-Revenue'}
                    </span>
                  </div>
                  <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-neutral-150 pt-3 sm:pt-0 sm:pl-4">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">
                      REVENUE Generated in FY 2024–25
                    </span>
                    <span className="text-base font-semibold text-neutral-900 font-mono">
                      {startup.revenue_status === 'Revenue Generating' && startup.revenue_generated_fy25
                        ? `${currencySymbol}${Number(startup.revenue_generated_fy25).toLocaleString()} ${currencyCode}`
                        : 'Pre-Revenue'}
                    </span>
                  </div>
                  <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-neutral-150 pt-3 sm:pt-0 sm:pl-4">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">
                      FY REVENUE
                    </span>
                    <span className="text-base font-semibold text-neutral-900 font-mono">
                      {startup.current_financial_year_revenue 
                        ? `${currencySymbol}${Number(startup.current_financial_year_revenue).toLocaleString()} ${currencyCode}`
                        : `${currencySymbol}0 ${currencyCode}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Founder profile info */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono border-b border-neutral-100 pb-1">
                  Founding Team Contacts
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex gap-2 items-center text-xs text-neutral-600 bg-neutral-50 border border-neutral-200/40 px-3 py-2 rounded-lg">
                    <User className="h-4 w-4 text-neutral-400 shrink-0" />
                    <div>
                      <p className="font-medium text-neutral-900">{startup.founder_name || '—'}</p>
                      <p className="text-[10px] text-neutral-400">Primary Founder</p>
                    </div>
                  </div>
                  {startup.founder_phone ? (
                    <div className="flex gap-2 items-center text-xs text-neutral-600 bg-neutral-50 border border-neutral-200/40 px-3 py-2 rounded-lg">
                      <Phone className="h-4 w-4 text-neutral-400 shrink-0" />
                      <div>
                        <p className="font-medium text-neutral-900">{startup.founder_phone}</p>
                        <p className="text-[10px] text-neutral-400">Founder Phone</p>
                      </div>
                    </div>
                  ) : startup.team_size != null && (
                    <div className="flex gap-2 items-center text-xs text-neutral-600 bg-neutral-50 border border-neutral-200/40 px-3 py-2 rounded-lg">
                      <Users className="h-4 w-4 text-neutral-400 shrink-0" />
                      <div>
                        <p className="font-medium text-neutral-900">Size: {startup.team_size} FTE</p>
                        <p className="text-[10px] text-neutral-400">Company Size</p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 items-center text-xs text-neutral-600 bg-neutral-50 border border-neutral-200/40 px-3 py-2 rounded-lg">
                    <Clock className="h-4 w-4 text-neutral-400 shrink-0" />
                    <div>
                      <p className="font-medium text-neutral-900 truncate">{startup.founder_email || '—'}</p>
                      <p className="text-[10px] text-neutral-400">Founder Email</p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center text-xs text-neutral-600 bg-neutral-50 border border-neutral-200/40 px-3 py-2 rounded-lg">
                    <ExternalLink className="h-4 w-4 text-neutral-400 shrink-0" />
                    <div>
                      {startup.founder_linkedin ? (
                        <a
                          href={safeHref(startup.founder_linkedin)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-neutral-900 hover:underline inline-flex items-center gap-1"
                        >
                          LinkedIn Profile
                        </a>
                      ) : (
                        <span className="font-medium text-neutral-400">Not Provided</span>
                      )}
                      <p className="text-[10px] text-neutral-400">Founder Profile</p>
                    </div>
                  </div>
                  {startup.company_linkedin && (
                    <div className="flex gap-2 items-center text-xs text-neutral-600 bg-neutral-50 border border-neutral-200/40 px-3 py-2 rounded-lg">
                      <ExternalLink className="h-4 w-4 text-neutral-400 shrink-0" />
                      <div>
                        <a
                          href={safeHref(startup.company_linkedin)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-neutral-900 hover:underline inline-flex items-center gap-1"
                        >
                          LinkedIn Profile
                        </a>
                        <p className="text-[10px] text-neutral-400">Startup Profile</p>
                      </div>
                    </div>
                  )}
                </div>

                {startup.team_background && (
                  <div className="space-y-1 mt-2">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest font-mono">
                      Team Background & Pedigree
                    </span>
                    <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap pl-1 border-l-2 border-neutral-200">
                      {startup.team_background}
                    </p>
                  </div>
                )}
              </div>

              {/* Traction section: structured fields for new-format submissions, falling back to
                  the old free-text blob for legacy rows. */}
              {(startup.current_customers != null || startup.monthly_burn != null ||
                startup.revenue_fy_2425 != null || startup.revenue_fy_2526 != null || startup.revenue_fy_2627 != null) ? (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono border-b border-neutral-100 pb-1">
                    Metrics & Traction
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 border border-neutral-200/60 rounded-xl p-4 bg-neutral-50/30">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">CUSTOMERS</span>
                      <span className="text-base font-semibold text-neutral-900 font-mono">{startup.current_customers ?? '—'}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">BURN / MO</span>
                      <span className="text-base font-semibold text-neutral-900 font-mono">
                        {startup.monthly_burn != null ? `${currencySymbol}${Number(startup.monthly_burn).toLocaleString()}` : '—'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">FY 24–25</span>
                      <span className="text-base font-semibold text-neutral-900 font-mono">
                        {startup.revenue_fy_2425 != null ? `${currencySymbol}${Number(startup.revenue_fy_2425).toLocaleString()}` : '—'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">FY 25–26</span>
                      <span className="text-base font-semibold text-neutral-900 font-mono">
                        {startup.revenue_fy_2526 != null ? `${currencySymbol}${Number(startup.revenue_fy_2526).toLocaleString()}` : '—'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">FY 26–27</span>
                      <span className="text-base font-semibold text-neutral-900 font-mono">
                        {startup.revenue_fy_2627 != null ? `${currencySymbol}${Number(startup.revenue_fy_2627).toLocaleString()}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : startup.traction && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono border-b border-neutral-100 pb-1">
                    Metrics & Traction
                  </h3>
                  <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap bg-neutral-50 border border-neutral-200/40 p-4 rounded-xl">
                    {startup.traction}
                  </p>
                </div>
              )}

              {/* Pitch deck link (new-format submissions) */}
              {startup.pitch_deck_link && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono border-b border-neutral-100 pb-1">
                    Pitch Deck
                  </h3>
                  <a
                    href={safeHref(startup.pitch_deck_link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-neutral-700 hover:text-neutral-900 font-medium border border-neutral-200 hover:border-neutral-300 px-4 py-2 bg-white hover:bg-neutral-50 rounded-lg shadow-2xs"
                  >
                    Open Pitch Deck
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}

              {/* Additional material link (demo video / data room / one-pager, etc.) */}
              {startup.demo_video && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono border-b border-neutral-100 pb-1">
                    {startup.pitch_deck_link ? 'Additional Material' : 'Product Walkthrough'}
                  </h3>
                  <a
                    href={safeHref(startup.demo_video)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-neutral-700 hover:text-neutral-900 font-medium border border-neutral-200 hover:border-neutral-300 px-4 py-2 bg-white hover:bg-neutral-50 rounded-lg shadow-2xs"
                  >
                    {startup.pitch_deck_link ? 'Open Additional Material' : 'Watch Product Demo'}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}

            </div>
          ) : (
            <div className="space-y-6">
              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="space-y-3 bg-neutral-50 border border-neutral-200/60 p-4 rounded-xl">
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Add Reviewer Note
                </h4>
                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="Enter investment review, due diligence summary, checklist item, or general feedback..."
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    className="w-full text-xs p-3 bg-white border border-neutral-200 focus:border-neutral-900 rounded-lg outline-none resize-none"
                    id="reviewer-note-input"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Signed as: {currentUser.email}
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmittingNote || !newNoteContent.trim()}
                    className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-medium text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors"
                    id="btn-submit-note"
                  >
                    {isSubmittingNote ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Save Note
                  </button>
                </div>
              </form>

              {/* Combined Activity Feed: reviewer notes + status change history, merged
                  chronologically so every admin sees exactly who reviewed this applicant,
                  what they wrote, and every status change made -- all in one place. */}
              {(() => {
                type ActivityItem =
                  | { kind: 'note'; id: string; created_at: string; note: Note }
                  | { kind: 'status'; id: string; created_at: string; log: AuditLog };

                const activityFeed: ActivityItem[] = [
                  ...notes.map((n): ActivityItem => ({ kind: 'note', id: n.id, created_at: n.created_at, note: n })),
                  ...statusHistory.map((l): ActivityItem => ({ kind: 'status', id: l.id, created_at: l.created_at, log: l })),
                ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                const visibleFeed = activityFilter === 'notes' ? activityFeed.filter(i => i.kind === 'note') : activityFeed;

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        {activityFilter === 'notes' ? `Notes Only (${notes.length})` : `Activity Log (${activityFeed.length})`}
                      </h4>
                      <div className="flex gap-1 bg-neutral-100 border border-neutral-200 p-0.5 rounded-lg text-[10px]">
                        <button
                          onClick={() => setActivityFilter('all')}
                          className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                            activityFilter === 'all' ? 'bg-white text-neutral-900 shadow-2xs' : 'text-neutral-500 hover:text-neutral-800'
                          }`}
                          id="btn-activity-filter-all"
                        >
                          All Activity
                        </button>
                        <button
                          onClick={() => setActivityFilter('notes')}
                          className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                            activityFilter === 'notes' ? 'bg-white text-neutral-900 shadow-2xs' : 'text-neutral-500 hover:text-neutral-800'
                          }`}
                          id="btn-activity-filter-notes"
                        >
                          Notes Only
                        </button>
                      </div>
                    </div>

                    {notesLoading ? (
                      <div className="text-center py-8 text-neutral-400 text-xs font-mono">
                        Loading activity...
                      </div>
                    ) : visibleFeed.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-neutral-200 rounded-xl text-neutral-400 text-xs">
                        {activityFilter === 'notes'
                          ? 'No notes written yet. Write the first one above.'
                          : 'No activity yet. Write the first note above, or change the pipeline status.'}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visibleFeed.map((item) =>
                          item.kind === 'note' ? (
                            <div
                              key={`note-${item.id}`}
                              className="p-4 bg-white border border-neutral-200/70 rounded-xl space-y-2 relative group hover:border-neutral-350 transition-all shadow-3xs"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-xs font-semibold text-neutral-800 block">
                                    {item.note.author_email}
                                  </span>
                                  <span className="text-[10px] font-mono text-neutral-400">
                                    {new Date(item.note.created_at).toLocaleString()}
                                  </span>
                                </div>

                                <button
                                  onClick={() => handleDeleteNote(item.note.id)}
                                  className="p-1 hover:bg-neutral-100 text-neutral-400 hover:text-red-600 rounded-md transition-colors"
                                  title="Delete Note"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <p className="text-xs text-neutral-600 whitespace-pre-wrap leading-relaxed">
                                {item.note.content}
                              </p>
                            </div>
                          ) : (
                            <div
                              key={`status-${item.id}`}
                              className="p-4 bg-violet-50/50 border border-violet-100 rounded-xl space-y-1"
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-xs font-semibold text-violet-900">
                                  {item.log.user_email || 'System'} changed the status
                                </span>
                                <span className="text-[10px] font-mono text-neutral-400 shrink-0 ml-2">
                                  {new Date(item.log.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-violet-700 font-mono">
                                {(item.log.details?.old_status) || 'Unknown'} → {(item.log.details?.new_status) || 'Unknown'}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </motion.div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-white border border-neutral-200 rounded-xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
              Delete Application Entirely?
            </h3>
            <p className="text-neutral-500 text-xs leading-relaxed">
              This action is permanent and irreversible. It will completely delete{' '}
              <span className="font-semibold text-neutral-800">{startup.company_name || 'this application'}</span>,
              associated reviewer notes, and storage records from the CRM.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 border border-neutral-200 text-neutral-600 hover:bg-neutral-50 rounded-lg text-xs font-semibold transition-colors"
                id="btn-cancel-delete"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStartup}
                disabled={isDeleting}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-neutral-300 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                id="btn-confirm-delete"
              >
                {isDeleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                Confirm Permanent Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

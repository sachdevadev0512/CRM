import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, ExternalLink, MapPin, User, Mail, Trash2, Send, RefreshCw, Phone } from 'lucide-react';
import { Startup, Note, PipelineStatus, AuditLog, Admin } from '../../shared/src/types';
import { apiClient } from './apiClient';
import { safeHref } from '../../shared/src/securityUtils';
import { getCurrencySymbol, formatAmount } from '../../shared/src/currency';
import { formatDateTime } from '../../shared/src/dateTime';

interface StartupDetailProps {
  startup: Startup;
  onClose: () => void;
  onUpdateStatus: (status: PipelineStatus) => void;
  onDelete: () => void;
  currentUser: { id: string; email: string };
  // Bumped by the parent whenever a note/status change is made from outside this
  // drawer (e.g. the status-note popup) so the activity feed knows to refetch.
  activityRefreshKey?: number;
  // Full admin roster, for the "assigned analyst" dropdown -- any admin (including the
  // current one) can be assigned. Fetched/owned by the parent, same as elsewhere in the app.
  adminsList: Admin[];
  onAssignAdmin: (adminId: string | null) => void;
}

// Groups the Overview tab by which of the public form's 6 steps actually collects each
// field (see FormPortal.tsx STEPS[] and the STRING/NUMBER/BOOLEAN/URL_FIELDS allow-lists in
// publicForm.ts) -- so an admin can see at a glance exactly where a value came from, instead
// of guessing. Fields the current form never writes (funding_raised, team_size,
// team_background, the free-text description/traction blobs) are called out separately
// under "Legacy Fields" rather than mixed in as if they were live step data.
function StepSectionHeader({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-100 pb-1.5">
      <span className="shrink-0 px-1.5 py-0.5 bg-neutral-900 text-white text-[9px] font-bold rounded font-mono tracking-wider">
        STEP {step}
      </span>
      <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono">
        {title}
      </h3>
    </div>
  );
}

export default function StartupDetail({
  startup,
  onClose,
  onUpdateStatus,
  onDelete,
  currentUser,
  activityRefreshKey,
  adminsList,
  onAssignAdmin,
}: StartupDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'notes'>('overview');
  const [activityFilter, setActivityFilter] = useState<'all' | 'notes'>('all');
  const [notes, setNotes] = useState<Note[]>([]);
  const [statusHistory, setStatusHistory] = useState<AuditLog[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);

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

  // The pitch deck is a plain link the applicant pastes in (Step 6 of the multi-step form), not
  // an uploaded file -- there is no Supabase Storage bucket wired up anywhere in this app to
  // download from (`pitch_deck_path` is always empty). This just opens that link directly.
  // noopener,noreferrer prevents the opened tab from reaching back via window.opener.
  const handleOpenPitchDeck = () => {
    if (!startup.pitch_deck_link) {
      alert('No pitch deck link is available for this application.');
      return;
    }
    window.open(safeHref(startup.pitch_deck_link), '_blank', 'noopener,noreferrer');
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

  // The applicant picks a currency (INR/USD/EUR) once on the public form, and every amount
  // field on their application -- funding ask, valuation, previous round, revenue, burn -- is
  // in that currency. Rendering a different symbol here would silently misrepresent the actual
  // amount (a $5,000 ask displayed as "₹5,000" is off by ~85x), so this must always follow the
  // row's own `currency`, never a fixed symbol.
  const currencySymbol = getCurrencySymbol(startup.currency);
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
            <h2 className="text-xl font-semibold text-neutral-900 tracking-tight flex items-center gap-2 mt-0.5 min-w-0">
              <span className="break-words">
                {startup.company_name || <span className="text-neutral-400 italic font-normal">Company name not yet provided</span>}
              </span>
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
            {!isDraft && startup.pitch_deck_link && (
              <button
                onClick={handleOpenPitchDeck}
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-medium text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors shadow-xs"
                id="btn-open-pitch-deck"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Pitch Deck
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

        {/* Analyst assignment -- any admin (including yourself) can own reviewing this
            application. Writes immediately on change, mirroring the "Analyst" column
            dropdown in the Deal Table (same handler on the parent). */}
        <div className="px-6 py-3 border-b border-neutral-100 flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Analyst:</span>
          <select
            value={startup.assigned_admin_id || ''}
            onChange={(e) => onAssignAdmin(e.target.value || null)}
            className="px-3 py-1.5 bg-white border border-neutral-200 hover:border-neutral-900 text-xs font-semibold rounded-lg outline-none cursor-pointer text-neutral-800"
            id="assigned-admin-select-drawer"
            title="Assign an admin to analyze this application"
          >
            <option value="">Unassigned</option>
            {adminsList.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.email}{admin.id === currentUser.id ? ' (You)' : ''}
              </option>
            ))}
          </select>
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
              {/* STEP 1 -- About You (the submitter, who may not be the founder -- e.g. an
                  investment banker or mentor applying on the startup's behalf). */}
              {(startup.submitter_name || startup.submitter_email) && (
                <div className="space-y-3">
                  <StepSectionHeader step={1} title="About You" />
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

              {/* STEP 2 -- Startup Basics. company_name/website are already shown in the drawer
                  header, so they aren't repeated here. */}
              <div className="space-y-3">
                <StepSectionHeader step={2} title="Startup Basics" />
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
                <p className="font-medium text-neutral-900 text-base leading-relaxed break-words">
                  {startup.one_line_pitch || <span className="text-neutral-400 italic font-normal">One-liner not yet provided</span>}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex gap-2 items-center text-xs text-neutral-600 bg-neutral-50 border border-neutral-200/40 px-3 py-2 rounded-lg">
                    <User className="h-4 w-4 text-neutral-400 shrink-0" />
                    <div>
                      <p className="font-medium text-neutral-900">{startup.founder_name || '—'}</p>
                      <p className="text-[10px] text-neutral-400">Primary Founder</p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center text-xs text-neutral-600 bg-neutral-50 border border-neutral-200/40 px-3 py-2 rounded-lg">
                    <Phone className="h-4 w-4 text-neutral-400 shrink-0" />
                    <div>
                      <p className="font-medium text-neutral-900">{startup.founder_phone || '—'}</p>
                      <p className="text-[10px] text-neutral-400">Founder Phone</p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center text-xs text-neutral-600 bg-neutral-50 border border-neutral-200/40 px-3 py-2 rounded-lg min-w-0">
                    <Mail className="h-4 w-4 text-neutral-400 shrink-0" />
                    <div className="min-w-0">
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
                    <div className="flex gap-2 items-center text-xs text-neutral-600 bg-neutral-50 border border-neutral-200/40 px-3 py-2 rounded-lg sm:col-span-2">
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
              </div>

              {/* STEP 3 -- Stage & Funding. "Revenue Status" (shown separately here in an earlier
                  version of this drawer) is intentionally not repeated -- it's just a server-side
                  mirror of the Stage value right below (see publicForm.ts), so showing both next
                  to each other was a pure duplicate. */}
              <div className="space-y-3">
                <StepSectionHeader step={3} title="Stage & Funding" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-neutral-200/60 rounded-xl p-4 bg-neutral-50/30">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">
                      TARGET RAISE
                    </span>
                    <span className="text-base font-semibold text-neutral-900 font-mono break-words">
                      {currencySymbol}{formatAmount(startup.target_raise, startup.currency)}
                    </span>
                  </div>
                  <div className="space-y-1 min-w-0 border-t sm:border-t-0 sm:border-l border-neutral-150 pt-3 sm:pt-0 sm:pl-4">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">
                      STAGE
                    </span>
                    <span className="text-base font-semibold text-neutral-900 break-words">
                      {startup.stage || '—'}
                    </span>
                  </div>
                  {startup.current_valuation != null && (
                    <div className="space-y-1 min-w-0 border-t sm:border-t-0 sm:border-l border-neutral-150 pt-3 sm:pt-0 sm:pl-4">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">
                        CURRENT VALUATION
                      </span>
                      <span className="text-base font-semibold text-neutral-900 font-mono break-words">
                        {currencySymbol}{formatAmount(startup.current_valuation, startup.currency)}
                      </span>
                    </div>
                  )}
                </div>

                {startup.raised_before && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-neutral-200/60 rounded-xl p-4 bg-neutral-50/30">
                    <div className="space-y-1 min-w-0">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">PREVIOUS ROUND RAISED</span>
                      <span className="text-base font-semibold text-neutral-900 font-mono break-words">
                        {startup.previous_round_amount != null ? `${currencySymbol}${formatAmount(startup.previous_round_amount, startup.currency)}` : '—'}
                      </span>
                    </div>
                    <div className="space-y-1 min-w-0 border-t sm:border-t-0 sm:border-l border-neutral-150 pt-3 sm:pt-0 sm:pl-4">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">PREVIOUS ROUND VALUATION</span>
                      <span className="text-base font-semibold text-neutral-900 font-mono break-words">
                        {startup.previous_round_valuation != null ? `${currencySymbol}${formatAmount(startup.previous_round_valuation, startup.currency)}` : '—'}
                      </span>
                    </div>
                    <div className="space-y-1 min-w-0 border-t sm:border-t-0 sm:border-l border-neutral-150 pt-3 sm:pt-0 sm:pl-4">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">MONTH & YEAR</span>
                      <span className="text-base font-semibold text-neutral-900 break-words">{startup.previous_round_date || '—'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 4 -- The Business. Legacy rows (pre-multi-step form) that only have the old
                  free-text `description` blob instead are shown under Legacy Fields below. */}
              {(startup.problem_statement || startup.proposed_solution || startup.target_audience || startup.revenue_model) && (
                <div className="space-y-4">
                  <StepSectionHeader step={4} title="The Business" />
                  {startup.problem_statement && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Problem Statement</span>
                      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap break-words bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg">{startup.problem_statement}</p>
                    </div>
                  )}
                  {startup.proposed_solution && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Proposed Solution</span>
                      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap break-words bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg">{startup.proposed_solution}</p>
                    </div>
                  )}
                  {startup.target_audience && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Target Audience</span>
                      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap break-words bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg">{startup.target_audience}</p>
                    </div>
                  )}
                  {startup.revenue_model && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Revenue Model</span>
                      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap break-words bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg">{startup.revenue_model}</p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5 -- Traction & Financials. A legacy row with only the old free-text
                  `traction` blob (no structured fields) is shown under Legacy Fields instead. */}
              {(startup.current_customers != null || startup.monthly_burn != null ||
                startup.revenue_fy_2425 != null || startup.revenue_fy_2526 != null || startup.revenue_fy_2627 != null) && (
                <div className="space-y-2">
                  <StepSectionHeader step={5} title="Traction & Financials" />
                  <div className="border border-neutral-200/60 rounded-xl p-4 bg-neutral-50/30 space-y-3">
                    {/* Customers/burn are short values -- 2 columns is plenty of room */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1 min-w-0">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">CUSTOMERS</span>
                        <span className="text-base font-semibold text-neutral-900 font-mono break-words">{startup.current_customers ?? '—'}</span>
                      </div>
                      <div className="space-y-1 min-w-0">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">BURN / MO</span>
                        <span className="text-base font-semibold text-neutral-900 font-mono break-words">
                          {startup.monthly_burn != null ? `${currencySymbol}${formatAmount(startup.monthly_burn, startup.currency)}` : '—'}
                        </span>
                      </div>
                    </div>
                    {/* FY revenue values can run long (crore-scale INR amounts) -- these get their
                        own row of only 3 columns, plus break-words, so a long number wraps onto a
                        second line inside its own cell instead of visually bleeding into the next
                        column (grid cells don't wrap unbroken text like a bare number on their own). */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-neutral-150">
                      <div className="space-y-1 min-w-0">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">FY 24–25</span>
                        <span className="text-base font-semibold text-neutral-900 font-mono break-words">
                          {startup.revenue_fy_2425 != null ? `${currencySymbol}${formatAmount(startup.revenue_fy_2425, startup.currency)}` : '—'}
                        </span>
                      </div>
                      <div className="space-y-1 min-w-0 sm:border-l border-neutral-150 sm:pl-4">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">FY 25–26</span>
                        <span className="text-base font-semibold text-neutral-900 font-mono break-words">
                          {startup.revenue_fy_2526 != null ? `${currencySymbol}${formatAmount(startup.revenue_fy_2526, startup.currency)}` : '—'}
                        </span>
                      </div>
                      <div className="space-y-1 min-w-0 sm:border-l border-neutral-150 sm:pl-4">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">FY 26–27</span>
                        <span className="text-base font-semibold text-neutral-900 font-mono break-words">
                          {startup.revenue_fy_2627 != null ? `${currencySymbol}${formatAmount(startup.revenue_fy_2627, startup.currency)}` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6 -- Pitch Deck & Declaration */}
              {(startup.pitch_deck_link || startup.demo_video || startup.declaration_accepted) && (
                <div className="space-y-3">
                  <StepSectionHeader step={6} title="Pitch Deck & Declaration" />
                  <div className="flex flex-wrap items-center gap-2">
                    {startup.pitch_deck_link && (
                      <a
                        href={safeHref(startup.pitch_deck_link)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-neutral-700 hover:text-neutral-900 font-medium border border-neutral-200 hover:border-neutral-300 px-4 py-2 bg-white hover:bg-neutral-50 rounded-lg shadow-2xs"
                      >
                        Open Pitch Deck
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {startup.demo_video && (
                      <a
                        href={safeHref(startup.demo_video)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-neutral-700 hover:text-neutral-900 font-medium border border-neutral-200 hover:border-neutral-300 px-4 py-2 bg-white hover:bg-neutral-50 rounded-lg shadow-2xs"
                      >
                        {startup.pitch_deck_link ? 'Open Additional Material' : 'Watch Product Demo'}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <span
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${
                        startup.declaration_accepted
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-400'
                      }`}
                    >
                      {startup.declaration_accepted ? '✓ Declaration Accepted' : 'Declaration Not Confirmed'}
                    </span>
                  </div>
                </div>
              )}

              {/* Legacy Fields -- everything below predates the current 6-step form and is never
                  written by it (see the STRING/NUMBER/BOOLEAN/URL_FIELDS allow-lists in
                  publicForm.ts). Only rendered when a legacy row actually has one of these set,
                  so any application submitted through the current form never shows this at all. */}
              {(startup.funding_raised > 0 || startup.team_size != null || startup.team_background ||
                (!startup.problem_statement && startup.description) ||
                (!(startup.current_customers != null || startup.monthly_burn != null ||
                    startup.revenue_fy_2425 != null || startup.revenue_fy_2526 != null || startup.revenue_fy_2627 != null) && startup.traction)) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-neutral-100 pb-1.5">
                    <span className="shrink-0 px-1.5 py-0.5 bg-neutral-200 text-neutral-500 text-[9px] font-bold rounded font-mono tracking-wider">
                      LEGACY
                    </span>
                    <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest font-mono">
                      Additional Info (Not Collected By Current Form)
                    </h3>
                  </div>

                  {startup.funding_raised > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Prior Capital Raised</span>
                      <p className="text-neutral-900 text-sm font-semibold font-mono">{currencySymbol}{formatAmount(startup.funding_raised, startup.currency)}</p>
                    </div>
                  )}

                  {startup.team_size != null && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Team Size</span>
                      <p className="text-neutral-900 text-sm font-semibold">{startup.team_size} FTE</p>
                    </div>
                  )}

                  {startup.team_background && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Team Background & Pedigree</span>
                      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap break-words bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg">{startup.team_background}</p>
                    </div>
                  )}

                  {!startup.problem_statement && startup.description && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Description</span>
                      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap break-words bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg">{startup.description}</p>
                    </div>
                  )}

                  {!(startup.current_customers != null || startup.monthly_burn != null ||
                    startup.revenue_fy_2425 != null || startup.revenue_fy_2526 != null || startup.revenue_fy_2627 != null) && startup.traction && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Traction</span>
                      <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-wrap break-words bg-neutral-50 border border-neutral-200/40 p-3 rounded-lg">{startup.traction}</p>
                    </div>
                  )}
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
                                    {formatDateTime(item.note.created_at)}
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
                              <p className="text-xs text-neutral-600 whitespace-pre-wrap break-words leading-relaxed">
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
                                  {formatDateTime(item.log.created_at)}
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

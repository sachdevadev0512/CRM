import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase,
  Layers,
  Search,
  Filter,
  FileSpreadsheet,
  History,
  TrendingUp,
  MapPin,
  Clock,
  LogOut,
  Mail,
  ShieldCheck,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  FolderOpen,
  Eye,
  Trash2,
  ListFilter,
  ShieldAlert,
  Key,
  UserPlus,
  Users,
  Download,
  Calendar,
  X,
  Send,
  Ban
} from 'lucide-react';
import { Startup, AuditLog, PipelineStatus, Admin, AdminInvite } from '../../shared/src/types';
import { apiClient } from './apiClient';
import StartupDetail from './StartupDetail';
import AcceptAdminInvite from './AcceptAdminInvite';

interface BusinessAuditEntry {
  id: string;
  created_at: string;
  eventType: 'Application Submitted' | 'Status Changed' | 'Note Added' | 'Startup Updated' | 'Startup Deleted' | 'Administrator Created' | 'Administrator Revoked' | 'Administrator Invited' | 'Administrator Invite Cancelled' | 'Administrator Invite Resent' | 'CSV Export Generated';
  category: 'public' | 'crm';
  target: string;
  targetDetails?: string;
  performedBy: string;
}

const normalizeAuditLogs = (logs: AuditLog[]): BusinessAuditEntry[] => {
  const result: BusinessAuditEntry[] = [];
  
  for (const log of logs) {
    if (!log.action) continue;
    const act = log.action.toLowerCase();
    const details = log.details || {};
    
    // 1. Application Submitted
    if (act.includes('application submitted') || act.includes('founder submission') || act.includes('applied')) {
      result.push({
        id: log.id,
        created_at: log.created_at,
        eventType: 'Application Submitted',
        category: 'public',
        target: log.target_name || 'Startup',
        performedBy: ''
      });
      continue;
    }
    
    // 2. Status Changed
    if (act.includes('status changed') || act.includes('status updated') || act.includes('pipeline status')) {
      const oldStatus = details.old_status || 'Unknown';
      const newStatus = details.new_status || 'Unknown';
      result.push({
        id: log.id,
        created_at: log.created_at,
        eventType: 'Status Changed',
        category: 'crm',
        target: log.target_name || 'Startup',
        targetDetails: `${oldStatus} → ${newStatus}`,
        performedBy: log.user_email || 'System'
      });
      continue;
    }
    
    // 3. Note Added
    if (act.includes('reviewer note changes') || act.includes('note added') || act.includes('reviewer note')) {
      const msg = (details.message || '').toLowerCase();
      // Only include active "Note Added" (ignore "Deleted reviewer note.")
      if (!msg.includes('delete') && !msg.includes('remove')) {
        result.push({
          id: log.id,
          created_at: log.created_at,
          eventType: 'Note Added',
          category: 'crm',
          target: log.target_name || 'Startup',
          performedBy: log.user_email || 'System'
        });
      }
      continue;
    }
    
    // 4. Startup Deleted
    if (act.includes('delete') || act.includes('remove startup') || act.includes('startup deleted')) {
      result.push({
        id: log.id,
        created_at: log.created_at,
        eventType: 'Startup Deleted',
        category: 'crm',
        target: log.target_name || 'Startup',
        performedBy: log.user_email || 'System'
      });
      continue;
    }
    
    // 5. Startup Updated
    if (act.includes('update') || act.includes('edit startup') || act.includes('startup details updated')) {
      result.push({
        id: log.id,
        created_at: log.created_at,
        eventType: 'Startup Updated',
        category: 'crm',
        target: log.target_name || 'Startup',
        performedBy: log.user_email || 'System'
      });
      continue;
    }
    
    // 6. Administrator Created
    if (act.includes('admin account created') || act.includes('administrator created') || act.includes('add admin') || act.includes('admin added')) {
      result.push({
        id: log.id,
        created_at: log.created_at,
        eventType: 'Administrator Created',
        category: 'crm',
        target: log.target_name || details.email || 'New Administrator',
        performedBy: log.user_email || 'System'
      });
      continue;
    }
    
    // 7. Administrator Revoked
    if (act.includes('administrator revoked') || act.includes('admin revoked') || act.includes('delete admin') || act.includes('revoke admin')) {
      result.push({
        id: log.id,
        created_at: log.created_at,
        eventType: 'Administrator Revoked',
        category: 'crm',
        target: log.target_name || details.email || 'Revoked Administrator',
        performedBy: log.user_email || 'System'
      });
      continue;
    }

    // 7a. Administrator Invited / Cancelled / Resent
    if (act.includes('administrator invite cancelled') || act.includes('admin invite cancelled')) {
      result.push({
        id: log.id,
        created_at: log.created_at,
        eventType: 'Administrator Invite Cancelled',
        category: 'crm',
        target: log.target_name || details.email || 'Invited Administrator',
        performedBy: log.user_email || 'System'
      });
      continue;
    }

    if (act.includes('administrator invite resent') || act.includes('admin invite resent')) {
      result.push({
        id: log.id,
        created_at: log.created_at,
        eventType: 'Administrator Invite Resent',
        category: 'crm',
        target: log.target_name || details.email || 'Invited Administrator',
        performedBy: log.user_email || 'System'
      });
      continue;
    }

    if (act.includes('administrator invited') || act.includes('admin invited')) {
      result.push({
        id: log.id,
        created_at: log.created_at,
        eventType: 'Administrator Invited',
        category: 'crm',
        target: log.target_name || details.email || 'Invited Administrator',
        performedBy: log.user_email || 'System'
      });
      continue;
    }

    // 8. CSV Export Generated
    if (act.includes('csv export') || act.includes('export')) {
      const count = details.record_count || details.count || 0;
      const type = details.export_type || details.type || 'All';
      result.push({
        id: log.id,
        created_at: log.created_at,
        eventType: 'CSV Export Generated',
        category: 'crm',
        target: `${count} Startups`,
        targetDetails: type,
        performedBy: log.user_email || 'System'
      });
      continue;
    }
  }
  
  return result;
};

export default function AdminCRM() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; isAdmin: boolean } | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccessMessage, setAuthSuccessMessage] = useState('');
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);

  // CRM Data States
  const [startups, setStartups] = useState<Startup[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [adminsList, setAdminsList] = useState<Admin[]>([]);
  const [adminInvites, setAdminInvites] = useState<AdminInvite[]>([]);
  const [loadingCRMData, setLoadingCRMData] = useState(false);
  const [crmError, setCrmError] = useState('');

  // Admin Management form states
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminActionError, setAdminActionError] = useState('');
  const [adminActionSuccess, setAdminActionSuccess] = useState('');
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [inviteRowActionId, setInviteRowActionId] = useState<string | null>(null);

  // Optional "add a note about this status change" popup, shown after any status
  // change (Pipeline Board quick-move dropdown or the applicant drawer's selector).
  const [statusNotePrompt, setStatusNotePrompt] = useState<{ startupId: string; companyName: string | null; oldStatus: PipelineStatus | 'In Progress'; newStatus: PipelineStatus } | null>(null);
  const [statusNoteText, setStatusNoteText] = useState('');
  const [isSavingStatusNote, setIsSavingStatusNote] = useState(false);
  // Bumped whenever a note is saved from outside the currently-open StartupDetail
  // drawer (i.e. via this status-note popup), so that drawer knows to refetch --
  // it has no other way of learning about a mutation made outside its own tree.
  const [activityRefreshTick, setActivityRefreshTick] = useState(0);

  // UI Navigation states
  const [activeTab, setActiveTab] = useState<'pipeline' | 'table' | 'drafts' | 'logs' | 'admins'>('pipeline');
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);

  // Row selection and export states
  const [selectedStartupIds, setSelectedStartupIds] = useState<string[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Logs Search & Filter states
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logSelectedType, setLogSelectedType] = useState('All');
  const [logSelectedOperator, setLogSelectedOperator] = useState('All');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [auditLogCategoryFilter, setAuditLogCategoryFilter] = useState<'public' | 'crm'>('public');

  // Pagination states
  const [startupCurrentPage, setStartupCurrentPage] = useState(1);
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const startupsPerPage = 10;
  const logsPerPage = 20;

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('All');
  const [selectedStage, setSelectedStage] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'raise' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setStartupCurrentPage(1);
  }, [searchTerm, selectedSector, selectedStage]);

  useEffect(() => {
    setLogCurrentPage(1);
  }, [logSearchTerm, logSelectedType, logSelectedOperator, logStartDate, logEndDate]);

  // Group Header Helper (Today, Yesterday, Earlier)
  const getGroupForDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const isSameDay = (d1: Date, d2: Date) =>
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();

      if (isSameDay(d, today)) return 'Today';
      if (isSameDay(d, yesterday)) return 'Yesterday';
    } catch (e) {
      // Fallback
    }
    return 'Earlier';
  };

  // Date Formatter Helper (DD MMM YYYY, HH:mm IST)
  const formatToIST = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const formatter = new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
      });
      const parts = formatter.formatToParts(d);
      const day = parts.find(p => p.type === 'day')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const year = parts.find(p => p.type === 'year')?.value || '';
      const hour = parts.find(p => p.type === 'hour')?.value || '';
      const minute = parts.find(p => p.type === 'minute')?.value || '';
      return `${day} ${month} ${year}, ${hour}:${minute} IST`;
    } catch (e) {
      return dateStr;
    }
  };

  // Business Log Styling Helper
  const getBusinessLogStyle = (eventType: string) => {
    switch (eventType) {
      case 'Application Submitted':
        return {
          icon: <FolderOpen className="h-3 w-3 text-indigo-600" />,
          bgColor: 'bg-indigo-50 border-indigo-100 text-indigo-800'
        };
      case 'Status Changed':
        return {
          icon: <Layers className="h-3 w-3 text-violet-600" />,
          bgColor: 'bg-violet-50 border-violet-100 text-violet-800'
        };
      case 'Note Added':
        return {
          icon: <Clock className="h-3 w-3 text-amber-600" />,
          bgColor: 'bg-amber-50 border-amber-100 text-amber-800'
        };
      case 'Startup Updated':
        return {
          icon: <RefreshCw className="h-3 w-3 text-blue-600" />,
          bgColor: 'bg-blue-50 border-blue-100 text-blue-800'
        };
      case 'Startup Deleted':
        return {
          icon: <Trash2 className="h-3 w-3 text-red-600" />,
          bgColor: 'bg-red-50 border-red-100 text-red-800'
        };
      case 'Administrator Created':
        return {
          icon: <UserPlus className="h-3 w-3 text-emerald-600" />,
          bgColor: 'bg-emerald-50 border-emerald-100 text-emerald-800'
        };
      case 'Administrator Revoked':
        return {
          icon: <Lock className="h-3 w-3 text-rose-600" />,
          bgColor: 'bg-rose-50 border-rose-100 text-rose-800'
        };
      case 'Administrator Invited':
        return {
          icon: <Send className="h-3 w-3 text-sky-600" />,
          bgColor: 'bg-sky-50 border-sky-100 text-sky-800'
        };
      case 'Administrator Invite Resent':
        return {
          icon: <RefreshCw className="h-3 w-3 text-sky-600" />,
          bgColor: 'bg-sky-50 border-sky-100 text-sky-800'
        };
      case 'Administrator Invite Cancelled':
        return {
          icon: <Ban className="h-3 w-3 text-neutral-500" />,
          bgColor: 'bg-neutral-50 border-neutral-200 text-neutral-700'
        };
      case 'CSV Export Generated':
        return {
          icon: <FileSpreadsheet className="h-3 w-3 text-teal-600" />,
          bgColor: 'bg-teal-50 border-teal-100 text-teal-800'
        };
      default:
        return {
          icon: <History className="h-3 w-3 text-neutral-500" />,
          bgColor: 'bg-neutral-50 border-neutral-200 text-neutral-700'
        };
    }
  };

  // Row selection helpers
  const toggleStartupSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStartupIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleAllVisibleStartups = () => {
    const visibleIds = paginatedStartups.map(s => s.id);
    const allSelected = visibleIds.every(id => selectedStartupIds.includes(id));

    if (allSelected) {
      setSelectedStartupIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedStartupIds(prev => {
        const newIds = [...prev];
        visibleIds.forEach(id => {
          if (!newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    }
  };

  // Generate and download CSV
  const generateCSV = (startupsToExport: Startup[], fileName: string) => {
    setIsExporting(true);
    try {
      const headers = [
        'Company Name',
        'Website',
        'One Line Pitch',
        'Description',
        'HQ Location',
        'Sector',
        'Founder Name',
        'Founder Email',
        'Founder LinkedIn',
        'Team Size',
        'Team Pedigree',
        'Stage',
        'Currency',
        'Revenue Status',
        'Revenue Generated in Financial Year 2024–25',
        'Revenue Generated During Current Financial Year',
        'Funding Raised',
        'Target Raise',
        'Traction / Metrics',
        'Pipeline Status',
        'Applied Date'
      ];

      const rows = startupsToExport.map(s => [
        s.company_name,
        s.website,
        s.one_line_pitch,
        s.description,
        s.hq_location,
        s.sector,
        s.founder_name,
        s.founder_email,
        s.founder_linkedin,
        s.team_size,
        s.team_background,
        s.stage,
        s.currency || 'INR',
        s.revenue_status || 'Pre-Revenue',
        s.revenue_generated_fy25 || '',
        s.current_financial_year_revenue || '',
        s.funding_raised,
        s.target_raise,
        s.traction,
        s.status,
        new Date(s.created_at).toISOString().split('T')[0]
      ]);

       const csvContent = [
        headers.join(','),
        ...rows.map(row =>
          row
            .map(val => {
              let str = val === undefined || val === null ? '' : String(val);
              
              // Neutralize formula/CSV injection (CWE-1236) by prepending a single quote
              if (/^[=\+\-@\t\r]/.test(str)) {
                str = "'" + str;
              }

              if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            })
            .join(',')
        )
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (currentUser) {
        apiClient.logCSVExport({
          type: fileName.startsWith('filtered') ? 'Filtered' : fileName.startsWith('selected') ? 'Selected' : 'All',
          count: startupsToExport.length
        }).then(() => {
          apiClient.getAuditLogs().then(setAuditLogs).catch(console.error);
        }).catch((auditErr) => {
          console.error('Audit log failed:', auditErr);
          setAdminActionError(`CSV Exported, but audit log failed: ${auditErr.message || auditErr}`);
          setTimeout(() => setAdminActionError(''), 7000);
        });
      }

      setAdminActionSuccess(`Successfully exported ${startupsToExport.length} startup records to CSV.`);
      setTimeout(() => setAdminActionSuccess(''), 5000);
      setIsExportModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setAdminActionError(`CSV Export failed: ${err.message || err}`);
      setTimeout(() => setAdminActionError(''), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkActiveSession();
  }, []);

  useEffect(() => {
    if (!isInitializingAuth) {
      const isLoginPath = location.pathname === '/login';
      const isAcceptInvitePath = location.pathname === '/accept-invite';
      const isAuthAdmin = currentUser && currentUser.isAdmin;

      if (!isAuthAdmin && !isLoginPath && !isAcceptInvitePath) {
        navigate('/login', { replace: true });
      } else if (isAuthAdmin && isLoginPath) {
        navigate('/', { replace: true });
      }
    }
  }, [isInitializingAuth, currentUser, location.pathname, navigate]);

  const checkActiveSession = async () => {
    setIsInitializingAuth(true);
    setAuthError('');
    try {
      const user = await apiClient.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        if (user.isAdmin) {
          fetchCRMData();
        }
      } else {
        setCurrentUser(null);
      }
    } catch (e: any) {
      console.error('Session restoration failed:', e);
      setAuthError(e.message || 'Failed to check active session.');
    } finally {
      setIsInitializingAuth(false);
    }
  };

  const fetchCRMData = async () => {
    setLoadingCRMData(true);
    setCrmError('');
    try {
      const [startupsList, logs, admins, invites] = await Promise.all([
        apiClient.getStartups(),
        apiClient.getAuditLogs(),
        apiClient.getAdmins(),
        apiClient.getAdminInvites()
      ]);
      setStartups(startupsList);
      setAuditLogs(logs);
      setAdminsList(admins);
      setAdminInvites(invites);
    } catch (err: any) {
      console.error(err);
      setCrmError(err.message || 'Failed to load database. Verify Supabase tables and RLS.');
    } finally {
      setLoadingCRMData(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMessage('');
    if (!authEmail.trim() || !authPassword.trim()) return;

    setAuthLoading(true);
    try {
      // Sign In Flow (Standard Email + Password login)
      const res = await apiClient.signIn(authEmail.trim(), authPassword.trim());
      if (res.success && res.user) {
        setCurrentUser(res.user);
        if (res.user.isAdmin) {
          await fetchCRMData();
        }
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await apiClient.signOut();
    setCurrentUser(null);
    setAuthEmail('');
    setAuthPassword('');
    setStartups([]);
    setAuditLogs([]);
    setAdminsList([]);
    setAdminInvites([]);
    setSelectedStartup(null);
  };

  // Entry point for BOTH the Pipeline Board's quick-move dropdown and the applicant
  // drawer's status selector: neither applies the change directly anymore. Selecting a
  // new status only opens the confirmation modal below -- nothing is written until the
  // admin explicitly confirms. Because the <select>s stay bound to the unchanged
  // startup/`s.status` value, cancelling snaps them right back with no extra code.
  const handleStatusChangeRequest = (id: string, newStatus: PipelineStatus) => {
    const targetStartup = startups.find(s => s.id === id);
    if (!targetStartup || targetStartup.status === newStatus) return;
    setStatusNoteText('');
    setStatusNotePrompt({ startupId: id, companyName: targetStartup.company_name, oldStatus: targetStartup.status, newStatus });
  };

  // Returns whether the status change actually persisted, so handleConfirmStatusChange
  // (the only caller) can avoid saving a note or closing the modal as if it succeeded
  // when the underlying write actually failed and was rolled back.
  const handleUpdateStatus = async (id: string, status: PipelineStatus): Promise<boolean> => {
    if (!currentUser) return false;

    // Save previous state for potential rollback
    const previousStartups = [...startups];
    const previousSelectedStartup = selectedStartup ? { ...selectedStartup } : null;

    // 1. Apply optimistic local state update immediately
    setStartups(prev =>
      prev.map(s => (s.id === id ? { ...s, status, updated_at: new Date().toISOString() } : s))
    );
    if (selectedStartup && selectedStartup.id === id) {
      setSelectedStartup(prev => (prev ? { ...prev, status } : null));
    }

    try {
      const success = await apiClient.updateStartupStatus(id, status);
      if (!success) {
        // Rollback if service fails to update
        setStartups(previousStartups);
        setSelectedStartup(previousSelectedStartup);
        alert('Failed to update status on the server. Change reverted.');
        return false;
      }
      return true;
    } catch (err: any) {
      console.error(err);
      // Rollback on network/RLS exception
      setStartups(previousStartups);
      setSelectedStartup(previousSelectedStartup);
      alert('Failed to update status: ' + err.message);
      return false;
    }
  };

  // Modal confirm: actually applies the pending status change (and the optional note,
  // if one was written) together. Nothing was written to the database before this point.
  const handleConfirmStatusChange = async () => {
    if (!statusNotePrompt || !currentUser) return;
    const { startupId, newStatus } = statusNotePrompt;
    const noteToSave = statusNoteText.trim();

    setIsSavingStatusNote(true);
    try {
      const statusUpdated = await handleUpdateStatus(startupId, newStatus);
      if (!statusUpdated) {
        // handleUpdateStatus already alerted the specific failure reason and rolled
        // back its own optimistic state -- stop here so we don't save a note describing
        // a status change that didn't actually happen, and don't close the modal as if
        // the confirm succeeded.
        return;
      }
      if (noteToSave) {
        await apiClient.addNote(startupId, noteToSave);
      }
      const logs = await apiClient.getAuditLogs();
      setAuditLogs(logs);
      setActivityRefreshTick(t => t + 1);
      setStatusNotePrompt(null);
      setStatusNoteText('');
    } catch (err: any) {
      console.error('Failed to confirm status change:', err);
      alert('Failed to update status: ' + (err.message || err));
    } finally {
      setIsSavingStatusNote(false);
    }
  };

  // Cancel: the status was never written, so there's nothing to roll back -- the
  // <select> reverts on its own since it's still bound to the unchanged value.
  const handleCancelStatusChange = () => {
    setStatusNotePrompt(null);
    setStatusNoteText('');
  };

  // Admin Management actions
  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminActionError('');
    setAdminActionSuccess('');
    if (!newAdminEmail.trim()) return;

    setAdminActionLoading(true);
    try {
      const success = await apiClient.inviteAdmin(newAdminEmail.trim());
      if (success) {
        setAdminActionSuccess(`Invitation sent to ${newAdminEmail}. They'll gain admin access once they set their password.`);
        setNewAdminEmail('');
        // Refresh crm data (which loads admins, invites and logs)
        await fetchCRMData();
      }
    } catch (err: any) {
      console.error(err);
      setAdminActionError(err.message || 'Failed to send administrator invitation.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleCancelInvite = async (inviteId: string, email: string) => {
    if (!confirm(`Cancel the pending invitation for ${email}? They will no longer be able to activate this account.`)) {
      return;
    }
    setAdminActionError('');
    setAdminActionSuccess('');
    setInviteRowActionId(inviteId);
    try {
      const success = await apiClient.cancelAdminInvite(inviteId);
      if (success) {
        setAdminActionSuccess(`Cancelled the pending invitation for ${email}.`);
        await fetchCRMData();
      }
    } catch (err: any) {
      console.error(err);
      setAdminActionError(err.message || 'Failed to cancel invitation.');
    } finally {
      setInviteRowActionId(null);
    }
  };

  const handleResendInvite = async (inviteId: string, email: string) => {
    setAdminActionError('');
    setAdminActionSuccess('');
    setInviteRowActionId(inviteId);
    try {
      const success = await apiClient.resendAdminInvite(inviteId);
      if (success) {
        setAdminActionSuccess(`Resent the invitation to ${email}.`);
        await fetchCRMData();
      }
    } catch (err: any) {
      console.error(err);
      setAdminActionError(err.message || 'Failed to resend invitation.');
    } finally {
      setInviteRowActionId(null);
    }
  };

  const handleDeleteAdmin = async (adminId: string, adminEmail: string) => {
    if (adminId === currentUser?.id) {
      alert('Security Protection: You cannot revoke your own administrator privileges while active.');
      return;
    }

    if (!confirm(`Are you absolutely sure you want to revoke Admin rights for ${adminEmail}? This user will instantly lose CRM access.`)) {
      return;
    }

    setAdminActionError('');
    setAdminActionSuccess('');
    try {
      const success = await apiClient.deleteAdmin(adminId, adminEmail);
      if (success) {
        setAdminActionSuccess(`Successfully revoked Admin privileges for ${adminEmail}.`);
        await fetchCRMData();
      }
    } catch (err: any) {
      console.error(err);
      setAdminActionError(err.message || 'Failed to delete admin.');
    }
  };



  // Pipeline Board structure
  const pipelineStatuses: PipelineStatus[] = [
    'New',
    'Screening',
    'Meeting',
    'Due Diligence',
    'Approved',
    'Rejected',
    'Archived',
  ];

  // Applications the applicant hasn't finished submitting yet never enter the reviewer
  // pipeline/table -- they live only in the separate Drafts tab.
  const reviewableStartups = startups.filter(s => s.status !== 'In Progress');
  const draftStartups = startups.filter(s => s.status === 'In Progress');

  // Filtering Logic
  const filteredStartups = reviewableStartups.filter(s => {
    const matchesSearch =
      (s.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.one_line_pitch || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.founder_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.hq_location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.sector || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSector = selectedSector === 'All' || s.sector === selectedSector;
    const matchesStage = selectedStage === 'All' || s.stage === selectedStage;

    return matchesSearch && matchesSector && matchesStage;
  });

  // Drafts tab: same search box, no sector/stage filters (many of those fields may not be
  // filled in yet on an in-progress application).
  const filteredDraftStartups = draftStartups.filter(s =>
    (s.company_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.submitter_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.submitter_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.founder_email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const sortedDraftStartups = [...filteredDraftStartups].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  // Sorting Logic
  const sortedStartups = [...filteredStartups].sort((a, b) => {
    let valueA: any = a.created_at;
    let valueB: any = b.created_at;

    if (sortBy === 'name') {
      valueA = (a.company_name || '').toLowerCase();
      valueB = (b.company_name || '').toLowerCase();
    } else if (sortBy === 'raise') {
      valueA = a.target_raise;
      valueB = b.target_raise;
    }

    if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
    if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginated Startups for Table View
  const startupStartIndex = (startupCurrentPage - 1) * startupsPerPage;
  const paginatedStartups = sortedStartups.slice(startupStartIndex, startupStartIndex + startupsPerPage);
  const totalStartupPages = Math.ceil(sortedStartups.length / startupsPerPage);

  // 1. Normalize all logs to the clean business-focused model
  const normalizedLogs = useMemo(() => {
    return normalizeAuditLogs(auditLogs);
  }, [auditLogs]);

  // 2. Operators list dynamically filtered based on active tab
  const availableOperators = useMemo(() => {
    const ops = normalizedLogs
      .filter(log => log.category === auditLogCategoryFilter && log.performedBy)
      .map(log => log.performedBy);
    return ['All', ...Array.from(new Set(ops))];
  }, [normalizedLogs, auditLogCategoryFilter]);

  // 3. Event Types list dynamically populated based on active tab
  const logEventTypes = useMemo(() => {
    if (auditLogCategoryFilter === 'public') {
      return ['All', 'Application Submitted'];
    } else {
      return [
        'All',
        'Status Changed',
        'Note Added',
        'Startup Updated',
        'Startup Deleted',
        'Administrator Created',
        'Administrator Revoked',
        'Administrator Invited',
        'Administrator Invite Resent',
        'Administrator Invite Cancelled',
        'CSV Export Generated'
      ];
    }
  }, [auditLogCategoryFilter]);

  // 4. Filtered Audit Logs
  const filteredLogs = useMemo(() => {
    return normalizedLogs.filter(log => {
      // a. Category Filter (Public vs CRM)
      if (log.category !== auditLogCategoryFilter) return false;

      // b. Search term
      if (logSearchTerm) {
        const term = logSearchTerm.toLowerCase();
        const eventMatch = log.eventType.toLowerCase().includes(term);
        const targetMatch = log.target.toLowerCase().includes(term);
        const detailMatch = log.targetDetails?.toLowerCase().includes(term) || false;
        const operatorMatch = log.performedBy.toLowerCase().includes(term);
        if (!eventMatch && !targetMatch && !detailMatch && !operatorMatch) {
          return false;
        }
      }

      // c. Event Type
      if (logSelectedType !== 'All') {
        if (log.eventType !== logSelectedType) return false;
      }

      // d. Operator
      if (logSelectedOperator !== 'All') {
        if (log.performedBy !== logSelectedOperator) return false;
      }

      // e. Date Range
      if (logStartDate) {
        const start = new Date(logStartDate);
        start.setHours(0, 0, 0, 0);
        const logDate = new Date(log.created_at);
        if (logDate < start) return false;
      }
      if (logEndDate) {
        const end = new Date(logEndDate);
        end.setHours(23, 59, 59, 999);
        const logDate = new Date(log.created_at);
        if (logDate > end) return false;
      }

      return true;
    });
  }, [normalizedLogs, auditLogCategoryFilter, logSearchTerm, logSelectedType, logSelectedOperator, logStartDate, logEndDate]);

  // Paginated Audit Logs
  const logStartIndex = (logCurrentPage - 1) * logsPerPage;
  const paginatedLogs = filteredLogs.slice(logStartIndex, logStartIndex + logsPerPage);
  const totalLogPages = Math.ceil(filteredLogs.length / logsPerPage);

  // Unique list of sectors and stages for filter buttons (drafts are excluded -- many haven't
  // reached the step that fills these in yet, and they aren't part of the reviewer pipeline).
  const availableSectors = ['All', ...Array.from(new Set(reviewableStartups.map(s => s.sector).filter((s): s is string => !!s)))];
  const availableStages = ['All', ...Array.from(new Set(reviewableStartups.map(s => s.stage).filter((s): s is string => !!s)))];

  const toggleSort = (field: 'name' | 'raise' | 'date') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Auth checking state screen
  if (isInitializingAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
        <span className="text-xs text-neutral-400 font-mono">Verifying administrative session...</span>
      </div>
    );
  }

  // Accept-invite is reachable regardless of admin status: the invitee has a valid
  // Supabase Auth session (from following the invite email's link) but isn't in
  // public.admins yet — that's exactly what this screen finalizes.
  if (location.pathname === '/accept-invite') {
    return <AcceptAdminInvite />;
  }

  const isLoginPath = location.pathname === '/login';
  const isAuthAdmin = currentUser && currentUser.isAdmin;

  if (!currentUser || !currentUser.isAdmin) {
    if (isLoginPath) {
      if (!currentUser) {
        // 1. Unauthenticated Login Gate
        return (
          <div className="flex flex-col items-center justify-center min-h-[80vh] px-4" id="admin-login-screen">
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl p-8 shadow-xs space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-900 text-white">
                  <Lock className="h-5 w-5" />
                </div>
                <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
                  Middha Ventures Admin CRM
                </h1>
                <p className="text-neutral-500 text-xs">
                  Secure credential gateway for authorized investment team members.
                </p>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccessMessage && (
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex items-start gap-2 text-neutral-600 text-xs">
                  <ShieldCheck className="h-4 w-4 text-neutral-800 shrink-0 mt-0.5" />
                  <span>{authSuccessMessage}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div className="space-y-1.5" id="login_email_input">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="email">
                    Business Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="email"
                      id="email"
                      placeholder="partner@middhaventures.com"
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5" id="login_password_input">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                    <input
                      type="password"
                      id="password"
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 disabled:bg-neutral-400 text-white font-semibold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  id="btn-login-submit"
                >
                  {authLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                  Sign In to CRM
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            </motion.div>
          </div>
        );
      } else {
        // 2. Authenticated but Unauthorized State (Not in public.admins)
        return (
          <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center" id="unauthorized-screen">
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm space-y-6"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-red-650 tracking-tight">
                  Access Denied
                </h1>
                <p className="text-neutral-500 text-xs leading-relaxed">
                  Your account <span className="font-semibold text-neutral-800 font-mono">{currentUser.email}</span> does not have administrative privileges to access this portal.
                </p>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Please contact a system administrator to request access.
                </p>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  onClick={handleSignOut}
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 text-white font-semibold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  id="btn-unauth-logout"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out & Switch Account
                </button>
              </div>
            </motion.div>
          </div>
        );
      }
    } else {
      // Not on login path and unauthorized -> wait for redirect effect
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
          <span className="text-xs text-neutral-400 font-mono">Redirecting to secure gateway...</span>
        </div>
      );
    }
  }

  // 3. Fully Authorized Admin CRM Screen
  return (
    <div className="space-y-6" id="admin-crm-dashboard">

      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-neutral-200 rounded-xl p-6 shadow-3xs">
        <div className="space-y-1">
          <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase font-mono">
            INTERNAL CRM PORTAL
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Middha Ventures Dealroom
          </h1>
          <p className="text-xs text-neutral-500">
            Authenticated: <span className="font-semibold font-mono text-neutral-700">{currentUser.email}</span> (Admin)
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchCRMData}
            disabled={loadingCRMData}
            className="p-2 border border-neutral-200 hover:bg-neutral-50 disabled:bg-neutral-100 rounded-lg text-neutral-600 transition-colors"
            title="Refresh database"
            id="btn-refresh-crm"
          >
            <RefreshCw className={`h-4 w-4 ${loadingCRMData ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSignOut}
            className="px-3 py-2 border border-neutral-200 hover:bg-neutral-50 hover:text-red-600 text-neutral-600 font-semibold text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            id="btn-crm-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>

      {/* Database sync error alert */}
      {crmError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800">Database Connection Error</p>
            <p className="mt-0.5">{crmError}</p>
            <p className="mt-2 text-[10px] opacity-80 font-mono">
              Have you run the database migrations in Supabase SQL editor? See '/supabase/migrations/01_init.sql' inside our codebase.
            </p>
          </div>
        </div>
      )}

      {/* Merged Navigation and Filtering Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-3xs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 bg-neutral-50 border border-neutral-200 p-1 rounded-lg text-xs w-full lg:w-auto shrink-0">
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'pipeline' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
              id="tab-pipeline-board"
            >
              <Layers className="h-3.5 w-3.5" />
              Pipeline Board
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'table' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
              id="tab-deal-table"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Deal Table
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'drafts' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
              id="tab-drafts"
            >
              <Clock className="h-3.5 w-3.5" />
              Drafts
              {draftStartups.length > 0 && (
                <span className="px-1.5 py-0.5 bg-neutral-200 text-[9px] font-bold rounded-full text-neutral-600 font-mono">
                  {draftStartups.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'logs' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
              id="tab-audit-logs"
            >
              <History className="h-3.5 w-3.5" />
              Audit Logs
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'admins' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
              }`}
              id="tab-admin-management"
            >
              <Users className="h-3.5 w-3.5" />
              Admin Management
            </button>
          </div>

          {/* Filtering options - Only shown for Pipeline, Table & Drafts */}
          {(activeTab === 'pipeline' || activeTab === 'table' || activeTab === 'drafts') && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 w-full lg:w-auto lg:flex lg:items-center">
              {/* Search bar */}
              <div className="relative lg:w-64">
                <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'drafts' ? 'Search drafts...' : 'Search deals...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none h-8"
                  id="crm-search-input"
                />
              </div>

              {/* Sector & Stage filters + Export don't apply to an in-progress draft */}
              {activeTab !== 'drafts' && (
                <>
              {/* Sector filter */}
              <div className="flex items-center gap-2 lg:w-44 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 h-8">
                <Filter className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                <select
                  value={selectedSector}
                  onChange={e => setSelectedSector(e.target.value)}
                  className="w-full bg-transparent text-xs text-neutral-700 outline-none cursor-pointer py-0.5"
                >
                  <option value="All">All Sectors</option>
                  {availableSectors.filter(s => s !== 'All').map(sec => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              {/* Stage filter */}
              <div className="flex items-center gap-2 lg:w-44 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 h-8">
                <ListFilter className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                <select
                  value={selectedStage}
                  onChange={e => setSelectedStage(e.target.value)}
                  className="w-full bg-transparent text-xs text-neutral-700 outline-none cursor-pointer py-0.5"
                >
                  <option value="All">All Stages</option>
                  {availableStages.filter(s => s !== 'All').map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Export CSV Button */}
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 h-8 bg-neutral-900 hover:bg-neutral-850 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shrink-0 shadow-3xs"
                id="btn-export-csv"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CORE VIEWPORT BOX */}
      <div id="crm-viewport">
        {loadingCRMData ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white border border-neutral-200 rounded-xl">
            <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
            <span className="text-xs text-neutral-400 font-mono">Synchronizing database tables...</span>
          </div>
        ) : activeTab === 'pipeline' ? (
          /* PIPELINE BOARD VIEW */
          <div className="flex gap-4 overflow-x-auto pb-4" id="pipeline-board">
            {pipelineStatuses.map(status => {
              const columnStartups = sortedStartups.filter(s => s.status === status);
              return (
                <div
                  key={status}
                  className="bg-neutral-50 border border-neutral-200/60 rounded-xl p-3 min-w-[260px] shrink-0 max-h-[80vh] flex flex-col overflow-hidden"
                >
                  {/* Column Header (Sticky) */}
                  <div className="sticky top-0 bg-neutral-50 z-10 flex justify-between items-center px-1 border-b border-neutral-200 pb-2 shrink-0">
                    <span className="text-xs font-bold text-neutral-800 tracking-tight">{status}</span>
                    <span className="px-1.5 py-0.5 bg-neutral-200 text-[10px] font-bold rounded-full text-neutral-600 font-mono">
                      {columnStartups.length}
                    </span>
                  </div>

                  {/* Cards container */}
                  <div className="space-y-2 overflow-y-auto flex-1 pr-0.5 pt-2">
                    {columnStartups.length === 0 ? (
                      <div className="text-center py-8 text-[10px] border border-dashed border-neutral-200 rounded-lg text-neutral-400">
                        No deals
                      </div>
                    ) : (
                      columnStartups.map(s => {
                        const showPitch = s.one_line_pitch &&
                          s.one_line_pitch.trim() !== '' &&
                          s.one_line_pitch.toLowerCase().trim() !== (s.company_name || '').toLowerCase().trim();

                        return (
                          <div
                            key={s.id}
                            onClick={() => setSelectedStartup(s)}
                            className="bg-white border border-neutral-200 hover:border-neutral-900 hover:shadow-2xs p-3 rounded-lg cursor-pointer transition-all space-y-2 text-xs group relative text-left"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-semibold text-neutral-900 group-hover:underline line-clamp-1">
                                {s.company_name}
                              </span>
                            </div>
                            
                            {showPitch && (
                              <p className="text-neutral-500 text-[10px] leading-snug line-clamp-2">
                                {s.one_line_pitch}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <span className="px-2 py-0.5 bg-neutral-100 text-[9px] font-medium text-neutral-600 rounded">
                                {s.stage}
                              </span>
                              <span className="px-2 py-0.5 bg-neutral-100 text-[9px] font-medium text-neutral-600 rounded truncate max-w-[100px]">
                                {s.hq_location}
                              </span>
                            </div>

                            <div className="pt-2 border-t border-neutral-100 flex justify-between items-center text-[9px] font-mono text-neutral-400">
                              <span>Raise: ₹{(s.target_raise || 0).toLocaleString()}</span>
                            </div>

                            {/* Fast Move dropdown on hover */}
                            <div
                              onClick={e => e.stopPropagation()}
                              className="absolute right-2 bottom-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <select
                                value={s.status}
                                onChange={e => handleStatusChangeRequest(s.id, e.target.value as PipelineStatus)}
                                className="px-1 py-0.5 bg-neutral-50 border border-neutral-200 text-[9px] font-semibold text-neutral-600 rounded outline-none cursor-pointer"
                                title="Move Status"
                              >
                                {pipelineStatuses.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeTab === 'table' ? (
          /* DEAL TABLE VIEW */
          <div className="border border-neutral-200 bg-white rounded-xl overflow-hidden shadow-3xs" id="deal-table">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-250 text-neutral-500 font-semibold uppercase tracking-wider font-mono">
                    <th className="px-4 py-3 text-center w-10" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={paginatedStartups.length > 0 && paginatedStartups.every(s => selectedStartupIds.includes(s.id))}
                        onChange={toggleAllVisibleStartups}
                        className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer h-3.5 w-3.5"
                      />
                    </th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-neutral-100" onClick={() => toggleSort('name')}>
                      Company Name {sortBy === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3">Sector</th>
                    <th className="px-6 py-3">Location</th>
                    <th className="px-6 py-3">Stage</th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-neutral-100" onClick={() => toggleSort('raise')}>
                      Target Raise {sortBy === 'raise' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-neutral-100" onClick={() => toggleSort('date')}>
                      Applied On {sortBy === 'date' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-150">
                  {sortedStartups.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-neutral-400 font-mono">
                        No database records matched your active search and filter presets.
                      </td>
                    </tr>
                  ) : (
                    paginatedStartups.map(s => (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedStartup(s)}
                        className={`hover:bg-neutral-50/50 cursor-pointer group text-left ${selectedStartupIds.includes(s.id) ? 'bg-neutral-50/20' : ''}`}
                      >
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedStartupIds.includes(s.id)}
                            onChange={(e) => toggleStartupSelection(s.id, e as any)}
                            className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer h-3.5 w-3.5"
                          />
                        </td>
                        <td className="px-6 py-3 font-semibold text-neutral-900 group-hover:underline">
                          {s.company_name}
                        </td>
                        <td className="px-6 py-3 text-neutral-600">{s.sector}</td>
                        <td className="px-6 py-3 text-neutral-600">{s.hq_location}</td>
                        <td className="px-6 py-3">
                          <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded font-medium text-neutral-700">
                            {s.stage}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-mono text-neutral-900 font-semibold">
                          ₹{(s.target_raise || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              s.status === 'Approved'
                                ? 'bg-neutral-100 text-neutral-800 border border-neutral-300'
                                : s.status === 'Rejected'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : s.status === 'Archived'
                                ? 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                                : 'bg-neutral-50 text-neutral-700 border border-neutral-250'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-neutral-500 font-mono">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedStartup(s)}
                            className="p-1.5 hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 rounded-lg transition-colors inline-flex items-center gap-1 font-semibold"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalStartupPages > 1 && (
              <div className="px-6 py-4 bg-neutral-50/50 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-neutral-500">
                  Showing <span className="font-semibold text-neutral-800">{startupStartIndex + 1}</span> to{' '}
                  <span className="font-semibold text-neutral-800">
                    {Math.min(startupStartIndex + startupsPerPage, sortedStartups.length)}
                  </span>{' '}
                  of <span className="font-semibold text-neutral-800">{sortedStartups.length}</span> records
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setStartupCurrentPage(p => Math.max(1, p - 1))}
                    disabled={startupCurrentPage === 1}
                    className="px-3 py-1.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:hover:bg-transparent font-medium cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalStartupPages }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setStartupCurrentPage(pageNum)}
                      className={`px-3 py-1.5 border rounded-lg font-medium transition-all cursor-pointer ${
                        startupCurrentPage === pageNum
                          ? 'bg-neutral-900 border-neutral-900 text-white shadow-2xs'
                          : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    onClick={() => setStartupCurrentPage(p => Math.min(totalStartupPages, p + 1))}
                    disabled={startupCurrentPage === totalStartupPages}
                    className="px-3 py-1.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:hover:bg-transparent font-medium cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'drafts' ? (
          /* IN-PROGRESS DRAFTS TAB -- applicants who started but haven't finished submitting.
             Kept separate from the reviewer pipeline entirely (see reviewableStartups above). */
          <div className="border border-neutral-200 bg-white rounded-xl overflow-hidden shadow-3xs" id="drafts-table">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/20 text-left">
              <h3 className="font-semibold text-sm text-neutral-900">In-Progress Applications</h3>
              <p className="text-neutral-500 text-[11px] mt-0.5">
                Started but not yet submitted. These aren't part of the reviewer pipeline until the applicant finishes all 6 steps.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-250 text-neutral-500 font-semibold uppercase tracking-wider font-mono">
                    <th className="px-6 py-3">Company Name</th>
                    <th className="px-6 py-3">Submitted By</th>
                    <th className="px-6 py-3">Progress</th>
                    <th className="px-6 py-3">Last Updated</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-150">
                  {sortedDraftStartups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-neutral-400 font-mono">
                        No applications currently in progress.
                      </td>
                    </tr>
                  ) : (
                    sortedDraftStartups.map(s => (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedStartup(s)}
                        className="hover:bg-neutral-50/50 cursor-pointer group text-left"
                      >
                        <td className="px-6 py-3 font-semibold text-neutral-900 group-hover:underline">
                          {s.company_name || <span className="text-neutral-400 italic font-normal">Not yet provided</span>}
                        </td>
                        <td className="px-6 py-3 text-neutral-600">
                          <div>{s.submitter_name || '—'}</div>
                          <div className="text-neutral-400">{s.submitter_email || ''}</div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 bg-neutral-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-neutral-900 rounded-full"
                                style={{ width: `${Math.round((s.last_completed_step / 6) * 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-neutral-500">{s.last_completed_step}/6</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-neutral-600">{new Date(s.updated_at).toLocaleString()}</td>
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedStartup(s); }}
                            className="text-neutral-500 hover:text-neutral-900 font-semibold cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'logs' ? (
          /* AUDIT LOG RECORDS TAB */
          <div className="border border-neutral-200 bg-white rounded-xl overflow-hidden shadow-3xs" id="audit-logs text-left">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/20 text-left">
              <h3 className="font-semibold text-sm text-neutral-900">Security Audit Logs</h3>
              <p className="text-neutral-500 text-[11px] mt-0.5">
                Comprehensive, read-only sequence of key business activities, status modifications, note revisions, and CSV exports.
              </p>
            </div>

            {/* Category Filter Tabs */}
            <div className="px-6 py-3 border-b border-neutral-150 bg-neutral-50/10 flex flex-wrap items-center justify-between gap-3 text-left">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAuditLogCategoryFilter('public');
                    setLogCurrentPage(1);
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                    auditLogCategoryFilter === 'public'
                      ? 'bg-neutral-900 text-white shadow-2xs'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                  }`}
                  id="btn-log-public"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Public Applications
                </button>
                <button
                  onClick={() => {
                    setAuditLogCategoryFilter('crm');
                    setLogCurrentPage(1);
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                    auditLogCategoryFilter === 'crm'
                      ? 'bg-neutral-900 text-white shadow-2xs'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                  }`}
                  id="btn-log-crm"
                >
                  <Lock className="h-3.5 w-3.5" />
                  CRM Activity
                </button>
              </div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-bold">
                Category Segregation
              </span>
            </div>

            {/* Audit Logs Filter Bar */}
            <div className={`px-6 py-4 bg-neutral-50/30 border-b border-neutral-150 grid grid-cols-1 ${auditLogCategoryFilter === 'crm' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 text-left`}>
              {/* Search input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Search Logs</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={logSearchTerm}
                    onChange={e => setLogSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-neutral-250 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 rounded-lg outline-none h-7.5 font-sans"
                  />
                </div>
              </div>

              {/* Event Category dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Event Type</label>
                <div className="relative">
                  <Filter className="absolute left-2.5 top-2.5 h-3 w-3 text-neutral-400" />
                  <select
                    value={logSelectedType}
                    onChange={e => setLogSelectedType(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 text-xs bg-white border border-neutral-250 rounded-lg outline-none h-7.5 appearance-none cursor-pointer font-sans text-neutral-700"
                  >
                    {logEventTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Operator dropdown */}
              {auditLogCategoryFilter === 'crm' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Operator</label>
                  <div className="relative">
                    <Users className="absolute left-2.5 top-2.5 h-3 w-3 text-neutral-400" />
                    <select
                      value={logSelectedOperator}
                      onChange={e => setLogSelectedOperator(e.target.value)}
                      className="w-full pl-8 pr-2 py-1 text-xs bg-white border border-neutral-250 rounded-lg outline-none h-7.5 appearance-none cursor-pointer font-sans text-neutral-700 truncate"
                    >
                      {availableOperators.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Date Range input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Date Range</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="date"
                    value={logStartDate}
                    onChange={e => setLogStartDate(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-white border border-neutral-250 rounded-lg outline-none h-7.5 font-sans cursor-pointer text-neutral-700"
                  />
                  <span className="text-neutral-400 text-xs font-semibold">to</span>
                  <input
                    type="date"
                    value={logEndDate}
                    onChange={e => setLogEndDate(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-white border border-neutral-250 rounded-lg outline-none h-7.5 font-sans cursor-pointer text-neutral-700"
                  />
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 font-semibold text-neutral-500 uppercase tracking-wider font-mono">
                    <th className="px-6 py-3">Event</th>
                    <th className="px-6 py-3">Company/Admin Name (Target)</th>
                    <th className="px-6 py-3">Performed By</th>
                    <th className="px-6 py-3">Timestamp (IST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-150 text-neutral-600">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-16 text-neutral-400 font-sans">
                        No audit logs matched your active filter options.
                      </td>
                    </tr>
                  ) : (
                    ['Today', 'Yesterday', 'Earlier'].map(groupName => {
                      const logsInGroup = paginatedLogs.filter(log => getGroupForDate(log.created_at) === groupName);
                      if (logsInGroup.length === 0) return null;
                      return (
                        <React.Fragment key={groupName}>
                          <tr className="bg-neutral-50/50">
                            <td colSpan={4} className="px-6 py-2 text-[10px] uppercase font-bold text-neutral-400 tracking-wider font-sans border-y border-neutral-150">
                              {groupName}
                            </td>
                          </tr>
                          {logsInGroup.map(log => {
                            const style = getBusinessLogStyle(log.eventType);
                            return (
                              <tr key={log.id} className="hover:bg-neutral-50/50 text-left">
                                <td className="px-6 py-3.5 font-semibold text-neutral-900">
                                  <div className="flex items-center gap-2">
                                    <span className={`p-1 rounded border inline-flex items-center justify-center shrink-0 ${style.bgColor}`}>
                                      {style.icon}
                                    </span>
                                    <span>{log.eventType}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-3.5 font-medium text-neutral-800">
                                  <span>{log.target}</span>
                                  {log.targetDetails && (
                                    <span className="ml-1.5 text-xs text-neutral-500 font-normal">
                                      ({log.targetDetails})
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-3.5 text-neutral-600 font-medium">
                                  {log.category === 'crm' ? (log.performedBy || 'System') : '—'}
                                </td>
                                <td className="px-6 py-3.5 text-neutral-500 font-mono text-[11px] whitespace-nowrap">
                                  {formatToIST(log.created_at)}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {totalLogPages > 1 && (
              <div className="px-6 py-4 bg-neutral-50/50 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans">
                <span className="text-neutral-500">
                  Showing <span className="font-semibold text-neutral-800">{logStartIndex + 1}</span> to{' '}
                  <span className="font-semibold text-neutral-800">
                    {Math.min(logStartIndex + logsPerPage, filteredLogs.length)}
                  </span>{' '}
                  of <span className="font-semibold text-neutral-800">{filteredLogs.length}</span> entries
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLogCurrentPage(p => Math.max(1, p - 1))}
                    disabled={logCurrentPage === 1}
                    className="px-3 py-1.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:hover:bg-transparent font-semibold cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalLogPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (logCurrentPage > 3) {
                      pageNum = logCurrentPage - 3 + i;
                    }
                    if (pageNum + (5 - i - 1) > totalLogPages) {
                      pageNum = Math.max(1, totalLogPages - 4 + i);
                    }
                    if (pageNum > totalLogPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setLogCurrentPage(pageNum)}
                        className={`px-3 py-1.5 border rounded-lg font-semibold transition-all cursor-pointer ${
                          logCurrentPage === pageNum
                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-2xs'
                            : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setLogCurrentPage(p => Math.min(totalLogPages, p + 1))}
                    disabled={logCurrentPage === totalLogPages}
                    className="px-3 py-1.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:hover:bg-transparent font-semibold cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ADMIN MANAGEMENT VIEW */
          <div className="space-y-6" id="admin-management-view">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left/Middle Column: Lists of Admins and Invites */}
              <div className="lg:col-span-2 space-y-6 flex flex-col">
                {/* Active Administrators Card */}
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-3xs flex flex-col">
                  <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/20 text-left">
                    <h3 className="font-semibold text-sm text-neutral-900">Active CRM Administrators</h3>
                    <p className="text-neutral-500 text-[11px] mt-0.5">
                      Users registered below are authorized to access the deal pipeline, review notes, generate signed deck URLs, and run bulk migrations.
                    </p>
                  </div>

                  <div className="overflow-x-auto flex-1 font-sans">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider font-mono">
                          <th className="px-6 py-3 font-semibold text-neutral-500">Administrator Email</th>
                          <th className="px-6 py-3 font-semibold text-neutral-500">User UUID (Auth Ref)</th>
                          <th className="px-6 py-3 font-semibold text-neutral-500">Granted On</th>
                          <th className="px-6 py-3 font-semibold text-neutral-500 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-150">
                        {adminsList.map(admin => (
                          <tr key={admin.id} className="hover:bg-neutral-50/30 text-left">
                            <td className="px-6 py-3.5 font-semibold text-neutral-900 flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                              {admin.email}
                              {admin.id === currentUser?.id && (
                                <span className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-250 text-[9px] text-neutral-500 rounded font-bold uppercase ml-2">
                                  You
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 font-mono text-neutral-500 text-[11px]">
                              {admin.id}
                            </td>
                            <td className="px-6 py-3.5 text-neutral-500 font-mono">
                              {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : 'System'}
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <button
                                onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                                disabled={admin.id === currentUser?.id}
                                className={`p-1.5 rounded-lg border transition-colors inline-flex items-center gap-1 font-semibold ${
                                  admin.id === currentUser?.id
                                    ? 'border-neutral-150 bg-neutral-50 text-neutral-300 cursor-not-allowed'
                                    : 'border-neutral-200 hover:border-red-200 hover:bg-red-50 text-neutral-500 hover:text-red-600'
                                }`}
                                title={admin.id === currentUser?.id ? 'You cannot de-authorize your active account.' : 'Revoke admin access'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Revoke
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pending Invitations Card */}
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-3xs flex flex-col">
                  <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/20 text-left">
                    <h3 className="font-semibold text-sm text-neutral-900">Pending Invitations</h3>
                    <p className="text-neutral-500 text-[11px] mt-0.5">
                      Invitations sent by email. An invitee only gains CRM access once they click the link and set their own password.
                    </p>
                  </div>

                  <div className="overflow-x-auto flex-1 font-sans">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider font-mono">
                          <th className="px-6 py-3 font-semibold text-neutral-500">Email</th>
                          <th className="px-6 py-3 font-semibold text-neutral-500">Invited By</th>
                          <th className="px-6 py-3 font-semibold text-neutral-500">Status</th>
                          <th className="px-6 py-3 font-semibold text-neutral-500">Expires On</th>
                          <th className="px-6 py-3 font-semibold text-neutral-500 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-150">
                        {adminInvites.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-10 text-neutral-400 font-mono">
                              No invitations sent yet.
                            </td>
                          </tr>
                        ) : (
                          adminInvites.map(invite => {
                            const isPending = invite.status === 'pending';
                            const isExpired = isPending && new Date(invite.expires_at).getTime() < Date.now();
                            const rowBusy = inviteRowActionId === invite.id;
                            return (
                              <tr key={invite.id} className="hover:bg-neutral-50/30 text-left">
                                <td className="px-6 py-3.5 font-semibold text-neutral-900">
                                  {invite.email}
                                </td>
                                <td className="px-6 py-3.5 text-neutral-500">
                                  {invite.invited_by_email || 'System'}
                                </td>
                                <td className="px-6 py-3.5">
                                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${
                                    invite.status === 'accepted'
                                      ? 'bg-green-50 text-green-700 border border-green-150'
                                      : invite.status === 'revoked'
                                      ? 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                                      : isExpired
                                      ? 'bg-amber-50 text-amber-700 border border-amber-150'
                                      : 'bg-sky-50 text-sky-700 border border-sky-150'
                                  }`}>
                                    {invite.status === 'accepted' ? 'Accepted' : invite.status === 'revoked' ? 'Cancelled' : isExpired ? 'Expired' : 'Pending'}
                                  </span>
                                </td>
                                <td className="px-6 py-3.5 text-neutral-500 font-mono">
                                  {new Date(invite.expires_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-3.5 text-right">
                                  {isPending ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        onClick={() => handleResendInvite(invite.id, invite.email)}
                                        disabled={rowBusy}
                                        className="p-1.5 rounded-lg border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 text-neutral-500 hover:text-neutral-900 transition-colors inline-flex items-center gap-1 font-semibold disabled:opacity-40"
                                        title="Resend invitation"
                                      >
                                        {rowBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                        Resend
                                      </button>
                                      <button
                                        onClick={() => handleCancelInvite(invite.id, invite.email)}
                                        disabled={rowBusy}
                                        className="p-1.5 rounded-lg border border-neutral-200 hover:border-red-200 hover:bg-red-50 text-neutral-500 hover:text-red-600 transition-colors inline-flex items-center gap-1 font-semibold disabled:opacity-40"
                                        title="Cancel invitation"
                                      >
                                        <Ban className="h-3.5 w-3.5" />
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-neutral-300 text-[10px] font-mono">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Right Column: Email Invitation Form */}
              <div className="space-y-6">
                {/* Invite New Administrator Card */}
                <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-3xs space-y-4 text-left font-sans">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-neutral-900 font-semibold text-sm">
                      <UserPlus className="h-4.5 w-4.5 text-neutral-650" />
                      <span>Invite New Administrator</span>
                    </div>
                    <p className="text-neutral-500 text-[11px] leading-relaxed">
                      Send an email invitation. The invitee clicks the link, sets their own password, and is only
                      granted CRM access once they've completed that step.
                    </p>
                  </div>

                  {adminActionError && (
                    <div className="p-3 bg-red-50 border border-red-150 rounded-lg flex items-start gap-2 text-red-750 text-xs">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{adminActionError}</span>
                    </div>
                  )}

                  {adminActionSuccess && (
                    <div className="p-3 bg-green-50 border border-green-150 rounded-lg flex items-start gap-2 text-green-800 text-xs">
                      <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                      <span>{adminActionSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleInviteAdmin} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="new-admin-email">
                        Business Email Address
                      </label>
                      <input
                        type="email"
                        id="new-admin-email"
                        placeholder="colleague@middhaventures.com"
                        value={newAdminEmail}
                        onChange={e => setNewAdminEmail(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={adminActionLoading}
                      className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 disabled:bg-neutral-400 text-white font-semibold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {adminActionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send Invitation
                    </button>
                  </form>

                  <div className="p-3 bg-neutral-50 border border-neutral-200/60 rounded-lg space-y-1.5 text-[10px] text-neutral-500 leading-relaxed">
                    <div className="font-semibold text-neutral-700 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-neutral-400" />
                      <span>Security & Auditing Gated Action</span>
                    </div>
                    <span>Sending an invitation runs an atomic backend transaction that registers an unconfirmed Supabase Auth user, emails them an activation link, and logs a permanent record in the audit trail. They only appear in <b>Active CRM Administrators</b> after they accept.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DRAWER DRAWER DRAWER */}
      <AnimatePresence>
        {selectedStartup && (
          <StartupDetail
            startup={selectedStartup}
            currentUser={currentUser}
            activityRefreshKey={activityRefreshTick}
            onClose={() => setSelectedStartup(null)}
            onUpdateStatus={status => handleStatusChangeRequest(selectedStartup.id, status)}
            onDelete={() => {
              setSelectedStartup(null);
              fetchCRMData();
            }}
          />
        )}

        {isExportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl border border-neutral-250 shadow-xl max-w-md w-full overflow-hidden text-left font-sans"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-neutral-150 flex items-center justify-between bg-neutral-50/40">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-neutral-500" />
                  <h3 className="font-semibold text-sm text-neutral-900">Export Startups Database</h3>
                </div>
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-50 transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Select the dataset scope you want to compile and download as an Excel-compatible CSV file.
                </p>

                <div className="space-y-2.5">
                  {/* Option 1: All Startups */}
                  <button
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      generateCSV(reviewableStartups, `startups_${todayStr}.csv`);
                    }}
                    disabled={isExporting || reviewableStartups.length === 0}
                    className="w-full p-3.5 border border-neutral-200 hover:border-neutral-400 disabled:opacity-40 disabled:hover:border-neutral-200 rounded-lg transition-all flex items-start gap-3 text-left cursor-pointer group bg-neutral-50/30 hover:bg-white"
                  >
                    <div className="p-2 bg-neutral-100 rounded-md group-hover:bg-neutral-900 group-hover:text-white transition-colors shrink-0">
                      <Layers className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-neutral-900">All Startups</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        Download all {reviewableStartups.length} submitted startup records in the CRM database (excludes in-progress drafts).
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Filtered Startups */}
                  <button
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      generateCSV(sortedStartups, `filtered_startups_${todayStr}.csv`);
                    }}
                    disabled={isExporting || sortedStartups.length === 0}
                    className="w-full p-3.5 border border-neutral-200 hover:border-neutral-400 disabled:opacity-40 disabled:hover:border-neutral-200 rounded-lg transition-all flex items-start gap-3 text-left cursor-pointer group bg-neutral-50/30 hover:bg-white"
                  >
                    <div className="p-2 bg-neutral-100 rounded-md group-hover:bg-neutral-900 group-hover:text-white transition-colors shrink-0">
                      <Filter className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-neutral-900">Filtered Startups</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        Download the {sortedStartups.length} records matching your current search/filters.
                      </div>
                    </div>
                  </button>

                  {/* Option 3: Selected Startups */}
                  <button
                    onClick={() => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const selectedStartups = reviewableStartups.filter(s => selectedStartupIds.includes(s.id));
                      generateCSV(selectedStartups, `selected_startups_${todayStr}.csv`);
                    }}
                    disabled={isExporting || selectedStartupIds.length === 0}
                    className="w-full p-3.5 border border-neutral-200 hover:border-neutral-400 disabled:opacity-40 disabled:hover:border-neutral-200 rounded-lg transition-all flex items-start gap-3 text-left cursor-pointer group bg-neutral-50/30 hover:bg-white"
                  >
                    <div className="p-2 bg-neutral-100 rounded-md group-hover:bg-neutral-900 group-hover:text-white transition-colors shrink-0">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-neutral-900 flex items-center gap-1.5">
                        <span>Selected Startups</span>
                        {selectedStartupIds.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-neutral-900 text-white rounded-full text-[9px] font-bold">
                            {selectedStartupIds.length}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        Download only the {selectedStartupIds.length} manually selected rows.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-150 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-3.5 py-1.5 border border-neutral-200 rounded-lg hover:bg-neutral-100 text-neutral-600 font-semibold text-xs cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {statusNotePrompt && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
            onClick={handleCancelStatusChange}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md bg-white border border-neutral-200 rounded-xl shadow-xl p-6 space-y-4"
              id="status-note-prompt"
              onClick={e => e.stopPropagation()}
            >
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Confirm Status Change</h3>
                <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                  Move <span className="font-semibold text-neutral-800">{statusNotePrompt.companyName}</span> from{' '}
                  <span className="font-mono font-medium text-neutral-700">{statusNotePrompt.oldStatus}</span> to{' '}
                  <span className="font-mono font-semibold text-neutral-900">{statusNotePrompt.newStatus}</span>?
                  Cancelling leaves the status unchanged.
                </p>
              </div>
              <textarea
                rows={3}
                placeholder="Add a note about why (optional)..."
                value={statusNoteText}
                onChange={e => setStatusNoteText(e.target.value)}
                className="w-full text-xs p-2.5 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 rounded-lg outline-none resize-none"
                id="status-note-textarea"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelStatusChange}
                  disabled={isSavingStatusNote}
                  className="px-3.5 py-1.5 border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                  id="btn-cancel-status-change"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStatusChange}
                  disabled={isSavingStatusNote}
                  className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-850 disabled:bg-neutral-400 text-white font-semibold text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  id="btn-confirm-status-change"
                >
                  {isSavingStatusNote ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                  Confirm Change
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

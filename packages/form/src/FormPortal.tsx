import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Upload, CheckCircle2, AlertCircle, Building2, User, Shield, ArrowRight, ArrowLeft,
  RefreshCw, DollarSign, FileText, TrendingUp, ChevronDown, Search,
} from 'lucide-react';
import { apiClient } from './apiClient';
import { isValidHttpUrl, validateLinkedInUrl } from '../../shared/src/securityUtils';
import { getCurrencySymbol } from '../../shared/src/currency';
import { formatDateTime } from '../../shared/src/dateTime';
import { ApplicationStepData } from '../../shared/src/types';

const DRAFT_STORAGE_KEY = 'mv_application_draft';

const emptyFormFields = {
  // Step 1: About You
  referral_source: '',
  submitter_role: '',
  submitter_name: '',
  submitter_phone_code: 'IN', // ISO 3166-1 alpha-2 (not the dial string -- see dialForIso2)
  submitter_phone: '',
  submitter_email: '',

  // Step 2: Startup Basics
  company_name: '',
  founder_name: '',
  founder_phone_code: 'IN',
  founder_phone: '',
  founder_email: '',
  registration_type: 'India',
  india_city: '',
  outside_location: '',
  website: '',
  company_linkedin: '',
  founder_linkedin: '',
  sector: '',
  sector_other: '',
  one_line_pitch: '',

  // Step 3: Stage & Funding
  stage: '',
  target_raise: '',
  currency: 'INR',
  raised_before: '',
  previous_round_amount: '',
  previous_round_valuation: '',
  previous_round_date: '',
  current_valuation: '',

  // Step 4: The Business
  problem_statement: '',
  proposed_solution: '',
  target_audience: '',
  revenue_model: '',

  // Step 5: Traction & Financials
  current_customers: '',
  monthly_burn: '',
  revenue_fy_2425: '',
  revenue_fy_2526: '',
  revenue_fy_2627: '',

  // Step 6: Pitch Deck & Declaration
  pitch_deck_link: '',
  demo_video: '', // "Additional Material" link
  declaration_accepted: false,
};

type FormFields = typeof emptyFormFields;

const STEPS = [
  { title: 'About You', description: "A little about who's submitting this — helps us route your application to the right partner.", icon: User },
  { title: 'Startup Basics', description: "Tell us what you're building and where to find you.", icon: Building2 },
  { title: 'Stage & Funding', description: "Where you are, and what you're raising.", icon: DollarSign },
  { title: 'The Business', description: 'The problem, your solution, who it’s for, and how you make money.', icon: FileText },
  { title: 'Traction & Financials', description: 'The numbers that tell us how the business is actually running.', icon: TrendingUp },
  { title: 'Pitch Deck & Declaration', description: "Last step. Share your deck and confirm the details above are accurate.", icon: Upload },
];

// Was a whitespace-split word count, which reads as "broken" the moment the input isn't
// space-separated prose -- e.g. a pasted block of run-on text with no spaces counts as a single
// "word" no matter how long it actually is, so the on-screen counter stays stuck at 1 while the
// field visibly fills up. Counting characters instead always reflects exactly what was typed.
function countChars(text: string): number {
  return text.length;
}

// Converts an ISO 3166-1 alpha-2 code to its flag emoji via Unicode regional indicator symbols
// (e.g. "IN" -> 🇮 + 🇳 -> 🇮🇳), so the country list below only needs to carry the code, not a
// hand-picked emoji per entry.
function isoToFlagEmoji(iso2: string): string {
  return [...iso2.toUpperCase()].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
}

// Dial codes for phone country-code selectors. Applicants can be founders, bankers, mentors, etc.
// based anywhere, so the phone fields aren't India-only -- India is listed first as the default
// (Middha Ventures' home market), the rest are alphabetical by country name.
const COUNTRY_CODES: { name: string; iso2: string; dial: string }[] = [
  { name: 'India', iso2: 'IN', dial: '+91' },
  { name: 'Afghanistan', iso2: 'AF', dial: '+93' },
  { name: 'Albania', iso2: 'AL', dial: '+355' },
  { name: 'Algeria', iso2: 'DZ', dial: '+213' },
  { name: 'Argentina', iso2: 'AR', dial: '+54' },
  { name: 'Armenia', iso2: 'AM', dial: '+374' },
  { name: 'Australia', iso2: 'AU', dial: '+61' },
  { name: 'Austria', iso2: 'AT', dial: '+43' },
  { name: 'Azerbaijan', iso2: 'AZ', dial: '+994' },
  { name: 'Bahrain', iso2: 'BH', dial: '+973' },
  { name: 'Bangladesh', iso2: 'BD', dial: '+880' },
  { name: 'Belarus', iso2: 'BY', dial: '+375' },
  { name: 'Belgium', iso2: 'BE', dial: '+32' },
  { name: 'Bhutan', iso2: 'BT', dial: '+975' },
  { name: 'Bolivia', iso2: 'BO', dial: '+591' },
  { name: 'Bosnia and Herzegovina', iso2: 'BA', dial: '+387' },
  { name: 'Brazil', iso2: 'BR', dial: '+55' },
  { name: 'Brunei', iso2: 'BN', dial: '+673' },
  { name: 'Bulgaria', iso2: 'BG', dial: '+359' },
  { name: 'Cambodia', iso2: 'KH', dial: '+855' },
  { name: 'Cameroon', iso2: 'CM', dial: '+237' },
  { name: 'Canada', iso2: 'CA', dial: '+1' },
  { name: 'Chile', iso2: 'CL', dial: '+56' },
  { name: 'China', iso2: 'CN', dial: '+86' },
  { name: 'Colombia', iso2: 'CO', dial: '+57' },
  { name: 'Costa Rica', iso2: 'CR', dial: '+506' },
  { name: 'Croatia', iso2: 'HR', dial: '+385' },
  { name: 'Cyprus', iso2: 'CY', dial: '+357' },
  { name: 'Czech Republic', iso2: 'CZ', dial: '+420' },
  { name: 'Denmark', iso2: 'DK', dial: '+45' },
  { name: 'Ecuador', iso2: 'EC', dial: '+593' },
  { name: 'Egypt', iso2: 'EG', dial: '+20' },
  { name: 'Estonia', iso2: 'EE', dial: '+372' },
  { name: 'Ethiopia', iso2: 'ET', dial: '+251' },
  { name: 'Finland', iso2: 'FI', dial: '+358' },
  { name: 'France', iso2: 'FR', dial: '+33' },
  { name: 'Georgia', iso2: 'GE', dial: '+995' },
  { name: 'Germany', iso2: 'DE', dial: '+49' },
  { name: 'Ghana', iso2: 'GH', dial: '+233' },
  { name: 'Greece', iso2: 'GR', dial: '+30' },
  { name: 'Hong Kong', iso2: 'HK', dial: '+852' },
  { name: 'Hungary', iso2: 'HU', dial: '+36' },
  { name: 'Iceland', iso2: 'IS', dial: '+354' },
  { name: 'Indonesia', iso2: 'ID', dial: '+62' },
  { name: 'Iran', iso2: 'IR', dial: '+98' },
  { name: 'Iraq', iso2: 'IQ', dial: '+964' },
  { name: 'Ireland', iso2: 'IE', dial: '+353' },
  { name: 'Israel', iso2: 'IL', dial: '+972' },
  { name: 'Italy', iso2: 'IT', dial: '+39' },
  { name: 'Japan', iso2: 'JP', dial: '+81' },
  { name: 'Jordan', iso2: 'JO', dial: '+962' },
  { name: 'Kazakhstan', iso2: 'KZ', dial: '+7' },
  { name: 'Kenya', iso2: 'KE', dial: '+254' },
  { name: 'Kuwait', iso2: 'KW', dial: '+965' },
  { name: 'Kyrgyzstan', iso2: 'KG', dial: '+996' },
  { name: 'Laos', iso2: 'LA', dial: '+856' },
  { name: 'Latvia', iso2: 'LV', dial: '+371' },
  { name: 'Lebanon', iso2: 'LB', dial: '+961' },
  { name: 'Lithuania', iso2: 'LT', dial: '+370' },
  { name: 'Luxembourg', iso2: 'LU', dial: '+352' },
  { name: 'Macau', iso2: 'MO', dial: '+853' },
  { name: 'Malaysia', iso2: 'MY', dial: '+60' },
  { name: 'Maldives', iso2: 'MV', dial: '+960' },
  { name: 'Malta', iso2: 'MT', dial: '+356' },
  { name: 'Mauritius', iso2: 'MU', dial: '+230' },
  { name: 'Mexico', iso2: 'MX', dial: '+52' },
  { name: 'Moldova', iso2: 'MD', dial: '+373' },
  { name: 'Mongolia', iso2: 'MN', dial: '+976' },
  { name: 'Morocco', iso2: 'MA', dial: '+212' },
  { name: 'Myanmar', iso2: 'MM', dial: '+95' },
  { name: 'Nepal', iso2: 'NP', dial: '+977' },
  { name: 'Netherlands', iso2: 'NL', dial: '+31' },
  { name: 'New Zealand', iso2: 'NZ', dial: '+64' },
  { name: 'Nigeria', iso2: 'NG', dial: '+234' },
  { name: 'Norway', iso2: 'NO', dial: '+47' },
  { name: 'Oman', iso2: 'OM', dial: '+968' },
  { name: 'Pakistan', iso2: 'PK', dial: '+92' },
  { name: 'Panama', iso2: 'PA', dial: '+507' },
  { name: 'Peru', iso2: 'PE', dial: '+51' },
  { name: 'Philippines', iso2: 'PH', dial: '+63' },
  { name: 'Poland', iso2: 'PL', dial: '+48' },
  { name: 'Portugal', iso2: 'PT', dial: '+351' },
  { name: 'Qatar', iso2: 'QA', dial: '+974' },
  { name: 'Romania', iso2: 'RO', dial: '+40' },
  { name: 'Russia', iso2: 'RU', dial: '+7' },
  { name: 'Rwanda', iso2: 'RW', dial: '+250' },
  { name: 'Saudi Arabia', iso2: 'SA', dial: '+966' },
  { name: 'Serbia', iso2: 'RS', dial: '+381' },
  { name: 'Singapore', iso2: 'SG', dial: '+65' },
  { name: 'Slovakia', iso2: 'SK', dial: '+421' },
  { name: 'Slovenia', iso2: 'SI', dial: '+386' },
  { name: 'South Africa', iso2: 'ZA', dial: '+27' },
  { name: 'South Korea', iso2: 'KR', dial: '+82' },
  { name: 'Spain', iso2: 'ES', dial: '+34' },
  { name: 'Sri Lanka', iso2: 'LK', dial: '+94' },
  { name: 'Sweden', iso2: 'SE', dial: '+46' },
  { name: 'Switzerland', iso2: 'CH', dial: '+41' },
  { name: 'Taiwan', iso2: 'TW', dial: '+886' },
  { name: 'Tanzania', iso2: 'TZ', dial: '+255' },
  { name: 'Thailand', iso2: 'TH', dial: '+66' },
  { name: 'Turkey', iso2: 'TR', dial: '+90' },
  { name: 'Uganda', iso2: 'UG', dial: '+256' },
  { name: 'Ukraine', iso2: 'UA', dial: '+380' },
  { name: 'United Arab Emirates', iso2: 'AE', dial: '+971' },
  { name: 'United Kingdom', iso2: 'GB', dial: '+44' },
  { name: 'United States', iso2: 'US', dial: '+1' },
  { name: 'Uruguay', iso2: 'UY', dial: '+598' },
  { name: 'Uzbekistan', iso2: 'UZ', dial: '+998' },
  { name: 'Vietnam', iso2: 'VN', dial: '+84' },
  { name: 'Yemen', iso2: 'YE', dial: '+967' },
];

// Phone country-code state is keyed by ISO2 (unique per country), not the dial string directly --
// several countries legitimately share a dial code (Canada/United States both "+1", Kazakhstan/
// Russia both "+7"), and a <select>'s <option value> must be unique per option or the browser
// resolves a shared value to whichever matching option comes first in DOM order, silently
// snapping the visible selection to the wrong country after every re-render. The dial string
// itself is only ever resolved right when it's needed (validating or combining into the stored
// phone string).
function dialForIso2(iso2: string): string {
  return COUNTRY_CODES.find((c) => c.iso2 === iso2)?.dial || '+91';
}

// Searchable phone country-code picker. Defined at module scope (not inside FormPortal) on
// purpose -- a component defined inside another component's body gets a fresh function identity
// on every parent re-render, which React treats as an entirely new component type and remounts,
// wiping out this component's own open/search state (and dropping keyboard focus) after every
// single keystroke anywhere else in the form. Keeping it top-level avoids that.
function CountryCodeDropdown({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (iso2: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = COUNTRY_CODES.find((c) => c.iso2 === value) || COUNTRY_CODES[0];
  const query = search.trim().toLowerCase();
  const filtered = query === ''
    ? COUNTRY_CODES
    : COUNTRY_CODES.filter((c) =>
        c.name.toLowerCase().includes(query) ||
        c.dial.includes(query.startsWith('+') ? query : `+${query}`) ||
        c.iso2.toLowerCase() === query
      );

  const close = () => {
    setIsOpen(false);
    setSearch('');
    setHighlighted(0);
  };

  const open = () => {
    setIsOpen(true);
    setHighlighted(0);
    // Focus happens after the dropdown (and its input) actually mounts.
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[highlighted];
      if (pick) {
        onChange(pick.iso2);
        close();
      }
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id={id}
        onClick={() => (isOpen ? close() : open())}
        className="h-full min-h-[38px] px-2.5 py-2 text-sm bg-neutral-50 border border-neutral-200 hover:border-neutral-300 focus:border-neutral-900 rounded-lg transition-colors outline-none cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
      >
        <span className="text-base leading-none">{isoToFlagEmoji(selected.iso2)}</span>
        <span className="text-neutral-700 font-medium">{selected.dial}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 mt-1.5 w-72 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-neutral-100 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search country or code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlighted(0);
              }}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-8 pr-2 py-1.5 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 rounded-lg transition-colors outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-xs text-neutral-400 text-center">No matching country or code.</div>
            ) : (
              filtered.map((c, i) => (
                <button
                  type="button"
                  key={c.iso2}
                  onClick={() => {
                    onChange(c.iso2);
                    close();
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                    i === highlighted ? 'bg-neutral-100' : ''
                  } ${c.iso2 === selected.iso2 ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}
                >
                  <span className="text-base leading-none shrink-0">{isoToFlagEmoji(c.iso2)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-neutral-400 text-xs font-mono shrink-0">{c.dial}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Guards against an out-of-range step index ever reaching `STEPS[currentStep]` -- both
// localStorage (a stale entry from a previous app version, or hand-edited devtools storage) and
// the OTP-resume response are external, untrusted-ish inputs that could in principle carry a
// `currentStep`/`last_completed_step` value outside [0, STEPS.length - 1]. Without this, indexing
// `STEPS` with it throws and crashes the whole form to a blank page with no recovery.
function clampStep(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(Math.trunc(n), 0), STEPS.length - 1);
}

function loadDraftFromStorage(): { id: string; draftToken: string; currentStep: number; formFields: Partial<FormFields> } | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.id || !parsed.draftToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraftToStorage(id: string, draftToken: string, currentStep: number, formFields: FormFields) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ id, draftToken, currentStep, formFields }));
  } catch {
    // localStorage unavailable (private browsing, etc.) -- resume just won't work, no need to surface an error
  }
}

function clearDraftStorage() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {}
}

export default function FormPortal() {
  const [formFields, setFormFields] = useState<FormFields>(emptyFormFields);
  const [currentStep, setCurrentStep] = useState(0);
  const [applicationId, setApplicationId] = useState('');
  const [draftToken, setDraftToken] = useState('');

  const [citySearchInput, setCitySearchInput] = useState('');
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  const indianCities = [
    'Bengaluru', 'Mumbai', 'Delhi', 'Gurgaon', 'Noida', 'Hyderabad', 'Pune', 'Chennai',
    'Kolkata', 'Ahmedabad', 'Jaipur', 'Indore', 'Chandigarh', 'Coimbatore', 'Kochi',
    'Lucknow', 'Nagpur', 'Surat', 'Visakhapatnam', 'Bhubaneswar', 'Dehradun', 'Vadodara',
    'Thiruvananthapuram', 'Ranchi', 'Patna', 'Guwahati', 'Nashik', 'Aurangabad'
  ];

  const filteredCities = citySearchInput.trim() === ''
    ? indianCities
    : indianCities.filter(c => c.toLowerCase().includes(citySearchInput.toLowerCase()));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [submittedId, setSubmittedId] = useState('');
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);

  // Set when step 1's save is rejected because this email already has an application on file --
  // 'existingDraft' auto-opens the resume panel below (see handleAdvance); 'alreadySubmitted'
  // just explains why and lets them edit the email and try again.
  const [step1Block, setStep1Block] = useState<{ type: 'existingDraft' | 'alreadySubmitted'; email: string } | null>(null);

  // Resume-by-email-OTP panel state (independent of the same-browser localStorage resume, which
  // still works automatically -- this is the "I'm on a different device/browser" path).
  const [resumeState, setResumeState] = useState<{
    mode: 'closed' | 'email' | 'otp';
    email: string;
    otp: string;
    isSending: boolean;
    isVerifying: boolean;
    error: string;
    info: string;
  }>({ mode: 'closed', email: '', otp: '', isSending: false, isVerifying: false, error: '', info: '' });

  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const isLastStep = currentStep === STEPS.length - 1;

  // Resume a same-browser draft on first load, if one exists.
  useEffect(() => {
    const draft = loadDraftFromStorage();
    if (draft) {
      setFormFields(prev => ({ ...prev, ...draft.formFields }));
      setApplicationId(draft.id);
      setDraftToken(draft.draftToken);
      setCurrentStep(clampStep(draft.currentStep));
      if (draft.formFields.registration_type === 'India' && draft.formFields.india_city) {
        setCitySearchInput(draft.formFields.india_city);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Turnstile only needs to be live on the final step -- it mounts when the applicant reaches
  // it and tears down otherwise, rather than for the whole multi-step flow.
  useEffect(() => {
    if (isSuccess || !isLastStep) return;

    let active = true;
    let timer: any = null;

    const initTurnstile = () => {
      if (!active) return;
      const turnstile = (window as any).turnstile;
      if (turnstile && turnstileContainerRef.current) {
        try {
          if (turnstileWidgetIdRef.current) {
            turnstile.remove(turnstileWidgetIdRef.current);
            turnstileWidgetIdRef.current = null;
          }

          const sitekey = (import.meta as any).env.VITE_TURNSTILE_SITEKEY || '1x00000000000000000000AA';

          const widgetId = turnstile.render(turnstileContainerRef.current, {
            sitekey: sitekey,
            callback: (token: string) => {
              if (active) {
                setTurnstileToken(token);
                setErrors((prev) => {
                  const newErrs = { ...prev };
                  delete newErrs['turnstile'];
                  return newErrs;
                });
              }
            },
            'error-callback': () => {
              if (active) setTurnstileToken('');
            },
            'expired-callback': () => {
              if (active) setTurnstileToken('');
            }
          });
          turnstileWidgetIdRef.current = widgetId;
        } catch (e) {
          console.error('Error rendering Turnstile:', e);
        }
      } else {
        timer = setTimeout(initTurnstile, 500);
      }
    };

    timer = setTimeout(initTurnstile, 100);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      const turnstile = (window as any).turnstile;
      if (turnstile && turnstileWidgetIdRef.current) {
        try {
          turnstile.remove(turnstileWidgetIdRef.current);
        } catch (e) {}
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [isSuccess, isLastStep]);

  const referrals = [
    'LinkedIn',
    'Event Site (Eventbrite, AllEvents, etc.)',
    'Friends / Family',
    'Google',
    'Other'
  ];

  const roles = [
    'Founder',
    'Bank / Agent / Financial Advisor',
    'Incubator / Accelerator',
    'Investor',
    'Mentor',
    'Service Provider',
    'Student',
    'Other'
  ];

  const sectors = [
    'Software Development',
    'SaaS (Software as a Service)',
    'AI/ML (Artificial Intelligence/Machine Learning)',
    'Blockchain & Web3',
    'Cybersecurity',
    'FinTech',
    'E-Commerce',
    'EdTech',
    'HealthTech',
    'PropTech',
    'AgriTech',
    'CleanTech / Renewable Energy',
    'IoT (Internet of Things)',
    'Manufacturing',
    'Logistics & Supply Chain',
    'Consumer Products',
    'D2C (Direct-to-Consumer)',
    'Food & Beverage',
    'Hospitality & Travel',
    'Mobility / EV',
    'Real Estate',
    'Media & Entertainment',
    'HRTech',
    'LegalTech',
    'InsurTech',
    'Gaming',
    'SportsTech',
    'SpaceTech',
    'DeepTech',
    'Robotics',
    'Biotechnology',
    'Healthcare',
    'Fashion & Apparel',
    'Social Impact',
    'Other'
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormFields((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrs = { ...prev };
        delete newErrs[name];
        return newErrs;
      });
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormFields((prev) => ({
      ...prev,
      [name]: checked,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrs = { ...prev };
        delete newErrs[name];
        return newErrs;
      });
    }
  };

  const handleNumericChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldName: string
  ) => {
    let val = e.target.value;
    val = val.replace(/\D/g, '');
    if (val.length > 1 && val.startsWith('0')) {
      val = val.replace(/^0+/, '');
    }
    setFormFields((prev) => ({
      ...prev,
      [fieldName]: val,
    }));
    if (errors[fieldName]) {
      setErrors((prev) => {
        const newErrs = { ...prev };
        delete newErrs[fieldName];
        return newErrs;
      });
    }
  };

  const CharCount = ({ text, max }: { text: string; max: number }) => {
    const count = countChars(text);
    return (
      <div className={`flex justify-end text-[10px] font-mono ${count > max ? 'text-red-500 font-semibold' : 'text-neutral-400'}`}>
        <span>{count} / {max} characters</span>
      </div>
    );
  };

  // India gets its well-understood 10-digit-starting-6-9 check; every other country code gets a
  // lenient generic length check (E.164 caps the whole number, country code included, at 15
  // digits, so the national number alone realistically runs 4-14 digits) -- validating every
  // country's actual numbering plan precisely would need a dedicated library, which is overkill
  // here versus just sanity-checking length.
  const isValidPhoneNumber = (iso2: string, raw: string) => {
    const digits = raw.trim().replace(/\D/g, '');
    if (iso2 === 'IN') return /^[6-9]\d{9}$/.test(digits);
    return digits.length >= 4 && digits.length <= 14;
  };

  const validateStep = (stepIndex: number): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (stepIndex === 0) {
      if (!formFields.referral_source) newErrors.referral_source = 'Please select how you heard about us.';
      if (!formFields.submitter_role) newErrors.submitter_role = 'Please select your role.';
      if (!formFields.submitter_name.trim()) newErrors.submitter_name = 'Your name is required.';
      if (!formFields.submitter_phone.trim()) {
        newErrors.submitter_phone = 'Your phone number is required.';
      } else if (!isValidPhoneNumber(formFields.submitter_phone_code, formFields.submitter_phone)) {
        newErrors.submitter_phone = formFields.submitter_phone_code === 'IN'
          ? 'Enter a valid 10-digit Indian mobile number.'
          : 'Enter a valid phone number for the selected country.';
      }
      if (!formFields.submitter_email.trim()) {
        newErrors.submitter_email = 'Your email address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formFields.submitter_email.trim())) {
        newErrors.submitter_email = 'Enter a valid email address.';
      }
    }

    if (stepIndex === 1) {
      if (!formFields.company_name.trim()) newErrors.company_name = 'Startup name is required.';
      if (!formFields.founder_name.trim()) newErrors.founder_name = "Founder's name is required.";
      if (!formFields.founder_phone.trim()) {
        newErrors.founder_phone = "Startup's phone number is required.";
      } else if (!isValidPhoneNumber(formFields.founder_phone_code, formFields.founder_phone)) {
        newErrors.founder_phone = formFields.founder_phone_code === 'IN'
          ? 'Enter a valid 10-digit Indian mobile number.'
          : 'Enter a valid phone number for the selected country.';
      }
      if (!formFields.founder_email.trim()) {
        newErrors.founder_email = "Startup's email address is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formFields.founder_email.trim())) {
        newErrors.founder_email = 'Enter a valid email address.';
      }

      if (formFields.registration_type === 'India') {
        if (!formFields.india_city.trim()) newErrors.india_city = 'City selection is required.';
      } else if (!formFields.outside_location.trim()) {
        newErrors.outside_location = 'Country / State / Region is required.';
      }

      if (formFields.website.trim() && !isValidHttpUrl(formFields.website)) {
        newErrors.website = 'Enter a valid Website URL (e.g. https://acme.in).';
      }
      if (formFields.company_linkedin.trim() && !validateLinkedInUrl(formFields.company_linkedin)) {
        newErrors.company_linkedin = 'Enter a valid LinkedIn URL.';
      }
      if (formFields.founder_linkedin.trim() && !validateLinkedInUrl(formFields.founder_linkedin)) {
        newErrors.founder_linkedin = 'Enter a valid LinkedIn URL.';
      }

      if (!formFields.sector) {
        newErrors.sector = 'Sector is required.';
      } else if (formFields.sector === 'Other' && !formFields.sector_other.trim()) {
        newErrors.sector_other = 'Please specify your sector.';
      }

      if (!formFields.one_line_pitch.trim()) {
        newErrors.one_line_pitch = 'One-liner is required.';
      } else if (countChars(formFields.one_line_pitch) > 700) {
        newErrors.one_line_pitch = `Keep it to 700 characters or fewer (currently ${countChars(formFields.one_line_pitch)}).`;
      }
    }

    if (stepIndex === 2) {
      if (!formFields.stage) newErrors.stage = 'Please select your startup stage.';
      if (!formFields.target_raise.trim() || Number(formFields.target_raise) <= 0) {
        newErrors.target_raise = 'Funding ask is required.';
      }
      if (!formFields.raised_before) {
        newErrors.raised_before = 'Please let us know if you have raised a previous round.';
      } else if (formFields.raised_before === 'Yes') {
        if (!formFields.previous_round_amount.trim() || Number(formFields.previous_round_amount) <= 0) {
          newErrors.previous_round_amount = 'Amount raised is required.';
        }
        if (!formFields.previous_round_valuation.trim()) {
          newErrors.previous_round_valuation = 'Valuation is required.';
        } else if (
          Number(formFields.previous_round_amount) > 0 &&
          Number(formFields.previous_round_valuation) <= Number(formFields.previous_round_amount)
        ) {
          newErrors.previous_round_valuation = 'The valuation must be greater than the amount raised in that round.';
        }
        if (!formFields.previous_round_date.trim()) newErrors.previous_round_date = 'Month & year is required.';
      }
      if (!formFields.current_valuation.trim()) newErrors.current_valuation = 'Current valuation is required.';
    }

    if (stepIndex === 3) {
      const charLimited: [keyof FormFields, string, number][] = [
        ['problem_statement', 'Problem statement', 1800],
        ['proposed_solution', 'Proposed solution', 3600],
        ['target_audience', 'Target audience', 700],
        ['revenue_model', 'Revenue model', 3600],
      ];
      for (const [field, label, max] of charLimited) {
        const value = String(formFields[field] ?? '');
        if (!value.trim()) {
          newErrors[field] = `${label} is required.`;
        } else if (countChars(value) > max) {
          newErrors[field] = `Keep it to ${max} characters or fewer (currently ${countChars(value)}).`;
        }
      }
    }

    if (stepIndex === 4) {
      if (!formFields.current_customers.trim()) newErrors.current_customers = 'Current customer count is required.';
      if (!formFields.monthly_burn.trim()) newErrors.monthly_burn = 'Current monthly burn is required.';
      if (!formFields.revenue_fy_2425.trim()) newErrors.revenue_fy_2425 = 'Revenue for FY 24–25 is required.';
      if (!formFields.revenue_fy_2526.trim()) newErrors.revenue_fy_2526 = 'Revenue for FY 25–26 is required.';
      if (!formFields.revenue_fy_2627.trim()) newErrors.revenue_fy_2627 = 'Revenue for FY 26–27 is required.';
    }

    if (stepIndex === 5) {
      if (!formFields.pitch_deck_link.trim()) {
        newErrors.pitch_deck_link = 'Pitch deck link is required.';
      } else if (!isValidHttpUrl(formFields.pitch_deck_link)) {
        newErrors.pitch_deck_link = 'Enter a valid pitch deck link (e.g. https://drive.google.com/...).';
      }
      if (formFields.demo_video.trim() && !isValidHttpUrl(formFields.demo_video)) {
        newErrors.demo_video = 'Enter a valid link.';
      }
      if (!formFields.declaration_accepted) {
        newErrors.declaration_accepted = 'You must confirm the accuracy of information.';
      }
    }

    return newErrors;
  };

  // Stored (and sent to the backend) as one combined string, e.g. "+91 9876543210" -- there's no
  // separate DB column for the dial code, so this is the one place it gets folded in.
  const combinePhone = (iso2: string, number: string) => `${dialForIso2(iso2)} ${number.trim()}`.trim();

  const buildStepPayload = (stepNumber: number): ApplicationStepData => {
    switch (stepNumber) {
      case 1:
        return {
          referral_source: formFields.referral_source,
          submitter_role: formFields.submitter_role,
          submitter_name: formFields.submitter_name.trim(),
          submitter_phone: combinePhone(formFields.submitter_phone_code, formFields.submitter_phone),
          submitter_email: formFields.submitter_email.trim(),
        };
      case 2:
        return {
          company_name: formFields.company_name.trim(),
          founder_name: formFields.founder_name.trim(),
          founder_phone: combinePhone(formFields.founder_phone_code, formFields.founder_phone),
          founder_email: formFields.founder_email.trim(),
          hq_location: formFields.registration_type === 'India' ? formFields.india_city : formFields.outside_location.trim(),
          website: formFields.website.trim(),
          company_linkedin: formFields.company_linkedin.trim(),
          founder_linkedin: formFields.founder_linkedin.trim(),
          sector: formFields.sector,
          sector_other: formFields.sector === 'Other' ? formFields.sector_other.trim() : '',
          one_line_pitch: formFields.one_line_pitch.trim(),
        };
      case 3:
        return {
          stage: formFields.stage,
          target_raise: Number(formFields.target_raise) || 0,
          currency: formFields.currency,
          raised_before: formFields.raised_before === 'Yes',
          previous_round_amount: formFields.raised_before === 'Yes' ? Number(formFields.previous_round_amount) || 0 : null,
          previous_round_valuation: formFields.raised_before === 'Yes' ? Number(formFields.previous_round_valuation) || 0 : null,
          previous_round_date: formFields.raised_before === 'Yes' ? formFields.previous_round_date.trim() : '',
          current_valuation: Number(formFields.current_valuation) || 0,
        };
      case 4:
        return {
          problem_statement: formFields.problem_statement.trim(),
          proposed_solution: formFields.proposed_solution.trim(),
          target_audience: formFields.target_audience.trim(),
          revenue_model: formFields.revenue_model.trim(),
        };
      case 5:
        return {
          current_customers: Number(formFields.current_customers) || 0,
          monthly_burn: Number(formFields.monthly_burn) || 0,
          revenue_fy_2425: Number(formFields.revenue_fy_2425) || 0,
          revenue_fy_2526: Number(formFields.revenue_fy_2526) || 0,
          revenue_fy_2627: Number(formFields.revenue_fy_2627) || 0,
        };
      case 6:
        return {
          pitch_deck_link: formFields.pitch_deck_link.trim(),
          demo_video: formFields.demo_video.trim() || null,
          declaration_accepted: formFields.declaration_accepted,
        };
      default:
        return {};
    }
  };

  const resetAll = () => {
    clearDraftStorage();
    setFormFields(emptyFormFields);
    setApplicationId('');
    setDraftToken('');
    setCurrentStep(0);
    setCitySearchInput('');
    setDropdownOpen(false);
    setErrors({});
    setSaveError('');
    setTurnstileToken('');
    setStep1Block(null);
    closeResumePanel();
    // Without these, "Apply for Another Company" (which calls resetAll from the success
    // screen) left isSuccess/submittedId set, so the early `if (isSuccess)` return above kept
    // rendering the same success screen forever no matter what else got reset.
    setIsSuccess(false);
    setSubmittedId('');
    setSubmittedAt(null);
  };

  const openResumePanel = (prefillEmail = '') => {
    setResumeState({ mode: 'email', email: prefillEmail, otp: '', isSending: false, isVerifying: false, error: '', info: '' });
  };

  const closeResumePanel = () => {
    setResumeState({ mode: 'closed', email: '', otp: '', isSending: false, isVerifying: false, error: '', info: '' });
  };

  const handleSendResumeOtp = async (emailOverride?: string) => {
    const email = (emailOverride ?? resumeState.email).trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setResumeState(prev => ({ ...prev, error: 'Enter a valid email address.' }));
      return;
    }
    setResumeState(prev => ({ ...prev, email, isSending: true, error: '' }));
    try {
      const response = await apiClient.requestResumeOtp(email);
      if (!response.success) {
        setResumeState(prev => ({ ...prev, isSending: false, error: response.error || 'Could not send a resume code. Please try again.' }));
        return;
      }
      setResumeState(prev => ({
        ...prev,
        mode: 'otp',
        isSending: false,
        otp: '',
        info: `If an application is in progress for ${email}, we've sent a 6-digit code to that address.`,
      }));
    } catch (err: any) {
      setResumeState(prev => ({ ...prev, isSending: false, error: err.message || 'An unexpected connection error occurred.' }));
    }
  };

  // Reverses buildStepPayload: takes what the server has stored for a draft and reconstructs the
  // wizard's own field shape, including the registration_type/india_city/outside_location split
  // that hq_location gets collapsed into on save.
  // Reverses combinePhone: splits a stored "+91 9876543210"-style string back into the ISO2
  // country code (what the <select>'s state actually holds) and local number, by matching the
  // dial prefix against COUNTRY_CODES (longest dial first, so a country whose dial is itself a
  // prefix of another, longer dial in the list can never wrongly steal the match -- verified no
  // such collision exists in the current list, but sorting defensively costs nothing). Falls back
  // to India/empty if nothing matches (covers an unfilled phone and pre-this-feature legacy rows
  // that never had a "+"-prefixed value to begin with).
  const splitPhone = (combined: unknown): { code: string; number: string } => {
    const raw = combined === null || combined === undefined ? '' : String(combined).trim();
    if (!raw) return { code: 'IN', number: '' };
    const match = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length).find((c) => raw.startsWith(c.dial));
    return match ? { code: match.iso2, number: raw.slice(match.dial.length).trim() } : { code: 'IN', number: raw };
  };

  const mapResumedDataToFormFields = (data: ApplicationStepData): Partial<FormFields> => {
    const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
    const submitterPhone = splitPhone(data.submitter_phone);
    const founderPhone = splitPhone(data.founder_phone);
    const mapped: Partial<FormFields> = {
      referral_source: str(data.referral_source),
      submitter_role: str(data.submitter_role),
      submitter_name: str(data.submitter_name),
      submitter_phone_code: submitterPhone.code,
      submitter_phone: submitterPhone.number,
      submitter_email: str(data.submitter_email),
      company_name: str(data.company_name),
      founder_name: str(data.founder_name),
      founder_phone_code: founderPhone.code,
      founder_phone: founderPhone.number,
      founder_email: str(data.founder_email),
      website: str(data.website),
      company_linkedin: str(data.company_linkedin),
      founder_linkedin: str(data.founder_linkedin),
      sector: str(data.sector),
      sector_other: str(data.sector_other),
      one_line_pitch: str(data.one_line_pitch),
      stage: str(data.stage),
      target_raise: str(data.target_raise),
      // Falls back to INR for anything the <select> no longer offers (e.g. a draft saved back
      // when EUR was still an option) -- otherwise the controlled <select> would silently show no
      // selection at all while formFields.currency kept the stale, now-unpickable value.
      currency: ['INR', 'USD'].includes(String(data.currency)) ? String(data.currency) : 'INR',
      raised_before: data.raised_before === true ? 'Yes' : data.raised_before === false ? 'No' : '',
      previous_round_amount: str(data.previous_round_amount),
      previous_round_valuation: str(data.previous_round_valuation),
      previous_round_date: str(data.previous_round_date),
      current_valuation: str(data.current_valuation),
      problem_statement: str(data.problem_statement),
      proposed_solution: str(data.proposed_solution),
      target_audience: str(data.target_audience),
      revenue_model: str(data.revenue_model),
      current_customers: str(data.current_customers),
      monthly_burn: str(data.monthly_burn),
      revenue_fy_2425: str(data.revenue_fy_2425),
      revenue_fy_2526: str(data.revenue_fy_2526),
      revenue_fy_2627: str(data.revenue_fy_2627),
      pitch_deck_link: str(data.pitch_deck_link),
      demo_video: str(data.demo_video),
      declaration_accepted: !!data.declaration_accepted,
    };

    const hq = data.hq_location ? String(data.hq_location) : '';
    if (hq) {
      const matchedCity = indianCities.find(c => c.toLowerCase() === hq.toLowerCase());
      if (matchedCity) {
        mapped.registration_type = 'India';
        mapped.india_city = matchedCity;
        mapped.outside_location = '';
      } else {
        mapped.registration_type = 'Outside India';
        mapped.outside_location = hq;
        mapped.india_city = '';
      }
    }

    return mapped;
  };

  const handleVerifyResumeOtp = async () => {
    const email = resumeState.email.trim();
    const otp = resumeState.otp.trim();
    if (otp.length !== 6) {
      setResumeState(prev => ({ ...prev, error: 'Enter the 6-digit code.' }));
      return;
    }
    setResumeState(prev => ({ ...prev, isVerifying: true, error: '' }));
    try {
      const response = await apiClient.verifyResumeOtp(email, otp);
      if (!response.success || !response.id || !response.draftToken) {
        setResumeState(prev => ({ ...prev, isVerifying: false, error: response.error || 'Could not verify that code.' }));
        return;
      }

      const hydrated = mapResumedDataToFormFields(response.data || {});
      const merged: FormFields = { ...emptyFormFields, ...hydrated };
      setFormFields(merged);
      if (merged.registration_type === 'India' && merged.india_city) {
        setCitySearchInput(merged.india_city);
      }
      setApplicationId(response.id);
      setDraftToken(response.draftToken);
      const step = clampStep(response.currentStep);
      setCurrentStep(step);
      saveDraftToStorage(response.id, response.draftToken, step, merged);
      setStep1Block(null);
      closeResumePanel();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setResumeState(prev => ({ ...prev, isVerifying: false, error: err.message || 'An unexpected connection error occurred.' }));
    }
  };

  const handleStartOver = () => {
    if (!window.confirm("Start a brand new application? Your progress on this device will be cleared (what you've already saved stays on file).")) {
      return;
    }
    resetAll();
  };

  const handleBack = () => {
    if (currentStep === 0) return;
    // Leaving the final step tears down the current Turnstile widget (see the mount effect
    // above, keyed on `isLastStep`), but doesn't clear the already-issued token. Without this,
    // returning to the final step and clicking Submit again -- possibly before the freshly
    // re-rendered widget has finished re-verifying -- would resubmit a stale token instead of
    // waiting for a new one.
    if (isLastStep) {
      setTurnstileToken('');
    }
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    setErrors({});
    if (applicationId && draftToken) {
      saveDraftToStorage(applicationId, draftToken, prevStep, formFields);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setStep1Block(null);

    const stepNumber = currentStep + 1;
    const finalStep = stepNumber === STEPS.length;

    const stepErrors = validateStep(currentStep);
    if (finalStep && !turnstileToken) {
      stepErrors.turnstile = 'Please complete the security verification (CAPTCHA).';
    }
    if (Object.keys(stepErrors).length > 0) {
      console.warn('[FormPortal] Advance blocked by validation:', stepErrors);
      setErrors(stepErrors);
      const firstErrorKey = Object.keys(stepErrors)[0];
      const element = document.getElementById(firstErrorKey);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setErrors({});

    if (finalStep) {
      // Same 60-second anti-spam cooldown the old single-page form used, now checked at final
      // submit. Wrapped in try/catch (unlike a plain `localStorage.getItem`) because this runs
      // inside an async onSubmit handler with no surrounding try yet at this point -- an
      // unguarded throw here (private-browsing storage lockouts, some enterprise browser
      // policies) would surface as an unhandled rejection with no spinner/error shown at all,
      // silently preventing submission. This check is UX-only anti-spam, not a security control,
      // so failing open (allow the submit) if storage is inaccessible is the right default.
      try {
        const lastSubmission = localStorage.getItem('last_submission_time');
        if (lastSubmission) {
          const msSinceLast = Date.now() - Number(lastSubmission);
          if (msSinceLast < 60000) {
            const secondsLeft = Math.ceil((60000 - msSinceLast) / 1000);
            setSaveError(`Anti-Spam Security Protection: Please wait ${secondsLeft} seconds before submitting another application to the pipeline.`);
            return;
          }
        }
      } catch (storageErr) {
        console.warn('[FormPortal] localStorage unavailable for anti-spam check:', storageErr);
      }
    }

    setIsSaving(true);
    try {
      const payload = buildStepPayload(stepNumber);
      const response = await apiClient.saveApplicationStep(
        stepNumber,
        payload,
        applicationId || undefined,
        draftToken || undefined,
        finalStep ? turnstileToken : undefined
      );

      if (!response.success) {
        if (currentStep === 0 && (response.existingDraftFound || response.alreadySubmitted)) {
          const email = formFields.submitter_email.trim();
          setStep1Block({ type: response.existingDraftFound ? 'existingDraft' : 'alreadySubmitted', email });
          if (response.existingDraftFound) {
            openResumePanel(email);
            handleSendResumeOtp(email);
          }
        } else {
          setSaveError(response.error || 'Could not save your progress. Please try again.');
        }
        return;
      }

      const newId = response.id || applicationId;
      const newDraftToken = response.draftToken || draftToken;
      setApplicationId(newId);
      setDraftToken(newDraftToken);

      if (finalStep) {
        // The backend has already finalized this application at this point -- a storage error
        // here must not stop the success screen from showing (it previously fell through to the
        // catch block below and told a genuinely-successful applicant their submission failed,
        // risking a confused duplicate-submission retry against an application that already
        // exists). This cooldown write is UX-only, so best-effort is fine.
        try {
          localStorage.setItem('last_submission_time', String(Date.now()));
        } catch (storageErr) {
          console.warn('[FormPortal] Could not persist anti-spam cooldown timestamp:', storageErr);
        }
        clearDraftStorage();
        setSubmittedId(newId);
        setSubmittedAt(new Date());
        setIsSuccess(true);
      } else {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        saveDraftToStorage(newId, newDraftToken, nextStep, formFields);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || 'An unexpected connection error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12" id="success-view">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-xl bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-50 border border-neutral-200 mb-6">
            <CheckCircle2 className="h-7 w-7 text-neutral-800" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-2">
            Application Submitted
          </h1>
          <p className="text-neutral-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Thank you for applying to Middha Ventures.
            <br /><br />
            Your application has been received successfully. Our investment team will evaluate your submission.
          </p>

          <div className="bg-neutral-50 border border-neutral-200/60 rounded-xl p-5 mb-8 text-left text-xs text-neutral-600 space-y-3 font-mono">
            <div className="flex justify-between border-b border-neutral-200/50 pb-2">
              <span>COMPANY NAME:</span>
              <span className="font-semibold text-neutral-900">{formFields.company_name}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200/50 pb-2">
              <span>APPLICATION ID:</span>
              <span className="font-semibold text-neutral-900">{submittedId}</span>
            </div>
            <div className="flex justify-between">
              <span>SUBMISSION DATE & TIME:</span>
              <span className="font-semibold text-neutral-900">{submittedAt ? formatDateTime(submittedAt) : '—'}</span>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={resetAll}
              className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 shadow-sm"
              id="btn-apply-another"
            >
              Apply for Another Company
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const progressPct = Math.round((currentStep / (STEPS.length - 1)) * 100);
  const StepIcon = STEPS[currentStep].icon;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12" id="application-form-view">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          Middha Ventures Startup Intake
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Intelligent, stage-agnostic venture capital for early-stage enterprise technology builders.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8" id="step-indicator">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
          <span>Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}</span>
          <span>{progressPct}% complete</span>
        </div>
        <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-neutral-900 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {applicationId && (
          <button
            type="button"
            onClick={handleStartOver}
            className="mt-2 text-[10px] text-neutral-400 hover:text-neutral-600 underline cursor-pointer"
            id="btn-start-over"
          >
            Start a new application instead
          </button>
        )}
      </div>

      {/* Resume-by-email-OTP entry point -- only offered pre-draft, on step 1. Same-browser
          resume (localStorage) already happens automatically, this covers a different device. */}
      {currentStep === 0 && !applicationId && resumeState.mode === 'closed' && (
        <div className="mb-6 text-center">
          <button
            type="button"
            onClick={() => openResumePanel()}
            className="text-xs text-neutral-400 hover:text-neutral-600 underline cursor-pointer"
            id="btn-open-resume"
          >
            Already started an application? Resume it with your email
          </button>
        </div>
      )}

      {resumeState.mode !== 'closed' && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 md:p-8 shadow-xs space-y-4 mb-8" id="resume-panel">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-neutral-900">Resume Your Application</h2>
            <button
              type="button"
              onClick={closeResumePanel}
              className="text-xs text-neutral-400 hover:text-neutral-600 cursor-pointer"
              id="btn-cancel-resume"
            >
              Cancel
            </button>
          </div>

          {step1Block?.type === 'existingDraft' && (
            <p className="text-xs text-neutral-500">
              You already have an application in progress with this email. Enter the code we just sent to continue where you left off.
            </p>
          )}

          {resumeState.mode === 'email' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="resume_email">
                  Email Address
                </label>
                <input
                  type="email"
                  id="resume_email"
                  value={resumeState.email}
                  onChange={(e) => setResumeState(prev => ({ ...prev, email: e.target.value, error: '' }))}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none"
                />
              </div>
              {resumeState.error && <p className="text-xs text-red-500">{resumeState.error}</p>}
              <button
                type="button"
                onClick={() => handleSendResumeOtp()}
                disabled={resumeState.isSending}
                className="px-5 py-2 bg-neutral-900 hover:bg-neutral-850 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                id="btn-send-resume-otp"
              >
                {resumeState.isSending ? 'Sending code...' : 'Send Resume Code'}
              </button>
            </div>
          )}

          {resumeState.mode === 'otp' && (
            <div className="space-y-3">
              {resumeState.info && <p className="text-xs text-neutral-500">{resumeState.info}</p>}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="resume_otp">
                  6-Digit Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  id="resume_otp"
                  value={resumeState.otp}
                  onChange={(e) => setResumeState(prev => ({ ...prev, otp: e.target.value.replace(/\D/g, ''), error: '' }))}
                  placeholder="123456"
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none tracking-[0.3em] font-mono"
                />
              </div>
              {resumeState.error && <p className="text-xs text-red-500">{resumeState.error}</p>}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleVerifyResumeOtp}
                  disabled={resumeState.isVerifying || resumeState.otp.length !== 6}
                  className="px-5 py-2 bg-neutral-900 hover:bg-neutral-850 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  id="btn-verify-resume-otp"
                >
                  {resumeState.isVerifying ? 'Verifying...' : 'Verify & Resume'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendResumeOtp()}
                  disabled={resumeState.isSending}
                  className="text-xs text-neutral-400 hover:text-neutral-600 underline cursor-pointer disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {resumeState.mode === 'closed' && (
      <form onSubmit={handleAdvance} className="space-y-8">
        {step1Block?.type === 'alreadySubmitted' && currentStep === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Application already received</p>
              <p className="opacity-90">{step1Block.email ? `We've already received an application from ${step1Block.email}.` : "We've already received an application from this email."} Our team reviews every submission and will reach out if there's a fit. If this was a mistake, use a different email address above.</p>
            </div>
          </div>
        )}
        {saveError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Something went wrong</p>
              <p className="opacity-90">{saveError}</p>
            </div>
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <StepIcon className="h-5 w-5 text-neutral-500" />
              <h2 className="text-lg font-medium text-neutral-900">{currentStep + 1}. {STEPS[currentStep].title}</h2>
            </div>
            <p className="mt-1 text-xs text-neutral-500">{STEPS[currentStep].description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ---------------- STEP 1: ABOUT YOU ---------------- */}
            {currentStep === 0 && (
              <>
                <div className="space-y-1.5 md:col-span-2" id="referral_source_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="referral_source">
                    How did you get to know about us? <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="referral_source"
                    name="referral_source"
                    value={formFields.referral_source}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.referral_source ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none cursor-pointer`}
                  >
                    <option value="">Select an option</option>
                    {referrals.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {errors.referral_source && <span className="text-xs text-red-500">{errors.referral_source}</span>}
                </div>

                <div className="space-y-1.5 md:col-span-2" id="submitter_role_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="submitter_role">
                    I am <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="submitter_role"
                    name="submitter_role"
                    value={formFields.submitter_role}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.submitter_role ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none cursor-pointer`}
                  >
                    <option value="">Select an option</option>
                    {roles.map((rl) => (
                      <option key={rl} value={rl}>{rl}</option>
                    ))}
                  </select>
                  {errors.submitter_role && <span className="text-xs text-red-500">{errors.submitter_role}</span>}
                </div>

                <div className="md:col-span-2 pt-2 border-t border-neutral-100">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-800">Your Contact Details</h3>
                </div>

                <div className="space-y-1.5" id="submitter_name_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="submitter_name">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="submitter_name"
                    name="submitter_name"
                    placeholder="Aarav Sharma"
                    value={formFields.submitter_name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.submitter_name ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                  />
                  {errors.submitter_name && <span className="text-xs text-red-500">{errors.submitter_name}</span>}
                </div>

                <div className="space-y-1.5" id="submitter_phone_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="submitter_phone">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <CountryCodeDropdown
                      id="submitter_phone_code"
                      value={formFields.submitter_phone_code}
                      onChange={(iso2) => setFormFields((prev) => ({ ...prev, submitter_phone_code: iso2 }))}
                    />
                    <input
                      type="text"
                      id="submitter_phone"
                      name="submitter_phone"
                      placeholder="9876543210"
                      value={formFields.submitter_phone}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.submitter_phone ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                    />
                  </div>
                  {errors.submitter_phone && <span className="text-xs text-red-500">{errors.submitter_phone}</span>}
                </div>

                <div className="space-y-1.5" id="submitter_email_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="submitter_email">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="submitter_email"
                    name="submitter_email"
                    placeholder="aarav@acme.in"
                    value={formFields.submitter_email}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.submitter_email ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                  />
                  {errors.submitter_email && <span className="text-xs text-red-500">{errors.submitter_email}</span>}
                </div>
              </>
            )}

            {/* ---------------- STEP 2: STARTUP BASICS ---------------- */}
            {currentStep === 1 && (
              <>
                <div className="md:col-span-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-800 mb-4">Startup Contact Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5" id="company_name_field">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="company_name">
                        Startup Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="company_name"
                        name="company_name"
                        placeholder="Acme Technologies India"
                        value={formFields.company_name}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.company_name ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                      />
                      {errors.company_name && <span className="text-xs text-red-500">{errors.company_name}</span>}
                    </div>

                    <div className="space-y-1.5" id="founder_name_field">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="founder_name">
                        Founder's Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="founder_name"
                        name="founder_name"
                        placeholder="Aarav Sharma"
                        value={formFields.founder_name}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.founder_name ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                      />
                      {errors.founder_name && <span className="text-xs text-red-500">{errors.founder_name}</span>}
                    </div>

                    <div className="space-y-1.5" id="founder_phone_field">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="founder_phone">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-[auto_1fr] gap-2">
                        <CountryCodeDropdown
                          id="founder_phone_code"
                          value={formFields.founder_phone_code}
                          onChange={(iso2) => setFormFields((prev) => ({ ...prev, founder_phone_code: iso2 }))}
                        />
                        <input
                          type="text"
                          id="founder_phone"
                          name="founder_phone"
                          placeholder="9876543210"
                          value={formFields.founder_phone}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.founder_phone ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                        />
                      </div>
                      {errors.founder_phone && <span className="text-xs text-red-500">{errors.founder_phone}</span>}
                    </div>

                    <div className="space-y-1.5" id="founder_email_field">
                      <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="founder_email">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        id="founder_email"
                        name="founder_email"
                        placeholder="aarav@acme.in"
                        value={formFields.founder_email}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.founder_email ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                      />
                      {errors.founder_email && <span className="text-xs text-red-500">{errors.founder_email}</span>}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 md:col-span-2" id="hq_location_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Company Registration Location <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400" htmlFor="registration_type">
                        Where is your company registered?
                      </label>
                      <select
                        id="registration_type"
                        name="registration_type"
                        value={formFields.registration_type}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormFields(prev => ({
                            ...prev,
                            registration_type: val,
                            india_city: '',
                            outside_location: ''
                          }));
                          setCitySearchInput('');
                          setErrors(prev => {
                            const next = { ...prev };
                            delete next.india_city;
                            delete next.outside_location;
                            return next;
                          });
                        }}
                        className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none cursor-pointer"
                      >
                        <option value="India">India</option>
                        <option value="Outside India">Outside India</option>
                      </select>
                    </div>

                    {formFields.registration_type === 'India' ? (
                      <div className="space-y-1.5 relative">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400" htmlFor="india_city">
                          Select Indian City
                        </label>
                        <input
                          type="text"
                          id="india_city"
                          placeholder="Search and select city (e.g. Bengaluru)..."
                          value={citySearchInput}
                          onChange={(e) => {
                            setCitySearchInput(e.target.value);
                            setDropdownOpen(true);
                          }}
                          onFocus={() => setDropdownOpen(true)}
                          className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.india_city ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                        />
                        {isDropdownOpen && (
                          <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-neutral-200 rounded-lg shadow-lg">
                            {filteredCities.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-neutral-500">No cities found.</div>
                            ) : (
                              filteredCities.map(city => (
                                <button
                                  type="button"
                                  key={city}
                                  onClick={() => {
                                    setFormFields(prev => ({ ...prev, india_city: city }));
                                    setCitySearchInput(city);
                                    setDropdownOpen(false);
                                    setErrors(prev => {
                                      const next = { ...prev };
                                      delete next.india_city;
                                      return next;
                                    });
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 text-neutral-700 font-sans"
                                >
                                  {city}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                        {errors.india_city && <span className="text-xs text-red-500">{errors.india_city}</span>}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400" htmlFor="outside_location">
                          Country / State / Region
                        </label>
                        <input
                          type="text"
                          id="outside_location"
                          name="outside_location"
                          placeholder="e.g. United States, California"
                          value={formFields.outside_location}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.outside_location ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                        />
                        {errors.outside_location && <span className="text-xs text-red-500">{errors.outside_location}</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5" id="website_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="website">
                    Startup's Website <span className="text-neutral-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="website"
                    name="website"
                    placeholder="acme.in"
                    value={formFields.website}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.website ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                  />
                  {errors.website && <span className="text-xs text-red-500">{errors.website}</span>}
                </div>

                <div className="space-y-1.5" id="company_linkedin_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="company_linkedin">
                    Startup's LinkedIn <span className="text-neutral-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="company_linkedin"
                    name="company_linkedin"
                    placeholder="https://linkedin.com/company/acme-india"
                    value={formFields.company_linkedin}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.company_linkedin ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                  />
                  {errors.company_linkedin && <span className="text-xs text-red-500">{errors.company_linkedin}</span>}
                </div>

                <div className="space-y-1.5" id="founder_linkedin_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="founder_linkedin">
                    Founder's LinkedIn <span className="text-neutral-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="founder_linkedin"
                    name="founder_linkedin"
                    placeholder="https://linkedin.com/in/aarav-sharma"
                    value={formFields.founder_linkedin}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.founder_linkedin ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                  />
                  {errors.founder_linkedin && <span className="text-xs text-red-500">{errors.founder_linkedin}</span>}
                </div>

                <div className="space-y-1.5" id="sector_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="sector">
                    Sector <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="sector"
                    name="sector"
                    value={formFields.sector}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.sector ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none cursor-pointer`}
                  >
                    <option value="">Select sector</option>
                    {sectors.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {errors.sector && <span className="text-xs text-red-500">{errors.sector}</span>}
                  {formFields.sector === 'Other' && (
                    <div className="pt-2" id="sector_other_field">
                      <input
                        type="text"
                        name="sector_other"
                        placeholder="Please specify your sector"
                        value={formFields.sector_other}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.sector_other ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                      />
                      {errors.sector_other && <span className="text-xs text-red-500">{errors.sector_other}</span>}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 md:col-span-2" id="one_line_pitch_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="one_line_pitch">
                    One-liner <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="one_line_pitch"
                    name="one_line_pitch"
                    rows={2}
                    maxLength={700}
                    placeholder="Describe your startup in one crisp sentence."
                    value={formFields.one_line_pitch}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.one_line_pitch ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none resize-none`}
                  />
                  <CharCount text={formFields.one_line_pitch} max={700} />
                  {errors.one_line_pitch && <span className="text-xs text-red-500">{errors.one_line_pitch}</span>}
                </div>
              </>
            )}

            {/* ---------------- STEP 3: STAGE & FUNDING ---------------- */}
            {currentStep === 2 && (
              <>
                <div className="space-y-3 md:col-span-2" id="stage_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Startup Stage <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {['Pre-Revenue', 'Revenue Generating'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFormFields(prev => ({ ...prev, stage: opt }))}
                        className={`py-3 px-4 text-sm font-medium rounded-xl border text-center transition-all cursor-pointer ${
                          formFields.stage === opt
                            ? 'bg-neutral-900 border-neutral-900 text-white font-semibold'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {errors.stage && <span className="text-xs text-red-500">{errors.stage}</span>}
                </div>

                <div className="space-y-1.5 md:col-span-2 border-t border-neutral-100 pt-4" id="currency_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="currency">
                    Currency <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    value={formFields.currency}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none cursor-pointer"
                  >
                    <option value="INR">Indian Rupee (INR)</option>
                    <option value="USD">US Dollar (USD)</option>
                  </select>
                  <p className="text-[10px] text-neutral-400">Applies to every amount on this and the next step, for consistency.</p>
                </div>

                <div className="space-y-1.5" id="target_raise_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="target_raise">
                    Funding Ask <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-lg">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-neutral-500 text-sm font-sans">{getCurrencySymbol(formFields.currency)}</span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      id="target_raise"
                      name="target_raise"
                      placeholder="1,00,00,000"
                      value={formFields.target_raise}
                      onChange={(e) => handleNumericChange(e, 'target_raise')}
                      className={`w-full pl-7 pr-3 py-2 text-sm bg-neutral-50 border ${errors.target_raise ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                    />
                  </div>
                  {errors.target_raise && <span className="text-xs text-red-500">{errors.target_raise}</span>}
                </div>

                <div className="space-y-1.5" id="current_valuation_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="current_valuation">
                    Current Valuation <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-lg">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-neutral-500 text-sm font-sans">{getCurrencySymbol(formFields.currency)}</span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      id="current_valuation"
                      name="current_valuation"
                      placeholder="5,00,00,000"
                      value={formFields.current_valuation}
                      onChange={(e) => handleNumericChange(e, 'current_valuation')}
                      className={`w-full pl-7 pr-3 py-2 text-sm bg-neutral-50 border ${errors.current_valuation ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                    />
                  </div>
                  {errors.current_valuation && <span className="text-xs text-red-500">{errors.current_valuation}</span>}
                  {!errors.current_valuation &&
                    Number(formFields.current_valuation) > 0 &&
                    Number(formFields.target_raise) > 0 &&
                    Number(formFields.current_valuation) < Number(formFields.target_raise) && (
                      <span className="text-xs text-amber-600">
                        ⚠ Current valuation is lower than the funding ask -- double-check this is correct.
                      </span>
                    )}
                </div>

                <div className="space-y-3 md:col-span-2 border-t border-neutral-100 pt-4" id="raised_before_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Have you raised a previous round? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {['Yes', 'No'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFormFields(prev => ({
                          ...prev,
                          raised_before: opt,
                          ...(opt === 'No' ? { previous_round_amount: '', previous_round_valuation: '', previous_round_date: '' } : {}),
                        }))}
                        className={`py-3 px-4 text-sm font-medium rounded-xl border text-center transition-all cursor-pointer ${
                          formFields.raised_before === opt
                            ? 'bg-neutral-900 border-neutral-900 text-white font-semibold'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {errors.raised_before && <span className="text-xs text-red-500">{errors.raised_before}</span>}
                </div>

                {formFields.raised_before === 'Yes' && (
                  <div className="md:col-span-2 bg-neutral-50 border border-neutral-200 rounded-lg p-4" id="previous_round_field">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3 block">
                      Previous Round <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400" htmlFor="previous_round_amount">
                          Amount raised
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          id="previous_round_amount"
                          name="previous_round_amount"
                          placeholder="0"
                          value={formFields.previous_round_amount}
                          onChange={(e) => handleNumericChange(e, 'previous_round_amount')}
                          className={`w-full px-3 py-2 text-sm bg-white border ${errors.previous_round_amount ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} rounded-lg transition-colors outline-none`}
                        />
                        {errors.previous_round_amount && <span className="text-xs text-red-500">{errors.previous_round_amount}</span>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400" htmlFor="previous_round_valuation">
                          Valuation
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          id="previous_round_valuation"
                          name="previous_round_valuation"
                          placeholder="0"
                          value={formFields.previous_round_valuation}
                          onChange={(e) => handleNumericChange(e, 'previous_round_valuation')}
                          className={`w-full px-3 py-2 text-sm bg-white border ${errors.previous_round_valuation ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} rounded-lg transition-colors outline-none`}
                        />
                        {errors.previous_round_valuation && <span className="text-xs text-red-500">{errors.previous_round_valuation}</span>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400" htmlFor="previous_round_date">
                          Month & Year
                        </label>
                        <input
                          type="text"
                          id="previous_round_date"
                          name="previous_round_date"
                          placeholder="e.g. Mar 2025"
                          value={formFields.previous_round_date}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 text-sm bg-white border ${errors.previous_round_date ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} rounded-lg transition-colors outline-none`}
                        />
                        {errors.previous_round_date && <span className="text-xs text-red-500">{errors.previous_round_date}</span>}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ---------------- STEP 4: THE BUSINESS ---------------- */}
            {currentStep === 3 && (
              <>
                <div className="space-y-1.5 md:col-span-2" id="problem_statement_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="problem_statement">
                    Problem Statement <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="problem_statement"
                    name="problem_statement"
                    rows={4}
                    maxLength={1800}
                    placeholder="What problem are you solving?"
                    value={formFields.problem_statement}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2.5 text-sm bg-neutral-50 border ${errors.problem_statement ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none resize-none`}
                  />
                  <CharCount text={formFields.problem_statement} max={1800} />
                  {errors.problem_statement && <span className="text-xs text-red-500">{errors.problem_statement}</span>}
                </div>

                <div className="space-y-1.5 md:col-span-2" id="proposed_solution_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="proposed_solution">
                    Proposed Solution <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="proposed_solution"
                    name="proposed_solution"
                    rows={5}
                    maxLength={3600}
                    placeholder="How does your product solve it?"
                    value={formFields.proposed_solution}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2.5 text-sm bg-neutral-50 border ${errors.proposed_solution ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none resize-none`}
                  />
                  <CharCount text={formFields.proposed_solution} max={3600} />
                  {errors.proposed_solution && <span className="text-xs text-red-500">{errors.proposed_solution}</span>}
                </div>

                <div className="space-y-1.5 md:col-span-2" id="target_audience_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="target_audience">
                    Target Audience <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="target_audience"
                    name="target_audience"
                    rows={3}
                    maxLength={700}
                    placeholder="Who is this for?"
                    value={formFields.target_audience}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2.5 text-sm bg-neutral-50 border ${errors.target_audience ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none resize-none`}
                  />
                  <CharCount text={formFields.target_audience} max={700} />
                  {errors.target_audience && <span className="text-xs text-red-500">{errors.target_audience}</span>}
                </div>

                <div className="space-y-1.5 md:col-span-2" id="revenue_model_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="revenue_model">
                    Revenue Model <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="revenue_model"
                    name="revenue_model"
                    rows={5}
                    maxLength={3600}
                    placeholder="How does the startup make money?"
                    value={formFields.revenue_model}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2.5 text-sm bg-neutral-50 border ${errors.revenue_model ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none resize-none`}
                  />
                  <CharCount text={formFields.revenue_model} max={3600} />
                  {errors.revenue_model && <span className="text-xs text-red-500">{errors.revenue_model}</span>}
                </div>
              </>
            )}

            {/* ---------------- STEP 5: TRACTION & FINANCIALS ---------------- */}
            {currentStep === 4 && (
              <>
                <div className="space-y-1.5" id="current_customers_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="current_customers">
                    Current Customers <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    id="current_customers"
                    name="current_customers"
                    placeholder="0"
                    value={formFields.current_customers}
                    onChange={(e) => handleNumericChange(e, 'current_customers')}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.current_customers ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                  />
                  {errors.current_customers && <span className="text-xs text-red-500">{errors.current_customers}</span>}
                </div>

                <div className="space-y-1.5" id="monthly_burn_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="monthly_burn">
                    Current Burn / Month <span className="text-red-500">*</span>
                  </label>
                  <div className="relative rounded-lg">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-neutral-500 text-sm font-sans">{getCurrencySymbol(formFields.currency)}</span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      id="monthly_burn"
                      name="monthly_burn"
                      placeholder="0"
                      value={formFields.monthly_burn}
                      onChange={(e) => handleNumericChange(e, 'monthly_burn')}
                      className={`w-full pl-7 pr-3 py-2 text-sm bg-neutral-50 border ${errors.monthly_burn ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                    />
                  </div>
                  {errors.monthly_burn && <span className="text-xs text-red-500">{errors.monthly_burn}</span>}
                </div>

                <div className="md:col-span-2 bg-neutral-50 border border-neutral-200 rounded-lg p-4" id="revenue_by_fy_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3 block">
                    Revenue by Financial Year <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { key: 'revenue_fy_2425', label: 'FY 24–25' },
                      { key: 'revenue_fy_2526', label: 'FY 25–26' },
                      { key: 'revenue_fy_2627', label: 'FY 26–27' },
                    ].map(({ key, label }) => (
                      <div className="space-y-1.5" key={key}>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400" htmlFor={key}>
                          {label}
                        </label>
                        <div className="relative rounded-lg">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-neutral-500 text-sm font-sans">{getCurrencySymbol(formFields.currency)}</span>
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            id={key}
                            name={key}
                            placeholder="0"
                            value={(formFields as any)[key]}
                            onChange={(e) => handleNumericChange(e, key)}
                            className={`w-full pl-7 pr-3 py-2 text-sm bg-white border ${errors[key] ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} rounded-lg transition-colors outline-none`}
                          />
                        </div>
                        {errors[key] && <span className="text-xs text-red-500">{errors[key]}</span>}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-3">Figures in the currency selected under Funding Ask, for consistency.</p>
                </div>
              </>
            )}

            {/* ---------------- STEP 6: PITCH DECK & DECLARATION ---------------- */}
            {currentStep === 5 && (
              <>
                <div className="space-y-1.5 md:col-span-2" id="pitch_deck_link_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="pitch_deck_link">
                    Pitch Deck Link <span className="text-red-500">*</span>{' '}
                    <span className="text-neutral-400 font-normal normal-case tracking-normal">(Please give view access to all)</span>
                  </label>
                  <input
                    type="text"
                    id="pitch_deck_link"
                    name="pitch_deck_link"
                    placeholder="https://drive.google.com/..."
                    value={formFields.pitch_deck_link}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.pitch_deck_link ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                  />
                  <p className="text-[10px] text-neutral-400">Share a link to your pitch deck (Google Drive, Dropbox, Notion, etc.) with sharing set to "Anyone with the link can view."</p>
                  {errors.pitch_deck_link && <span className="text-xs text-red-500">{errors.pitch_deck_link}</span>}
                </div>

                <div className="space-y-1.5 md:col-span-2" id="demo_video_field">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="demo_video">
                    Additional Material <span className="text-neutral-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="demo_video"
                    name="demo_video"
                    placeholder="Link to a data room, video, one-pager, or anything else you'd like us to see"
                    value={formFields.demo_video}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.demo_video ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                  />
                  {errors.demo_video && <span className="text-xs text-red-500">{errors.demo_video}</span>}
                </div>

                <div className="space-y-3 md:col-span-2 pt-4 border-t border-neutral-100">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Declaration <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-start gap-3" id="declaration_accepted_field">
                    <input
                      type="checkbox"
                      id="declaration_accepted"
                      name="declaration_accepted"
                      checked={formFields.declaration_accepted}
                      onChange={handleCheckboxChange}
                      className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                    />
                    <label htmlFor="declaration_accepted" className="text-sm text-neutral-600 leading-normal cursor-pointer">
                      I confirm that the information provided in this form is accurate and complete to the best of my knowledge, and I have the authority to submit this application on behalf of the startup named above.
                    </label>
                  </div>
                  {errors.declaration_accepted && <p className="text-xs text-red-500">{errors.declaration_accepted}</p>}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Hidden Cloudflare Turnstile Container -- only live on the final step */}
        {isLastStep && (
          <div ref={turnstileContainerRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px', overflow: 'hidden' }} />
        )}

        <div className="space-y-4 pt-2">
          {errors.turnstile && (
            <div className="p-3 bg-red-50 border border-red-150 rounded-lg flex items-start gap-2 text-red-750 text-xs font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errors.turnstile}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Shield className="h-3.5 w-3.5" />
            <span>Your progress is saved after every step.</span>
          </div>

          <div className="flex items-center justify-between">
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-5 py-2.5 bg-transparent hover:bg-neutral-50 text-neutral-600 border border-neutral-200 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 cursor-pointer"
                id="btn-back-step"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : <span />}

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              id="btn-continue-step"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {isLastStep ? 'Submitting...' : 'Saving...'}
                </>
              ) : (
                <>
                  {isLastStep ? 'Submit Application' : 'Continue'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
      )}
    </div>
  );
}

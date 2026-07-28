import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Upload, CheckCircle2, AlertCircle, Building2, Globe, Mail, User, Shield, Video, ArrowRight, RefreshCw } from 'lucide-react';
import { apiClient } from './apiClient';
import { isValidHttpUrl, validateLinkedInUrl } from '../../shared/src/securityUtils';

export default function FormPortal() {
  const [formFields, setFormFields] = useState({
    referral: '', // 1. How did you get to know about us?
    role: '', // 2. I am
    company_name: '', // 4. Startup Name
    founder_name: '', // 5. Founder's Name
    founder_email: '', // 6. Email ID
    phone_number: '', // 7. Phone Number
    hq_location: '', // 8. Location (City Name only)
    website: '', // 9. Website
    company_linkedin: '', // 10. Company's LinkedIn Profile
    founder_linkedin: '', // 11. Founder's LinkedIn Profile
    sector: 'Software Development', // 12. Which sector does your startup belong to?
    one_line_pitch: '', // 13. What problem does your startup solve?
    description: '', // 14. Describe your startup.
    target_audience: '', // 15. Who is your target audience?
    customers_count: '', // 16. How many customers/users do you have?
    revenue_fy25: '', // 17. How much revenue did your startup generate in FY 2024–25?
    funding_raised: '', // 18. How much funding have you raised so far, if any?
    target_raise: '', // 19. How much funding are you looking to raise?
    anything_else: '', // 20. Is there anything else you'd like us to know about your startup?
    pitch_deck_link: '', // 21. Pitch Deck Link
    declaration: false, // 22. Declaration
    currency: 'INR',
    revenue_status: 'Pre-Revenue',
    revenue_generated_fy25: '',
    current_financial_year_revenue: '',
    registration_type: 'India',
    india_city: '',
    outside_location: '',
  });

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedId, setSubmittedId] = useState('');

  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  React.useEffect(() => {
    if (isSuccess) return;

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
  }, [isSuccess]);

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
    // Keep only digits
    val = val.replace(/\D/g, '');
    
    // Remove leading zeros
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

  const getCurrencySymbol = (curr: string) => {
    switch (curr) {
      case 'USD': return '$';
      case 'EUR': return '€';
      default: return '₹';
    }
  };

  const validateForm = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (!formFields.referral) {
      newErrors.referral = 'Please select how you heard about us.';
    }

    if (!formFields.role) {
      newErrors.role = 'Please select your role.';
    }

    if (!formFields.company_name.trim()) {
      newErrors.company_name = 'Startup name is required.';
    }

    if (!formFields.founder_name.trim()) {
      newErrors.founder_name = "Founder's name is required.";
    }

    if (!formFields.founder_email.trim()) {
      newErrors.founder_email = 'Email ID is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formFields.founder_email.trim())) {
      newErrors.founder_email = 'Enter a valid email address.';
    }

    // Phone number field accepts valid Indian mobile numbers
    const cleanPhone = formFields.phone_number.trim().replace(/[\s\-]/g, '');
    if (!formFields.phone_number.trim()) {
      newErrors.phone_number = 'Phone number is required.';
    } else if (!/^(?:\+91|91|0)?[6-9]\d{9}$/.test(cleanPhone)) {
      newErrors.phone_number = 'Enter a valid 10-digit Indian mobile number.';
    }

    if (formFields.registration_type === 'India') {
      if (!formFields.india_city.trim()) {
        newErrors.india_city = 'City selection is required.';
      }
    } else {
      if (!formFields.outside_location.trim()) {
        newErrors.outside_location = 'Country / State / Region is required.';
      }
    }

    // Website (Optional, validate if filled)
    const websiteTrim = formFields.website.trim();
    if (websiteTrim) {
      if (!isValidHttpUrl(formFields.website)) {
        newErrors.website = 'Enter a valid Website URL (e.g. https://acme.in).';
      }
    }

    // Company LinkedIn (Optional, validate if filled)
    const companyLinkedinTrim = formFields.company_linkedin.trim();
    if (companyLinkedinTrim) {
      if (!validateLinkedInUrl(companyLinkedinTrim)) {
        newErrors.company_linkedin = 'Enter a valid LinkedIn URL.';
      }
    }

    // Founder LinkedIn (Optional, validate if filled)
    const founderLinkedinTrim = formFields.founder_linkedin.trim();
    if (founderLinkedinTrim) {
      if (!validateLinkedInUrl(founderLinkedinTrim)) {
        newErrors.founder_linkedin = 'Enter a valid LinkedIn URL.';
      }
    }

    if (!formFields.sector) {
      newErrors.sector = 'Sector is required.';
    }

    if (!formFields.one_line_pitch.trim()) {
      newErrors.one_line_pitch = 'What problem does your startup solve? is required.';
    } else if (formFields.one_line_pitch.length > 150) {
      newErrors.one_line_pitch = 'Problem description must be 150 characters or less.';
    }

    if (!formFields.description.trim()) {
      newErrors.description = 'Describe your startup is required.';
    }

    if (!formFields.target_audience.trim()) {
      newErrors.target_audience = 'Target audience description is required.';
    }

    if (!formFields.customers_count.trim()) {
      newErrors.customers_count = 'Number of customers/users is required.';
    }

    if (formFields.revenue_status === 'Revenue Generating') {
      if (!formFields.revenue_generated_fy25.trim()) {
        newErrors.revenue_generated_fy25 = 'Revenue Generated in Financial Year 2024–25 is required for revenue generating startups.';
      }
      if (!formFields.current_financial_year_revenue.trim()) {
        newErrors.current_financial_year_revenue = 'Revenue Generated During Current Financial Year is required.';
      }
    }

    if (!formFields.target_raise.trim()) {
      newErrors.target_raise = 'Funding you are looking to raise is required.';
    }

    // Pitch deck file or link is mandatory
    if (!formFields.pitch_deck_link.trim()) {
      newErrors.pitch_deck_link = 'Pitch deck link is required.';
    } else if (!isValidHttpUrl(formFields.pitch_deck_link)) {
      newErrors.pitch_deck_link = 'Enter a valid Pitch Deck Link (e.g. https://drive.google.com/...).';
    }

    if (!formFields.declaration) {
      newErrors.declaration = 'You must confirm the accuracy of information.';
    }

    if (!turnstileToken) {
      newErrors.turnstile = 'Please complete the security verification (CAPTCHA).';
    }

    setErrors(newErrors);
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Check rate limit / spam protection (60 seconds cooldown)
    const lastSubmission = localStorage.getItem('last_submission_time');
    if (lastSubmission) {
      const msSinceLast = Date.now() - Number(lastSubmission);
      if (msSinceLast < 60000) {
        const secondsLeft = Math.ceil((60000 - msSinceLast) / 1000);
        setSubmitError(`Anti-Spam Security Protection: Please wait ${secondsLeft} seconds before submitting another application to the pipeline.`);
        return;
      }
    }

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      console.warn('[FormPortal] Submission blocked by validation:', validationErrors);
      // Scroll to the first field that actually failed in THIS validation pass
      // (previously read from stale `errors` state, which was empty on a first
      // attempt, so the page silently failed to scroll to the real error).
      const firstErrorKey = Object.keys(validationErrors)[0];
      if (firstErrorKey) {
        const element = document.getElementById(firstErrorKey);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // Create payload matching ApplicationFormData precisely
      const payload = {
        company_name: formFields.company_name.trim(),
        website: formFields.website.trim(),
        one_line_pitch: formFields.one_line_pitch.trim(),
        description: `[Startup Description]
${formFields.description.trim()}

[Target Audience]
${formFields.target_audience.trim()}

[Is there anything else you'd like us to know about your startup?]
${formFields.anything_else.trim() || 'None'}`,
        hq_location: formFields.registration_type === 'India' ? formFields.india_city : formFields.outside_location.trim(),
        sector: formFields.sector,
        founder_name: formFields.founder_name.trim(),
        founder_email: formFields.founder_email.trim(),
        founder_linkedin: formFields.founder_linkedin.trim(),
        team_size: formFields.customers_count ? (parseInt(formFields.customers_count, 10) || 1) : 1,
        team_background: `How did you get to know about us?: ${formFields.referral}
I am: ${formFields.role}
Phone Number: ${formFields.phone_number.trim()}
Company's LinkedIn Profile: ${formFields.company_linkedin.trim() || 'Not Provided'}
Founder's LinkedIn Profile: ${formFields.founder_linkedin.trim() || 'Not Provided'}`,
        stage: 'MVP/Pre-revenue',
        funding_raised: formFields.funding_raised ? (parseFloat(formFields.funding_raised) || 0) : 0,
        target_raise: formFields.target_raise ? (parseFloat(formFields.target_raise) || 1) : 1,
        traction: `[Customers/Users Count]
${formFields.customers_count || '0'}

[Current Revenue Status]
${formFields.revenue_status}

[Revenue Generated in Financial Year 2024–25]
${formFields.revenue_status === 'Revenue Generating' ? `${formFields.currency} ${formFields.revenue_generated_fy25}` : 'N/A'}

[Revenue Generated During Current Financial Year]
${formFields.revenue_status === 'Revenue Generating' ? `${formFields.currency} ${formFields.current_financial_year_revenue || '0'}` : 'N/A'}`,
        demo_video: formFields.pitch_deck_link.trim() || undefined,
        currency: formFields.currency,
        revenue_status: formFields.revenue_status,
        revenue_generated_fy25: formFields.revenue_status === 'Revenue Generating' ? formFields.revenue_generated_fy25 : '',
        current_financial_year_revenue: formFields.revenue_status === 'Revenue Generating' ? formFields.current_financial_year_revenue : '',
      };

      const response = await apiClient.submitApplication(payload, turnstileToken);
      if (response.success && response.id) {
        localStorage.setItem('last_submission_time', String(Date.now()));
        setSubmittedId(response.id);
        setIsSuccess(true);
      } else {
        setSubmitError(response.error || 'Failed to submit application. Please verify details and try again.');
      }
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || 'An unexpected connection error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormFields({
      referral: '',
      role: '',
      company_name: '',
      founder_name: '',
      founder_email: '',
      phone_number: '',
      hq_location: '',
      website: '',
      company_linkedin: '',
      founder_linkedin: '',
      sector: 'Software Development',
      one_line_pitch: '',
      description: '',
      target_audience: '',
      customers_count: '',
      revenue_fy25: '',
      funding_raised: '',
      target_raise: '',
      anything_else: '',
      pitch_deck_link: '',
      declaration: false,
      currency: 'INR',
      revenue_status: 'Pre-Revenue',
      revenue_generated_fy25: '',
      current_financial_year_revenue: '',
      registration_type: 'India',
      india_city: '',
      outside_location: '',
    });
    setCitySearchInput('');
    setDropdownOpen(false);
    setErrors({});
    setIsSuccess(false);
    setSubmitError('');
    setSubmittedId('');
    setTurnstileToken('');
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
              <span className="font-semibold text-neutral-900">{new Date().toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleReset}
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

      <form onSubmit={handleSubmit} className="space-y-8">
        {submitError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Submission Failed</p>
              <p className="opacity-90">{submitError}</p>
            </div>
          </div>
        )}

        {/* Card 1: Introduction & Contact Details */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-3 flex items-center gap-2">
            <User className="h-5 w-5 text-neutral-500" />
            <h2 className="text-lg font-medium text-neutral-900">1. Introduction & Contact Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Referral */}
            <div className="space-y-1.5 md:col-span-2" id="referral_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="referral">
                1. How did you get to know about us? <span className="text-red-500">*</span>
              </label>
              <select
                id="referral"
                name="referral"
                value={formFields.referral}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.referral ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none cursor-pointer`}
              >
                <option value="">Select an option</option>
                {referrals.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.referral && <span className="text-xs text-red-500">{errors.referral}</span>}
            </div>

            {/* 2. Role */}
            <div className="space-y-1.5 md:col-span-2" id="role_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="role">
                2. I am <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                name="role"
                value={formFields.role}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.role ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none cursor-pointer`}
              >
                <option value="">Select an option</option>
                {roles.map((rl) => (
                  <option key={rl} value={rl}>{rl}</option>
                ))}
              </select>
              {errors.role && <span className="text-xs text-red-500">{errors.role}</span>}
            </div>

            {/* 3. Your Contact Details Section Header */}
            <div className="md:col-span-2 pt-2 border-t border-neutral-100">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-800">
                3. Your Contact Details
              </h3>
            </div>

            {/* 4. Startup Name */}
            <div className="space-y-1.5" id="company_name_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="company_name">
                4. Startup Name <span className="text-red-500">*</span>
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

            {/* 5. Founder's Name */}
            <div className="space-y-1.5" id="founder_name_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="founder_name">
                5. Founder's Name <span className="text-red-500">*</span>
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

            {/* 6. Email ID */}
            <div className="space-y-1.5" id="founder_email_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="founder_email">
                6. Email ID <span className="text-red-500">*</span>
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

            {/* 7. Phone Number */}
            <div className="space-y-1.5" id="phone_number_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="phone_number">
                7. Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="phone_number"
                name="phone_number"
                placeholder="9876543210"
                value={formFields.phone_number}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.phone_number ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              {errors.phone_number && <span className="text-xs text-red-500">{errors.phone_number}</span>}
            </div>

            {/* 8. Company Registration Location */}
            <div className="space-y-3 md:col-span-2" id="hq_location_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                8. Company Registration Location <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Registration Type Select */}
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

                {/* Searchable dropdown for India or free-text for Outside */}
                {formFields.registration_type === 'India' ? (
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400" htmlFor="india_city_search">
                      Select Indian City
                    </label>
                    <input
                      type="text"
                      id="india_city_search"
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

            {/* 9. Website */}
            <div className="space-y-1.5" id="website_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="website">
                9. Website <span className="text-neutral-400">(Optional)</span>
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

            {/* 10. Company's LinkedIn Profile */}
            <div className="space-y-1.5" id="company_linkedin_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="company_linkedin">
                10. Company's LinkedIn Profile <span className="text-neutral-400">(Optional)</span>
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

            {/* 11. Founder's LinkedIn Profile */}
            <div className="space-y-1.5" id="founder_linkedin_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="founder_linkedin">
                11. Founder's LinkedIn Profile <span className="text-neutral-400">(Optional)</span>
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
          </div>
        </div>

        {/* Card 2: Startup Details & Metrics */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-3 flex items-center gap-2">
            <Globe className="h-5 w-5 text-neutral-500" />
            <h2 className="text-lg font-medium text-neutral-900">2. Startup Details & Metrics</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 12. Sector Dropdown */}
            <div className="space-y-1.5 md:col-span-2" id="sector_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="sector">
                12. Which sector does your startup belong to? <span className="text-red-500">*</span>
              </label>
              <select
                id="sector"
                name="sector"
                value={formFields.sector}
                onChange={handleInputChange}
                className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none cursor-pointer"
              >
                {sectors.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.sector && <span className="text-xs text-red-500">{errors.sector}</span>}
            </div>

            {/* 13. What problem does your startup solve? */}
            <div className="space-y-1.5 md:col-span-2" id="one_line_pitch_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="one_line_pitch">
                13. What problem does your startup solve? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="one_line_pitch"
                name="one_line_pitch"
                maxLength={150}
                placeholder="Reducing logistics delays for supply chain companies using AI."
                value={formFields.one_line_pitch}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.one_line_pitch ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Summarize the main problem in 1 sentence.</span>
                <span>{formFields.one_line_pitch.length}/150 characters</span>
              </div>
              {errors.one_line_pitch && <span className="text-xs text-red-500">{errors.one_line_pitch}</span>}
            </div>

            {/* 14. Describe your startup. */}
            <div className="space-y-1.5 md:col-span-2" id="description_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="description">
                14. Describe your startup. <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                placeholder="We build automated sorting robots and route optimization software for e-commerce hubs."
                value={formFields.description}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 text-sm bg-neutral-50 border ${errors.description ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none resize-none`}
              />
              {errors.description && <span className="text-xs text-red-500">{errors.description}</span>}
            </div>

            {/* 15. Who is your target audience? */}
            <div className="space-y-1.5 md:col-span-2" id="target_audience_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="target_audience">
                15. Who is your target audience? <span className="text-red-500">*</span>
              </label>
              <textarea
                id="target_audience"
                name="target_audience"
                rows={3}
                placeholder="Mid-to-large-scale retail distributors and logistics providers."
                value={formFields.target_audience}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 text-sm bg-neutral-50 border ${errors.target_audience ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none resize-none`}
              />
              {errors.target_audience && <span className="text-xs text-red-500">{errors.target_audience}</span>}
            </div>

            {/* 16. How many customers/users do you have? */}
            <div className="space-y-1.5" id="customers_count_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="customers_count">
                16. How many customers/users do you have? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="customers_count"
                name="customers_count"
                placeholder="150"
                value={formFields.customers_count}
                onChange={(e) => handleNumericChange(e, 'customers_count')}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.customers_count ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              {errors.customers_count && <span className="text-xs text-red-500">{errors.customers_count}</span>}
            </div>

            {/* Currency Selection */}
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
                <option value="EUR">Euro (EUR)</option>
              </select>
              {errors.currency && <span className="text-xs text-red-500">{errors.currency}</span>}
            </div>

            {/* 17. Current Revenue Status */}
            <div className="space-y-3 md:col-span-2" id="revenue_status_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                17. Current Revenue Status <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setFormFields(prev => ({ 
                      ...prev, 
                      revenue_status: 'Pre-Revenue', 
                      revenue_generated_fy25: '', 
                      current_financial_year_revenue: '' 
                    }));
                    setErrors(prev => {
                      const next = { ...prev };
                      delete next.revenue_generated_fy25;
                      delete next.current_financial_year_revenue;
                      return next;
                    });
                  }}
                  className={`py-3 px-4 text-sm font-medium rounded-xl border text-center transition-all cursor-pointer ${
                    formFields.revenue_status === 'Pre-Revenue'
                      ? 'bg-neutral-900 border-neutral-900 text-white font-semibold'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100 font-normal'
                  }`}
                >
                  Pre-Revenue
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormFields(prev => ({ ...prev, revenue_status: 'Revenue Generating' }));
                  }}
                  className={`py-3 px-4 text-sm font-medium rounded-xl border text-center transition-all cursor-pointer ${
                    formFields.revenue_status === 'Revenue Generating'
                      ? 'bg-neutral-900 border-neutral-900 text-white font-semibold'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  Revenue Generating
                </button>
              </div>
            </div>

            {/* Conditionally show Revenue Generated in Financial Year 2024–25 if Revenue Generating */}
            {formFields.revenue_status === 'Revenue Generating' && (
              <div className="space-y-1.5 md:col-span-2" id="revenue_generated_fy25_field">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="revenue_generated_fy25">
                  Revenue Generated in Financial Year 2024–25 <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-lg">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-neutral-500 text-sm font-sans">{getCurrencySymbol(formFields.currency)}</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    id="revenue_generated_fy25"
                    name="revenue_generated_fy25"
                    placeholder="10,00,000"
                    value={formFields.revenue_generated_fy25}
                    onChange={(e) => handleNumericChange(e, 'revenue_generated_fy25')}
                    className={`w-full pl-7 pr-3 py-2 text-sm bg-neutral-50 border ${errors.revenue_generated_fy25 ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                  />
                </div>
                {errors.revenue_generated_fy25 && <span className="text-xs text-red-500">{errors.revenue_generated_fy25}</span>}
              </div>
            )}

            {/* Revenue Generated During Current Financial Year (only visible if Revenue Generating) */}
            {formFields.revenue_status === 'Revenue Generating' && (
              <div className="space-y-1.5 md:col-span-2" id="current_financial_year_revenue_field">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="current_financial_year_revenue">
                  Revenue Generated During Current Financial Year <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-lg">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-neutral-500 text-sm font-sans">{getCurrencySymbol(formFields.currency)}</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    id="current_financial_year_revenue"
                    name="current_financial_year_revenue"
                    placeholder="15,00,000"
                    value={formFields.current_financial_year_revenue}
                    onChange={(e) => handleNumericChange(e, 'current_financial_year_revenue')}
                    className={`w-full pl-7 pr-3 py-2 text-sm bg-neutral-50 border ${errors.current_financial_year_revenue ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                  />
                </div>
                {errors.current_financial_year_revenue && <span className="text-xs text-red-500">{errors.current_financial_year_revenue}</span>}
              </div>
            )}

            {/* 18. How much funding have you raised so far, if any? */}
            <div className="space-y-1.5" id="funding_raised_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="funding_raised">
                18. How much funding have you raised so far, if any? <span className="text-neutral-400">(Optional)</span>
              </label>
              <div className="relative rounded-lg">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-neutral-500 text-sm font-sans">{getCurrencySymbol(formFields.currency)}</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  id="funding_raised"
                  name="funding_raised"
                  placeholder="25,00,000"
                  value={formFields.funding_raised}
                  onChange={(e) => handleNumericChange(e, 'funding_raised')}
                  className={`w-full pl-7 pr-3 py-2 text-sm bg-neutral-50 border ${errors.funding_raised ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
                />
              </div>
              {errors.funding_raised && <span className="text-xs text-red-500">{errors.funding_raised}</span>}
            </div>

            {/* 19. How much funding are you looking to raise? */}
            <div className="space-y-1.5" id="target_raise_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="target_raise">
                19. How much funding are you looking to raise? <span className="text-red-500">*</span>
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

            {/* 20. Is there anything else you'd like us to know about your startup? */}
            <div className="space-y-1.5 md:col-span-2" id="anything_else_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="anything_else">
                20. Is there anything else you'd like us to know about your startup? <span className="text-neutral-400">(Optional)</span>
              </label>
              <textarea
                id="anything_else"
                name="anything_else"
                rows={3}
                placeholder="We have a pending patent on our route optimization algorithm."
                value={formFields.anything_else}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.anything_else ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none resize-none`}
              />
              {errors.anything_else && <span className="text-xs text-red-500">{errors.anything_else}</span>}
            </div>
          </div>
        </div>

        {/* Card 3: Pitch Deck & Submission */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-3 flex items-center gap-2">
            <Upload className="h-5 w-5 text-neutral-500" />
            <h2 className="text-lg font-medium text-neutral-900">3. Pitch Deck & Submission</h2>
          </div>

          <div className="space-y-6">
            {/* 21. Pitch Deck Link */}
            <div className="space-y-1.5" id="pitch_deck_link_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="pitch_deck_link">
                21. Pitch Deck Link <span className="text-red-500">*</span>
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
              <p className="text-[10px] text-neutral-400">Share a link to your pitch deck (Google Drive, Dropbox, Notion, etc. — make sure it's viewable by anyone with the link).</p>
              {errors.pitch_deck_link && <span className="text-xs text-red-500">{errors.pitch_deck_link}</span>}
            </div>

            {/* 22. Declaration Checkbox */}
            <div className="space-y-3 pt-4 border-t border-neutral-100">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                22. Declaration <span className="text-red-500">*</span>
              </label>
              <div className="flex items-start gap-3" id="declaration_field">
                <input
                  type="checkbox"
                  id="declaration"
                  name="declaration"
                  checked={formFields.declaration}
                  onChange={handleCheckboxChange}
                  className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                />
                <label htmlFor="declaration" className="text-sm text-neutral-600 leading-normal cursor-pointer">
                  I confirm that the information provided above is accurate to the best of my knowledge and agree to be contacted.
                </label>
              </div>
              {errors.declaration && <p className="text-xs text-red-500">{errors.declaration}</p>}
            </div>
          </div>
        </div>

        {/* Hidden Cloudflare Turnstile Container to keep verification fully functional in the background */}
        <div ref={turnstileContainerRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px', overflow: 'hidden' }} />

        {/* Form Submission Button */}
        <div className="space-y-4 pt-6">
          {errors.turnstile && (
            <div className="p-3 bg-red-50 border border-red-150 rounded-lg flex items-start gap-2 text-red-750 text-xs font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errors.turnstile}</span>
            </div>
          )}
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-150 rounded-lg flex items-start gap-2 text-red-750 text-xs font-sans">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Shield className="h-3.5 w-3.5" />
              <span>Applications are securely stored with end-to-end RLS.</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              id="btn-submit-application"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Submitting Application...
                </>
              ) : (
                <>
                  Submit Application
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

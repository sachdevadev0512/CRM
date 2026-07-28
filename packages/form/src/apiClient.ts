import { ApplicationFormData } from '../../shared/src/types';

const API_BASE_URL = ((import.meta as any).env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export const apiClient = {
  async submitApplication(data: ApplicationFormData, turnstileToken: string): Promise<{ success: boolean; id: string; error?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/public/submit-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstileToken, data }),
    });

    const text = await response.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.warn('[apiClient] Failed to parse response as JSON:', parseErr);
    }

    if (!response.ok) {
      const errMsg = parsed?.error || `Server error (${response.status}): ${text.substring(0, 150)}`;
      return { success: false, id: '', error: errMsg };
    }

    return { success: true, id: parsed?.id || '' };
  },
};

import {
  ApplicationStepData,
  ApplicationStepResponse,
  RequestResumeOtpResponse,
  VerifyResumeOtpResponse,
} from '../../shared/src/types';

const API_BASE_URL = ((import.meta as any).env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

async function parseJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (parseErr) {
    console.warn('[apiClient] Failed to parse response as JSON:', parseErr);
    return { error: `Server error (${response.status}): ${text.substring(0, 150)}` };
  }
}

export const apiClient = {
  /**
   * Saves one step of the 6-step application form. Pass no `id`/`draftToken` for the very first
   * save (creates the draft row); pass both back in on every subsequent step so the same row gets
   * patched. Step 6 additionally requires `turnstileToken` and finalizes the application.
   */
  async saveApplicationStep(
    step: number,
    data: ApplicationStepData,
    id?: string,
    draftToken?: string,
    turnstileToken?: string
  ): Promise<ApplicationStepResponse> {
    const response = await fetch(`${API_BASE_URL}/api/public/application/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, draftToken, step, data, turnstileToken }),
    });

    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
      return {
        success: false,
        error: parsed?.error || 'Something went wrong. Please try again.',
        existingDraftFound: parsed?.existingDraftFound,
        alreadySubmitted: parsed?.alreadySubmitted,
      };
    }

    return { success: true, id: parsed?.id, application_id: parsed?.application_id, draftToken: parsed?.draftToken };
  },

  /** Sends a 6-digit resume code to `email`, if an in-progress application exists for it. */
  async requestResumeOtp(email: string): Promise<RequestResumeOtpResponse> {
    const response = await fetch(`${API_BASE_URL}/api/public/application/resume/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
      return { success: false, error: parsed?.error || 'Could not send a resume code. Please try again.' };
    }
    return { success: true };
  },

  /** Verifies the code sent by requestResumeOtp and, on success, returns the draft to resume. */
  async verifyResumeOtp(email: string, otp: string): Promise<VerifyResumeOtpResponse> {
    const response = await fetch(`${API_BASE_URL}/api/public/application/resume/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
      return { success: false, error: parsed?.error || 'Could not verify that code. Please try again.' };
    }
    return {
      success: true,
      id: parsed?.id,
      application_id: parsed?.application_id,
      draftToken: parsed?.draftToken,
      currentStep: parsed?.currentStep,
      data: parsed?.data,
    };
  },
};

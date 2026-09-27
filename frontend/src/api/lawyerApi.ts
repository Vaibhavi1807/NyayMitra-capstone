const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export interface Lawyer {
  lawyer_id: string;
  full_name: string;

  profile_photo?: string | null;
  profile_image?: string | null;

  gender?: string | null;
  date_of_birth?: string | null;

  years_of_experience?: number | null;

  enrollment_number?: string | null;
  registration_number?: string | null;
  bar_id_or_bar_code?: string | null;
  bar_council?: string | null;
  year_of_enrollment?: number | null;

  practice_areas?: string[] | null;
  courts_of_practice?: string[] | null;

  state?: string | null;
  district?: string | null;
  city?: string | null;

  office_address?: string | null;
  pincode?: string | null;

  professional_phone_number?: string | null;
  professional_email?: string | null;
  office_phone?: string | null;
  website?: string | null;
  preferred_contact_method?: string | null;

  education_qualifications?: string[] | null;
  languages_known?: string[] | null;

  working_office_hours?: string | null;
  professional_bio?: string | null;

  data_source?: string | null;
  profile_status?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
}

export interface LawyerListResponse {
  count: number;
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  lawyers: Lawyer[];
}

export interface LawyerSearchParams {
  name?: string;
  city?: string;
  district?: string;
  state?: string;
  practice_area?: string;
  min_experience?: number;
  max_experience?: number;
  page?: number;
  limit?: number;
}

export interface PracticeArea {
  practice_area_id: number;
  practice_area_name: string;
  description?: string | null;
}

export interface PracticeAreasResponse {
  count: number;
  practice_areas: PracticeArea[];
}

/* =========================================================
   GENERIC API REQUEST
   ========================================================= */

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    },
  );

  if (!response.ok) {
    let message =
      `API request failed with status ${response.status}.`;

    try {
      const errorData: unknown =
        await response.json();

      if (
        errorData &&
        typeof errorData === "object" &&
        "detail" in errorData &&
        typeof errorData.detail === "string"
      ) {
        message = errorData.detail;
      }
    } catch {
      // Keep default HTTP error message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

/* =========================================================
   GET LAWYERS
   ========================================================= */

export async function getLawyers(
  params: LawyerSearchParams = {},
): Promise<LawyerListResponse> {
  const query = new URLSearchParams();

  if (params.name?.trim()) {
    query.set("name", params.name.trim());
  }

  if (params.city?.trim()) {
    query.set("city", params.city.trim());
  }

  if (params.district?.trim()) {
    query.set("district", params.district.trim());
  }

  if (params.state?.trim()) {
    query.set("state", params.state.trim());
  }

  if (params.practice_area?.trim()) {
    query.set(
      "practice_area",
      params.practice_area.trim(),
    );
  }

  if (params.min_experience !== undefined) {
    query.set(
      "min_experience",
      String(params.min_experience),
    );
  }

  if (params.max_experience !== undefined) {
    query.set(
      "max_experience",
      String(params.max_experience),
    );
  }

  if (params.page !== undefined) {
    query.set(
      "page",
      String(params.page),
    );
  }

  if (params.limit !== undefined) {
    query.set(
      "limit",
      String(params.limit),
    );
  }

  const queryString = query.toString();

  return apiRequest<LawyerListResponse>(
    `/api/lawyers${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}

/* =========================================================
   GET ONE LAWYER
   ========================================================= */

export async function getLawyerById(
  lawyerId: string,
): Promise<Lawyer> {
  const id = lawyerId.trim();

  if (!id) {
    throw new Error(
      "Lawyer ID is required.",
    );
  }

  return apiRequest<Lawyer>(
    `/api/lawyers/${encodeURIComponent(id)}`,
  );
}

/* =========================================================
   GET PRACTICE AREAS
   ========================================================= */

export async function getPracticeAreas(): Promise<PracticeAreasResponse> {
  return apiRequest<PracticeAreasResponse>(
    "/api/practice-areas",
  );
}
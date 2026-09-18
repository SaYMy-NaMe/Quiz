import { http } from '@/services/http';
import type { Credentials, Instructor, RegisterPayload } from '@shared';

interface InstructorResponse {
  instructor: Instructor;
}

export const authApi = {
  register: (payload: RegisterPayload) => http.post<InstructorResponse>('/auth/register', payload),
  login: (payload: Credentials) => http.post<InstructorResponse>('/auth/login', payload),
  logout: () => http.post<void>('/auth/logout'),
  me: () => http.get<InstructorResponse>('/auth/me'),
};

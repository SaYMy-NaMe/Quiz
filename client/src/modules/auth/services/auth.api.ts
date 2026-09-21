import { api } from '@/utils/api';
import type { Credentials, Instructor, RegisterPayload } from '@shared';

interface InstructorResponse {
  instructor: Instructor;
}

export const authApi = {
  register: (payload: RegisterPayload) => api.post<InstructorResponse>('/auth/register', payload),
  login: (payload: Credentials) => api.post<InstructorResponse>('/auth/login', payload),
  logout: () => api.post<unknown>('/auth/logout'),
  me: () => api.get<InstructorResponse>('/auth/me'),
};

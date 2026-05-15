import { apiGet, apiPatch, apiPostMultipart } from '../../../shared/api/client'

export type MyProfile = {
  id: number
  email: string
  full_name: string
  corporate_email: string
  phone: string
  document_number: string
  gender: string
  department_id: number | null
  department_name: string | null
  role: 'admin' | 'agent'
  system_role: string
  professional_role: string
  profile_photo: string | null
  profile_photo_url: string | null
  is_active: boolean
}

export function getMyProfile(): Promise<MyProfile> {
  return apiGet<MyProfile>('/api/me/profile')
}

export type PatchMyProfilePayload = {
  full_name?: string | null
  phone?: string | null
  gender?: string | null
}

export function patchMyProfile(payload: PatchMyProfilePayload): Promise<MyProfile> {
  return apiPatch<MyProfile>('/api/me/profile', payload)
}

export type PhotoUploadResponse = {
  profile_photo: string | null
  profile_photo_url: string | null
}

export function uploadProfilePhoto(file: File): Promise<PhotoUploadResponse> {
  const fd = new FormData()
  fd.append('file', file)
  return apiPostMultipart<PhotoUploadResponse>('/api/profile/photo', fd)
}

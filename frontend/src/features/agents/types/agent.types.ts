export type Agent = {
  id: number
  user: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  corporate_email: string
  phone: string
  document_number: string
  gender: string
  department_id: number | null
  department_name: string | null
  role: string
  system_role: string
  professional_role: string
  profile_photo: string | null
  profile_photo_url: string | null
  is_active: boolean
  workload: number
}

export type Department = {
  id: number
  name: string
}

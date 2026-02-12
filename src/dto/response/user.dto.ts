/**
 * User Response DTOs
 * Define the structure of user-related responses
 */

export interface UserProfileResponseDto {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  lastLogin: Date
  createdAt: Date
  updatedAt: Date
}

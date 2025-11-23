/**
 * Auth Response DTOs
 * Define the structure of authentication responses
 */

export interface AuthResponseDto {
  token: string;
  expiresIn: number;
  user?: UserBasicInfoDto;
}

export interface UserBasicInfoDto {
  id: string;
  email: string;
  name: string;
  role: string;
  level: number;
  experience: number;
  coins: number;
}

export interface LogoutResponseDto {
  message: string;
  success: boolean;
}

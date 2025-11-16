/**
 * Auth Request DTOs
 * Define the structure of incoming authentication requests
 */

export interface RegisterRequestDto {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LogoutRequestDto {
  token: string;
}

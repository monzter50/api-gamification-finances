import { type GoogleIntegration } from '@prisma/client';
import prisma from '../config/database';
import { BaseRepository } from './base.repository';

/**
 * One row per user (`userId` is unique). Every method is keyed by userId —
 * there is no way to reach another user's integration through this repo.
 * `refreshTokenEnc` is ciphertext; encryption/decryption happens in the service.
 */
export class GoogleIntegrationRepository extends BaseRepository<GoogleIntegration> {
  constructor () {
    super('googleIntegration');
  }

  async findByUser (userId: string): Promise<GoogleIntegration | null> {
    return await prisma.googleIntegration.findUnique({ where: { userId } });
  }

  /**
   * Create or refresh the connection. The stored spreadsheet is kept only when
   * the same Google account reconnects — another account can't open it.
   */
  async upsertConnection (
    userId: string,
    data: { refreshTokenEnc: string, scope: string, googleEmail: string | null }
  ): Promise<GoogleIntegration> {
    const existing = await this.findByUser(userId);
    const keepSheet = existing !== null && existing.googleEmail !== null && existing.googleEmail === data.googleEmail;
    return await prisma.googleIntegration.upsert({
      where: { userId },
      create: { userId, ...data },
      update: { ...data, ...(keepSheet ? {} : { spreadsheetId: null, lastSyncAt: null }) }
    });
  }

  async setSpreadsheet (userId: string, spreadsheetId: string): Promise<GoogleIntegration> {
    return await prisma.googleIntegration.update({ where: { userId }, data: { spreadsheetId } });
  }

  async markSynced (userId: string, at: Date): Promise<GoogleIntegration> {
    return await prisma.googleIntegration.update({ where: { userId }, data: { lastSyncAt: at } });
  }

  async deleteByUser (userId: string): Promise<void> {
    await prisma.googleIntegration.deleteMany({ where: { userId } });
  }
}

export const googleIntegrationRepository = new GoogleIntegrationRepository();

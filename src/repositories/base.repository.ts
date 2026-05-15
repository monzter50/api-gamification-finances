import prisma from '../config/database';

/**
 * Base Repository Pattern with Prisma
 * Provides common CRUD operations for all repositories
 */
export abstract class BaseRepository<T> {
  protected modelName: string;

  constructor (modelName: string) {
    this.modelName = modelName;
  }

  protected get model (): any {
    // @ts-expect-error
    return prisma[this.modelName];
  }

  async findById (id: string): Promise<T | null> {
    return this.model.findUnique({
      where: { id }
    });
  }

  async findOne (filter: any): Promise<T | null> {
    return this.model.findFirst({
      where: filter
    });
  }

  async find (filter: any = {}): Promise<T[]> {
    return this.model.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' } // Default sort, might need adjustment
    });
  }

  async findWithPagination (
    filter: any = {},
    page: number = 1,
    limit: number = 10,
    orderBy: any = { createdAt: 'desc' }
  ): Promise<{ data: T[], total: number, page: number, totalPages: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model.findMany({
        where: filter,
        skip,
        take: limit,
        orderBy
      }),
      this.model.count({ where: filter })
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  async create (data: any): Promise<T> {
    return this.model.create({
      data
    });
  }

  async updateById (id: string, data: any): Promise<T | null> {
    return this.model.update({
      where: { id },
      data
    });
  }

  async update (filter: any, data: any): Promise<T | null> {
    // Prisma doesn't support updateMany with returning the document easily, nor findOneAndUpdate directly
    // We simulate findOneAndUpdate by finding first, then updating by ID
    const found = await this.findOne(filter);
    if (!found) return null;

    // @ts-expect-error
    return await this.updateById(found.id, data);
  }

  async deleteById (id: string): Promise<T | null> {
    return this.model.delete({
      where: { id }
    });
  }

  async delete (filter: any): Promise<{ deletedCount: number }> {
    const result = await this.model.deleteMany({
      where: filter
    });
    return { deletedCount: result.count };
  }

  async exists (filter: any): Promise<boolean> {
    const count = await this.model.count({
      where: filter
    });
    return count > 0;
  }

  async count (filter: any = {}): Promise<number> {
    return this.model.count({
      where: filter
    });
  }
}

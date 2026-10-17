import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../infrastructure/database/client.js';
import { AppError } from '../../lib/errors.js';
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  ListSuppliersQueryInput,
  CheckSupplierDuplicatesInput,
} from './suppliers-schemas.js';

export interface SupplierView {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  contactPerson: string | null;
  taxId: string | null;
  notes: string | null;
  isActive: boolean;
  receiptsCount: number;
  createdAt: string;
  updatedAt: string;
}

export class SupplierService {
  constructor(private db: PrismaClient = defaultPrisma) {}

  async listSuppliers(orgId: string, query: ListSuppliersQueryInput) {
    const { search, activeOnly, sortBy, sortOrder, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {
      org_id: orgId,
      deleted_at: null,
      ...(activeOnly !== undefined ? { is_active: activeOnly } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { contact_person: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    let orderBy: Prisma.SupplierOrderByWithRelationInput = { name: sortOrder };
    if (sortBy === 'created_at') {
      orderBy = { created_at: sortOrder };
    } else if (sortBy === 'receipts_count') {
      orderBy = { stock_receipts: { _count: sortOrder } };
    }

    const [total, items] = await Promise.all([
      this.db.supplier.count({ where }),
      this.db.supplier.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: { stock_receipts: true },
          },
        },
      }),
    ]);

    const suppliers: SupplierView[] = items.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      email: s.email,
      address: s.address,
      contactPerson: s.contact_person,
      taxId: s.tax_id,
      notes: s.notes,
      isActive: s.is_active,
      receiptsCount: s._count.stock_receipts,
      createdAt: s.created_at.toISOString(),
      updatedAt: s.updated_at.toISOString(),
    }));

    return {
      suppliers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSupplierById(orgId: string, supplierId: string) {
    const supplier = await this.db.supplier.findFirst({
      where: {
        id: supplierId,
        org_id: orgId,
        deleted_at: null,
      },
      include: {
        _count: {
          select: { stock_receipts: true },
        },
        stock_receipts: {
          take: 10,
          orderBy: { receipt_date: 'desc' },
          include: {
            branch: { select: { id: true, name: true } },
            _count: { select: { items: true } },
          },
        },
      },
    });

    if (!supplier) {
      throw new AppError('SUPPLIER_NOT_FOUND', 'Supplier not found in this organization', 404);
    }

    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      contactPerson: supplier.contact_person,
      taxId: supplier.tax_id,
      notes: supplier.notes,
      isActive: supplier.is_active,
      receiptsCount: supplier._count.stock_receipts,
      createdAt: supplier.created_at.toISOString(),
      updatedAt: supplier.updated_at.toISOString(),
      recentReceipts: supplier.stock_receipts.map((r) => ({
        id: r.id,
        reference: r.reference,
        receiptDate: r.receipt_date.toISOString(),
        branchId: r.branch_id,
        branchName: r.branch.name,
        supplierInvoiceNumber: r.supplier_invoice_number,
        itemCount: r._count.items,
        status: r.status,
      })),
    };
  }

  async checkDuplicates(orgId: string, input: CheckSupplierDuplicatesInput) {
    const { name, phone, excludeId } = input;
    if (!name && !phone) {
      return { hasDuplicates: false, matches: [] };
    }

    const conditions: Prisma.SupplierWhereInput[] = [];
    if (name && name.trim().length > 0) {
      conditions.push({ name: { equals: name.trim(), mode: 'insensitive' } });
    }
    if (phone && phone.trim().length > 0) {
      conditions.push({ phone: { equals: phone.trim() } });
    }

    const matches = await this.db.supplier.findMany({
      where: {
        org_id: orgId,
        deleted_at: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: conditions,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        is_active: true,
      },
    });

    return {
      hasDuplicates: matches.length > 0,
      matches,
    };
  }

  async createSupplier(orgId: string, userId: string, input: CreateSupplierInput) {
    const trimmedName = input.name.trim();

    // Check potential duplicate warnings
    const duplicates = await this.checkDuplicates(orgId, {
      name: trimmedName,
      phone: input.phone || undefined,
    });

    const created = await this.db.supplier.create({
      data: {
        org_id: orgId,
        name: trimmedName,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        contact_person: input.contactPerson?.trim() || null,
        tax_id: input.taxId?.trim() || null,
        notes: input.notes?.trim() || null,
        is_active: input.isActive ?? true,
        created_by_user_id: userId,
      },
    });

    return {
      supplier: {
        id: created.id,
        name: created.name,
        phone: created.phone,
        email: created.email,
        address: created.address,
        contactPerson: created.contact_person,
        taxId: created.tax_id,
        notes: created.notes,
        isActive: created.is_active,
        receiptsCount: 0,
        createdAt: created.created_at.toISOString(),
        updatedAt: created.updated_at.toISOString(),
      },
      duplicateWarning: duplicates.hasDuplicates
        ? `A supplier with similar name or phone number already exists (${duplicates.matches.map((m) => m.name).join(', ')}).`
        : null,
    };
  }

  async updateSupplier(orgId: string, supplierId: string, input: UpdateSupplierInput) {
    const existing = await this.db.supplier.findFirst({
      where: { id: supplierId, org_id: orgId, deleted_at: null },
    });

    if (!existing) {
      throw new AppError('SUPPLIER_NOT_FOUND', 'Supplier not found in this organization', 404);
    }

    const updated = await this.db.supplier.update({
      where: { id: supplierId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone ? input.phone.trim() : null } : {}),
        ...(input.email !== undefined ? { email: input.email ? input.email.trim() : null } : {}),
        ...(input.address !== undefined ? { address: input.address ? input.address.trim() : null } : {}),
        ...(input.contactPerson !== undefined ? { contact_person: input.contactPerson ? input.contactPerson.trim() : null } : {}),
        ...(input.taxId !== undefined ? { tax_id: input.taxId ? input.taxId.trim() : null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes ? input.notes.trim() : null } : {}),
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      },
      include: {
        _count: {
          select: { stock_receipts: true },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      address: updated.address,
      contactPerson: updated.contact_person,
      taxId: updated.tax_id,
      notes: updated.notes,
      isActive: updated.is_active,
      receiptsCount: updated._count.stock_receipts,
      createdAt: updated.created_at.toISOString(),
      updatedAt: updated.updated_at.toISOString(),
    };
  }

  async deactivateSupplier(orgId: string, supplierId: string) {
    const existing = await this.db.supplier.findFirst({
      where: { id: supplierId, org_id: orgId, deleted_at: null },
      include: {
        _count: { select: { stock_receipts: true } },
      },
    });

    if (!existing) {
      throw new AppError('SUPPLIER_NOT_FOUND', 'Supplier not found in this organization', 404);
    }

    const updated = await this.db.supplier.update({
      where: { id: supplierId },
      data: { is_active: false },
    });

    return {
      id: updated.id,
      name: updated.name,
      isActive: updated.is_active,
      receiptsCount: existing._count.stock_receipts,
      message: 'Supplier deactivated successfully',
    };
  }

  async activateSupplier(orgId: string, supplierId: string) {
    const existing = await this.db.supplier.findFirst({
      where: { id: supplierId, org_id: orgId, deleted_at: null },
    });

    if (!existing) {
      throw new AppError('SUPPLIER_NOT_FOUND', 'Supplier not found in this organization', 404);
    }

    const updated = await this.db.supplier.update({
      where: { id: supplierId },
      data: { is_active: true },
    });

    return {
      id: updated.id,
      name: updated.name,
      isActive: updated.is_active,
      message: 'Supplier activated successfully',
    };
  }
}

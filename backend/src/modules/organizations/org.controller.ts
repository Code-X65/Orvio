import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { orgService, type OrgService } from './org.service.js';
import { sendData } from '../../lib/envelope.js';
import { AppError } from '../../lib/errors.js';

export const checkSubdomainQuerySchema = z.object({
  subdomain: z.string().min(1, 'Subdomain query param is required'),
});

export class OrgController {
  constructor(private service: OrgService = orgService) {}

  async checkSubdomain(request: FastifyRequest, reply: FastifyReply) {
    const query = checkSubdomainQuerySchema.parse(request.query);
    const result = await this.service.checkSubdomainAvailability(query.subdomain);
    return sendData(reply, result, 200);
  }

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const auth = request.auth;
    const orgId = auth?.organization?.id ?? auth?.claims?.org_id;

    if (!orgId) {
      throw new AppError('ORGANIZATION_NOT_FOUND', 'No organization associated with this session', 404);
    }

    const org = await this.service.getOrganizationById(orgId);
    if (!org) {
      throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
    }

    return sendData(reply, { organization: org }, 200);
  }
}

export const orgController = new OrgController();

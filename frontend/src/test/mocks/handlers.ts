import { http, HttpResponse } from 'msw';

export const handlers = [
  // Check Subdomain
  http.get('*/api/v1/orgs/check-subdomain', ({ request }) => {
    const url = new URL(request.url);
    const subdomain = url.searchParams.get('subdomain');

    if (subdomain === 'admin' || subdomain === 'app' || subdomain === 'api') {
      return HttpResponse.json({
        status: 'success',
        data: {
          available: false,
          subdomain,
          reason: 'RESERVED',
        },
      });
    }

    if (subdomain === 'takenstore') {
      return HttpResponse.json({
        status: 'success',
        data: {
          available: false,
          subdomain,
          reason: 'ALREADY_TAKEN',
          suggestions: ['takenstore1', 'takenstore2', 'takenstorehub'],
        },
      });
    }

    return HttpResponse.json({
      status: 'success',
      data: {
        available: true,
        subdomain: subdomain ?? 'teststore',
      },
    });
  }),

  // Register
  http.post('*/api/v1/auth/register', async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;

    if (body.email === 'duplicate@example.com') {
      return HttpResponse.json(
        {
          status: 'error',
          error: {
            code: 'RESOURCE_CONFLICT',
            message: 'An account with this email already exists.',
          },
        },
        { status: 409 }
      );
    }

    if (body.subdomain === 'takenstore') {
      return HttpResponse.json(
        {
          status: 'error',
          error: {
            code: 'RESOURCE_CONFLICT',
            message: 'Subdomain takenstore is already taken.',
            details: {
              suggestions: ['takenstore1', 'takenstore2'],
            },
          },
        },
        { status: 409 }
      );
    }

    return HttpResponse.json(
      {
        status: 'success',
        data: {
          userId: 'usr_msw_123',
          email: body.email,
          fullName: body.fullName,
          accessToken: 'msw_jwt_mock_token',
          organization: {
            id: 'org_msw_123',
            name: body.organizationName,
            subdomain: body.subdomain,
            status: 'pending',
            planCode: body.planCode ?? 'bundle',
          },
        },
      },
      { status: 201 }
    );
  }),

  // Verify Email
  http.post('*/api/v1/auth/verify-email', async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    if (body.token === 'invalid_token') {
      return HttpResponse.json(
        {
          status: 'error',
          error: {
            code: 'INVALID_TOKEN',
            message: 'The verification token is invalid or has expired.',
          },
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      status: 'success',
      data: {
        verified: true,
        user: {
          id: 'usr_verified',
          email: 'founder@example.com',
          fullName: 'Verified Founder',
          status: 'active',
          emailVerifiedAt: '2026-09-30T12:00:00Z',
        },
        organization: {
          id: 'org_verified',
          name: 'Verified Org',
          subdomain: 'verifiedorg',
          status: 'active',
        },
      },
    });
  }),

  // Resend Verification
  http.post('*/api/v1/auth/verify-email/resend', async () => {
    return HttpResponse.json({
      status: 'success',
      data: {
        sent: true,
        message: 'A new verification email has been dispatched.',
      },
    });
  }),

  // Refresh Session
  http.post('*/api/v1/auth/refresh', async () => {
    return HttpResponse.json({
      status: 'success',
      data: {
        accessToken: 'refreshed_msw_token',
        user: {
          id: 'usr_1',
          email: 'founder@example.com',
          fullName: 'Founder User',
          status: 'active',
          emailVerifiedAt: '2026-09-30T12:00:00Z',
        },
        organization: {
          id: 'org_1',
          name: 'Founder Org',
          subdomain: 'founderorg',
          status: 'active',
        },
      },
    });
  }),

  // Get Current Org
  http.get('*/api/v1/orgs/me', async () => {
    return HttpResponse.json({
      status: 'success',
      data: {
        organization: {
          id: 'org_1',
          name: 'Founder Org',
          subdomain: 'founderorg',
          status: 'active',
          url: 'https://founderorg.orvio.com',
        },
        membership: {
          id: 'mem_1',
          role: 'owner',
          status: 'active',
        },
        branch: {
          id: 'br_1',
          name: 'Default Store',
          type: 'store',
          status: 'active',
        },
      },
    });
  }),

  // Login
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    if (body.email === 'invalid@example.com') {
      return HttpResponse.json(
        {
          status: 'error',
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    if (body.subdomain === 'otherorg') {
      return HttpResponse.json(
        {
          status: 'error',
          error: {
            code: 'ORGANIZATION_ACCESS_DENIED',
            message: 'Your account does not have access to this organization workspace.',
          },
        },
        { status: 403 }
      );
    }

    return HttpResponse.json({
      status: 'success',
      data: {
        accessToken: 'msw_login_jwt',
        user: {
          id: 'usr_login_1',
          email: body.email || 'admin@company.com',
          fullName: 'Admin User',
          emailVerifiedAt: '2026-09-30T12:00:00Z',
        },
        organization: {
          id: 'org_login_1',
          name: body.subdomain ? `${body.subdomain.toUpperCase()} Org` : 'Test Org',
          subdomain: body.subdomain || 'testorg',
          status: 'active',
        },
      },
    });
  }),

  // Magic Login
  http.post('*/api/v1/auth/magic-login', async () => {
    return HttpResponse.json({
      status: 'success',
      data: {
        success: true,
        message: 'A sign-in setup link has been sent to your email.',
      },
    });
  }),
];

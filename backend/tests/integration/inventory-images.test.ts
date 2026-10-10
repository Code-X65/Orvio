import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import { createTestApp, type TestAppContext } from '../helpers/app.js';

describe('Inventory Image Management (Integration Tests)', { timeout: 120000 }, () => {
  let ctx: TestAppContext;
  let token: string;
  let testPngBuffer: Buffer;

  beforeAll(async () => {
    ctx = await createTestApp();

    testPngBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 50, g: 150, b: 250 },
      },
    })
      .png()
      .toBuffer();

    const timestamp = Date.now();
    const email = `img_test_${timestamp}@example.com`;
    const password = 'Password123!';
    const subdomain = `imgtest${timestamp.toString().slice(-6)}`;

    const regRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: {
        'x-forwarded-for': '10.0.1.50',
        'user-agent': 'ImageIntegrationTestAgent/1.0',
      },
      payload: {
        email,
        password,
        fullName: 'Image Test Manager',
        organizationName: 'Image Test Org',
        subdomain,
        termsAccepted: true,
      },
    });
    expect(regRes.statusCode).toBe(201);

    const emailSent = ctx.emailSender.findVerificationEmail(email);
    expect(emailSent).toBeDefined();

    const verifyRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: emailSent!.token },
    });
    expect(verifyRes.statusCode).toBe(200);
    token = verifyRes.json().data.accessToken as string;

    await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/onboarding/setup',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        defaultBranchName: 'Main Store',
        seedDefaultCategories: true,
      },
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  function createMultipartPayload(
    files: Array<{ name: string; filename: string; contentType: string; data: Buffer }>
  ) {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const chunks: Buffer[] = [];
    for (const file of files) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
        )
      );
      chunks.push(file.data);
      chunks.push(Buffer.from('\r\n'));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return {
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${token}`,
      },
      payload: Buffer.concat(chunks),
    };
  }

  it('uploads product images with auto-generated thumbnails and auto-promoted primary flag', async () => {
    // 1. Create a product
    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Visual Test Product',
        costPrice: 500,
        sellingPrice: 1000,
      },
    });
    expect(prodRes.statusCode).toBe(201);
    const product = prodRes.json().data.product;

    // 2. Upload 2 images
    const multipart = createMultipartPayload([
      { name: 'file1', filename: 'product-front.png', contentType: 'image/png', data: testPngBuffer },
      { name: 'file2', filename: 'product-back.png', contentType: 'image/png', data: testPngBuffer },
    ]);

    const uploadRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/images`,
      ...multipart,
    });
    expect(uploadRes.statusCode).toBe(201);
    const images = uploadRes.json().data.images;
    expect(images).toHaveLength(2);
    expect(images[0].is_primary).toBe(true);
    expect(images[0].thumbnail_200).toContain('/uploads/products/');
    expect(images[0].thumbnail_400).toBeDefined();
    expect(images[1].is_primary).toBe(false);

    // 3. List images
    const listRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${product.id}/images`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data.images).toHaveLength(2);
  });

  it('rejects uploads of unsupported file types', async () => {
    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Invalid Type Test Product',
        costPrice: 100,
        sellingPrice: 200,
      },
    });
    const product = prodRes.json().data.product;

    const multipart = createMultipartPayload([
      { name: 'badfile', filename: 'document.txt', contentType: 'text/plain', data: Buffer.from('hello world') },
    ]);

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/images`,
      ...multipart,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_IMAGE_TYPE');
  });

  it('enforces maximum image limit and returns IMAGE_COUNT_EXCEEDED (422)', async () => {
    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Quota Limit Product',
        costPrice: 100,
        sellingPrice: 200,
      },
    });
    const product = prodRes.json().data.product;

    // Upload 5 images (the default system limit)
    const fiveFiles = Array.from({ length: 5 }).map((_, i) => ({
      name: `file${i}`,
      filename: `img${i}.png`,
      contentType: 'image/png',
      data: testPngBuffer,
    }));
    const uploadRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/images`,
      ...createMultipartPayload(fiveFiles),
    });
    expect(uploadRes.statusCode).toBe(201);

    // Try to upload a 6th image
    const sixthRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/images`,
      ...createMultipartPayload([
        { name: 'extra', filename: 'extra.png', contentType: 'image/png', data: testPngBuffer },
      ]),
    });
    expect(sixthRes.statusCode).toBe(422);
    expect(sixthRes.json().error.code).toBe('IMAGE_COUNT_EXCEEDED');
  });

  it('supports updating alt text and changing primary image', async () => {
    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Alt and Primary Test Product',
        costPrice: 100,
        sellingPrice: 200,
      },
    });
    const product = prodRes.json().data.product;

    const uploadRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/images`,
      ...createMultipartPayload([
        { name: 'f1', filename: 'img1.png', contentType: 'image/png', data: testPngBuffer },
        { name: 'f2', filename: 'img2.png', contentType: 'image/png', data: testPngBuffer },
      ]),
    });
    const [img1, img2] = uploadRes.json().data.images;

    // Update img2 to be primary and set alt text
    const patchRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/products/${product.id}/images/${img2.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        altText: 'Second angle shot',
        isPrimary: true,
      },
    });
    expect(patchRes.statusCode).toBe(200);
    const updatedImg2 = patchRes.json().data.image;
    expect(updatedImg2.is_primary).toBe(true);
    expect(updatedImg2.alt_text).toBe('Second angle shot');

    // Verify img1 is no longer primary
    const listRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${product.id}/images`,
      headers: { authorization: `Bearer ${token}` },
    });
    const images = listRes.json().data.images;
    const reloadedImg1 = images.find((i: any) => i.id === img1.id);
    expect(reloadedImg1.is_primary).toBe(false);
  });

  it('supports reordering images and auto-promoting next primary on image delete', async () => {
    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Reorder and Delete Test Product',
        costPrice: 100,
        sellingPrice: 200,
      },
    });
    const product = prodRes.json().data.product;

    const uploadRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/images`,
      ...createMultipartPayload([
        { name: 'f1', filename: 'img1.png', contentType: 'image/png', data: testPngBuffer },
        { name: 'f2', filename: 'img2.png', contentType: 'image/png', data: testPngBuffer },
      ]),
    });
    const [img1, img2] = uploadRes.json().data.images;

    // Reorder images
    const reorderRes = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/v1/inventory/products/${product.id}/images/reorder`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        images: [
          { id: img1.id, sortOrder: 1 },
          { id: img2.id, sortOrder: 0 },
        ],
      },
    });
    expect(reorderRes.statusCode).toBe(200);

    // Delete primary image img1
    const delRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/products/${product.id}/images/${img1.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(delRes.statusCode).toBe(200);

    // Verify remaining image img2 was auto-promoted to primary
    const listRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${product.id}/images`,
      headers: { authorization: `Bearer ${token}` },
    });
    const images = listRes.json().data.images;
    expect(images).toHaveLength(1);
    expect(images[0].id).toBe(img2.id);
    expect(images[0].is_primary).toBe(true);
  });

  it('supports variant images upload and parent inheritance fallback', async () => {
    // 1. Create product with variants
    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'T-Shirt Multi-Color',
        costPrice: 100,
        sellingPrice: 200,
        hasVariants: true,
      },
    });
    const product = prodRes.json().data.product;

    // 2. Upload 1 parent image
    await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/images`,
      ...createMultipartPayload([
        { name: 'p1', filename: 'parent.png', contentType: 'image/png', data: testPngBuffer },
      ]),
    });

    // 3. Create two variants: Red and Blue
    const var1Res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        costPrice: 100,
        sellingPrice: 200,
        attributes: { color: 'Red', size: 'M' },
      },
    });
    const varRed = var1Res.json().data.variant;

    const var2Res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/variants`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        costPrice: 100,
        sellingPrice: 200,
        attributes: { color: 'Blue', size: 'M' },
      },
    });
    const varBlue = var2Res.json().data.variant;

    // 4. Check Blue variant images (none uploaded) -> returns parent images with isInherited: true
    const fallbackRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${varBlue.id}/variant-images`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(fallbackRes.statusCode).toBe(200);
    expect(fallbackRes.json().data.isInherited).toBe(true);
    expect(fallbackRes.json().data.images).toHaveLength(1);

    // 5. Upload variant-specific image to Red variant
    const varUploadRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/products/${product.id}/variants/${varRed.id}/images`,
      ...createMultipartPayload([
        { name: 'v1', filename: 'red-shirt.png', contentType: 'image/png', data: testPngBuffer },
      ]),
    });
    expect(varUploadRes.statusCode).toBe(201);

    // 6. Check Red variant images -> returns variant-specific images with isInherited: false
    const redRes = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/inventory/products/${varRed.id}/variant-images`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(redRes.statusCode).toBe(200);
    expect(redRes.json().data.isInherited).toBe(false);
    expect(redRes.json().data.images).toHaveLength(1);
    expect(redRes.json().data.images[0].variant_id).toBe(varRed.id);
  });

  it('supports category image upload and deletion', async () => {
    // 1. Create a category
    const catRes = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/inventory/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Footwear & Shoes',
      },
    });
    expect(catRes.statusCode).toBe(201);
    const category = catRes.json().data.category;

    // 2. Upload category image
    const uploadRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/inventory/categories/${category.id}/image`,
      ...createMultipartPayload([
        { name: 'catImg', filename: 'shoes.png', contentType: 'image/png', data: testPngBuffer },
      ]),
    });
    expect(uploadRes.statusCode).toBe(200);
    const updatedCategory = uploadRes.json().data.category;
    expect(updatedCategory.image_url).toBeDefined();
    expect(updatedCategory.image_url).toContain(`/uploads/categories/`);

    // 3. Delete category image
    const delRes = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/v1/inventory/categories/${category.id}/image`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().data.category.image_url).toBeNull();
  });
});

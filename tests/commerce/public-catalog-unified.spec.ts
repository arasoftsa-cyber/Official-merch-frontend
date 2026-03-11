import { expect, test, type Page } from '@playwright/test';
import { UI_BASE_URL } from '../_env';

const mockArtists = async (page: Page, count: number) => {
  const items = Array.from({ length: count }).map((_, index) => ({
    id: `artist-${index + 1}`,
    handle: `artist-${index + 1}`,
    name: `Artist ${index + 1}`,
    profile_photo_url: '',
  }));

  await page.route(/\/api\/artists(?:[/?#]|$)/i, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items }),
    });
  });
};

const mockDrops = async (page: Page, count: number) => {
  const items = Array.from({ length: count }).map((_, index) => ({
    id: `drop-${index + 1}`,
    handle: `drop-${index + 1}`,
    title: `Drop ${index + 1}`,
    starts_at: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
  }));

  await page.route(/\/api\/drops\/featured(?:[/?#]|$)/i, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items }),
    });
  });
};

const mockProducts = async (page: Page) => {
  const items = [
    {
      id: 'product-1',
      title: 'Vintage Tee',
      artist_name: 'Artist A',
      created_at: '2026-01-02T00:00:00.000Z',
      price: 29.99,
    },
    {
      id: 'product-2',
      title: 'Tour Hoodie',
      artist_name: 'Artist B',
      created_at: '2026-01-04T00:00:00.000Z',
      price: 59.99,
    },
    {
      id: 'product-3',
      title: 'Collector Cap',
      artist_name: 'Artist C',
      created_at: '2026-01-06T00:00:00.000Z',
      price: 19.99,
    },
  ];

  await page.route(/\/api\/products(?:[/?#]|$)/i, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items }),
    });
  });
};

test.describe('Public catalog unified UX', () => {
  test('/artists renders shared toolbar, card grid, and pagination', async ({ page }) => {
    await mockArtists(page, 14);
    await page.goto(`${UI_BASE_URL}/artists`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('public-catalog-toolbar')).toBeVisible();
    await expect(page.getByTestId('public-catalog-grid')).toBeVisible();
    await expect(page.getByTestId('artist-catalog-card')).toHaveCount(12);
    await expect(page.getByTestId('public-catalog-pagination')).toBeVisible();

    await page.getByRole('button', { name: /next/i }).click();
    await expect(page.getByTestId('artist-catalog-card')).toHaveCount(2);
  });

  test('/drops renders card grid (not row list) with pagination', async ({ page }) => {
    await mockDrops(page, 14);
    await page.goto(`${UI_BASE_URL}/drops`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('public-catalog-toolbar')).toBeVisible();
    await expect(page.getByTestId('public-catalog-grid')).toBeVisible();
    await expect(page.getByTestId('drop-catalog-card')).toHaveCount(12);
    await expect(page.getByTestId('public-catalog-pagination')).toBeVisible();

    await page.getByRole('button', { name: /next/i }).click();
    await expect(page.getByTestId('drop-catalog-card')).toHaveCount(2);
  });

  test('/products sort dropdown is readable and operable in dark mode', async ({ page }) => {
    await mockProducts(page);
    await page.goto(`${UI_BASE_URL}/products`, { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });

    const sortSelect = page.getByTestId('public-catalog-sort');
    await expect(sortSelect).toBeVisible();

    const computed = await sortSelect.evaluate((node) => {
      const styles = getComputedStyle(node);
      return {
        color: styles.color,
        backgroundColor: styles.backgroundColor,
      };
    });

    expect(computed.color).not.toBe(computed.backgroundColor);

    await sortSelect.selectOption('newest');
    await expect(sortSelect).toHaveValue('newest');
  });

  test('/products renders empty-state for successful empty response', async ({ page }) => {
    await page.route(/\/api\/products(?:[/?#]|$)/i, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.goto(`${UI_BASE_URL}/products`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('No products yet')).toBeVisible();
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0);
  });

  test('/products renders error-state when API request fails', async ({ page }) => {
    await page.route(/\/api\/products(?:[/?#]|$)/i, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal_server_error', message: 'Internal Server Error' }),
      });
    });

    await page.goto(`${UI_BASE_URL}/products`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Something went wrong')).toBeVisible();
    await expect(page.getByText('No products yet')).toHaveCount(0);
  });

  test('public catalog pages load with shared structure', async ({ page }) => {
    await mockArtists(page, 4);
    await mockDrops(page, 4);
    await mockProducts(page);

    await page.goto(`${UI_BASE_URL}/artists`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Artists', exact: true })).toBeVisible();

    await page.goto(`${UI_BASE_URL}/drops`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Drops', exact: true })).toBeVisible();

    await page.goto(`${UI_BASE_URL}/products`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Merch catalog', exact: true })).toBeVisible();
  });
});

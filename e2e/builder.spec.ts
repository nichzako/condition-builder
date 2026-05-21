import { test, expect } from '@playwright/test'

test.describe('Condition Builder — golden path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/builder')
  })

  // --- Page load ---

  test('loads the builder page with all panels', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'RUN' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Fields' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Condition' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Result' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible()
  })

  // --- Empty states ---

  test('shows empty state messages when no tables/conditions/results', async ({ page }) => {
    await expect(page.getByText('No fields yet')).toBeVisible()
    await expect(page.getByText('No conditions yet')).toBeVisible()
    await expect(page.getByText('No results yet')).toBeVisible()
  })

  // --- Field panel ---

  test('adds a table and field', async ({ page }) => {
    const fieldPanel = page.getByRole('region', { name: 'Fields' })

    // Add a table
    await page.getByRole('button', { name: 'Add Field +' }).click()
    await expect(fieldPanel.getByTitle('Click to rename')).toHaveText('Table 1')

    // Add a field to the table
    await page.getByRole('button', { name: 'Add field to Table 1' }).click()
    await page.getByPlaceholder('Field name…').fill('Score')
    await page.getByPlaceholder('Field name…').press('Enter')

    await expect(fieldPanel.getByText('Score')).toBeVisible()
  })

  test('removes a table', async ({ page }) => {
    const fieldPanel = page.getByRole('region', { name: 'Fields' })

    await page.getByRole('button', { name: 'Add Field +' }).click()
    await expect(fieldPanel.getByTitle('Click to rename')).toHaveText('Table 1')

    await page.getByRole('button', { name: 'Remove table Table 1' }).click()
    await expect(page.getByText('No fields yet')).toBeVisible()
  })

  // --- Condition panel ---

  test('adds and removes a condition', async ({ page }) => {
    await page.getByRole('button', { name: 'Add condition' }).click()
    // Condition row appears (row 1)
    await expect(page.getByRole('button', { name: 'Remove condition 1' })).toBeVisible()

    await page.getByRole('button', { name: 'Remove condition 1' }).click()
    await expect(page.getByText('No conditions yet')).toBeVisible()
  })

  test('can type a literal value in condition right slot', async ({ page }) => {
    await page.getByRole('button', { name: 'Add condition' }).click()

    // Right slot starts in field mode — switch to literal
    await page.getByTitle('Switch to literal value').first().click()
    const literalInput = page.getByPlaceholder('value…').first()
    await literalInput.fill('100')
    await expect(literalInput).toHaveValue('100')
  })

  // --- Result panel ---

  test('adds and removes a result', async ({ page }) => {
    await page.getByRole('button', { name: 'Add result' }).click()
    await expect(page.getByRole('button', { name: 'Remove result 1' })).toBeVisible()

    await page.getByRole('button', { name: 'Remove result 1' }).click()
    await expect(page.getByText('No results yet')).toBeVisible()
  })

  // --- RUN with literal formula ---

  test('RUN evaluates a literal formula and shows result in preview', async ({ page }) => {
    // Add result
    await page.getByRole('button', { name: 'Add result' }).click()

    // Expression starts as field drop zone — switch to literal via "abc" button
    await page.getByRole('button', { name: 'Switch to literal value' }).first().click()

    // Type literal value
    const literalInput = page.getByLabel('Literal value').first()
    await literalInput.fill('42')

    // Click RUN
    await page.getByRole('button', { name: 'RUN' }).click()

    // Wait for preview to show results
    await expect(page.getByText('Results')).toBeVisible()
    await expect(page.getByText('42')).toBeVisible()
  })

  // --- Responsive ---

  test('renders correctly at tablet width (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.getByRole('button', { name: 'RUN' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Fields' })).toBeVisible()
  })
})

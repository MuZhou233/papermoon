import { test, expect, type Page } from '@playwright/test'
import { startEditorServer } from './server.ts'
let server: Awaited<ReturnType<typeof startEditorServer>>
test.beforeAll(async () => {
  server = await startEditorServer()
})
test.afterAll(async () => {
  await server?.stop()
})
async function login(page: Page) {
  await page.addLocatorHandler(
    page.getByRole('button', { name: 'Continue', exact: true }),
    async () => {
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
    },
  )
  await page.goto(server.url)
  await page
    .getByRole('button', { name: 'Configure later', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Writer management', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Writer management', exact: true }),
  ).toBeVisible()
}
async function api(page: Page, method: string, payload: unknown, namespace = 'papermoon-writers') {
  const response = await page.request.post(
    new URL('/api/' + namespace + '/' + method, server.url).href,
    {
      data: {
        type: 'client-request',
        rpcId: crypto.randomUUID(),
        method: namespace + '/' + method,
        payload,
      },
    },
  )
  expect(response.status()).toBe(200)
  const result = await response.json()
  expect(result.result.ok, JSON.stringify(result)).toBe(true)
  return result.result.value
}
async function createWriter(page: Page, name: string, description = '') {
  await page.getByRole('button', { name: 'New writer', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New writer', exact: true })
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(name)
  await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(description)
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}
test('writer settings preserve literal roles, preview, messages and read-only tools', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await login(page)
  const writerButton = page.getByRole('button', {
    name: 'Writer management',
    exact: true,
  })
  const settingsButton = page.getByRole('button', {
    name: 'Settings',
    exact: true,
  })
  const writerBounds = await writerButton.boundingBox(),
    settingsBounds = await settingsButton.boundingBox()
  expect(writerBounds!.y).toBeLessThan(settingsBounds!.y)
  expect(writerBounds!.x).toBeCloseTo(settingsBounds!.x, 1)
  const writerIcon = await writerButton.locator('svg').boundingBox(),
    settingsIcon = await settingsButton.locator('svg').boundingBox()
  expect(writerIcon!.x).toBeCloseTo(settingsIcon!.x, 1)
  expect(writerIcon!.width).toBe(settingsIcon!.width)
  expect(await api(page, 'list', {})).toEqual([])
  await expect(page.getByText('No writers yet. Create one to configure its prompts.', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(0)
  await page.getByRole('button', { name: 'New writer', exact: true }).click()
  const createDialog = page.getByRole('dialog', { name: 'New writer', exact: true })
  await createDialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Not created')
  await createDialog.getByRole('textbox', { name: 'Description', exact: true }).fill('Not persisted')
  expect(await api(page, 'list', {})).toEqual([])
  await createDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(await api(page, 'list', {})).toEqual([])
  await createWriter(page, 'Literary writer', 'Initial description')
  await page.locator('[data-prompt-message=system]').click()
  await expect(page.locator('[data-prompt-content]')).toHaveText('你是 PaperMoon 的编剧助手。')
  await expect(page.locator('[data-prompt-role]')).toHaveText(['system'])
  await page.getByRole('tab', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  const nameBox = await page.getByRole('textbox', { name: 'Name', exact: true }).boundingBox(),
    descriptionBox = await page.getByRole('textbox', { name: 'Description', exact: true }).boundingBox()
  expect(descriptionBox!.y).toBeGreaterThan(nameBox!.y + nameBox!.height)
  expect(descriptionBox!.x).toBeCloseTo(nameBox!.x, 1)
  await expect(page.getByText('Saved', { exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Prompts', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'System prompt', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Initial context preview', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tabpanel', { name: 'Prompts', exact: true }).getByRole('button', { name: 'Exit editing', exact: true })).toBeVisible()
  await expect(page.locator('.pw-toolbar').getByRole('button')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'System prompt name', exact: true }).fill('Core role')
  await page
    .getByRole('textbox', { name: 'System prompt', exact: true })
    .fill('Literal {{player}}\nKeep these words.')
  for (let i = 1; i <= 2; i++) {
    await page.getByRole('button', { name: 'Add message', exact: true }).click()
    await page.getByRole('textbox', { name: 'Message name ' + i, exact: true }).fill(i === 1 ? 'Instructions' : 'Acknowledgement')
    await page
      .getByRole('textbox', { name: 'Message text ' + i, exact: true })
      .fill(i === 1 ? 'User instruction' : 'Assistant response')
  }
  const row = page.getByRole('region', { name: 'Initial messages 2', exact: true })
  await expect(row.getByRole('group', { name: 'Message role', exact: true }).locator('span').first()).toHaveText('Message role')
  await expect(row.getByLabel('Message number 2', { exact: true })).toHaveText('#2')
  const nameField = row.getByRole('textbox', { name: 'Message name 2', exact: true }).locator('..'),
    roleField = row.getByRole('button', { name: 'Message role', exact: true }),
    nameBounds = await nameField.boundingBox(), roleBounds = await roleField.boundingBox()
  expect(nameBounds!.y).toBeCloseTo(roleBounds!.y, 1)
  expect(nameBounds!.height).toBe(roleBounds!.height)
  for (const field of [nameField, roleField, row.getByRole('textbox', { name: 'Message text 2', exact: true })])
    await expect(field).toHaveCSS('border-top-left-radius', '8px')
  const copyColor = await row.getByRole('button', { name: 'Duplicate message', exact: true }).evaluate((el) => getComputedStyle(el).color)
  await expect(row.getByRole('button', { name: 'Delete message', exact: true })).not.toHaveCSS('color', copyColor)
  await page.screenshot({ path: 'test-results/papermoon-writers-edit.png', fullPage: true })
  await page
    .getByRole('region', { name: 'Initial messages 2', exact: true })
    .getByRole('button', { name: 'Message role', exact: true })
    .click()
  await expect(page.getByRole('menuitem', { name: /user Instructions or information/ })).toBeVisible()
  await page.getByRole('menuitem', { name: /assistant A reply supplied/ }).click()
  await page
    .getByRole('region', { name: 'Initial messages 2', exact: true })
    .getByRole('button', { name: 'Move up', exact: true })
    .click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Exit editing', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'System prompt', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add message', exact: true })).toHaveCount(0)
  await page.locator('[data-prompt-message=system]').click()
  await expect(page.locator('[data-prompt-content]')).toBeVisible()
  await expect(page.locator('[data-prompt-role]')).toHaveText([
    'system',
    'assistant',
    'user',
  ])
  await expect(page.locator('[data-prompt-name]')).toHaveText(['Core role', 'Acknowledgement', 'Instructions'])
  await page.locator('[data-prompt-message=assistant]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-prompt-content]')).toHaveText('Assistant response')
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[data-prompt-content]')).toHaveText('User instruction')
  const writers = await api(page, 'list', {}),
    writer = writers.find(
      (item: { name: string }) => item.name === 'Literary writer',
    )
  expect(writer.systemPromptName).toBe('Core role')
  expect(writer.messages.map((m: { name: string }) => m.name)).toEqual(['Acknowledgement', 'Instructions'])
  expect(await api(page, 'context', { id: writer.id })).toEqual({
    systemPrompt: 'Literal {{player}}\nKeep these words.',
    messages: [
      { role: 'assistant', content: 'Assistant response' },
      { role: 'user', content: 'User instruction' },
    ],
  })
  await page.getByRole('tab', { name: 'Tools', exact: true }).click()
  await expect(page.locator('.pw-tool')).toHaveCount(16)
  await page
    .getByRole('textbox', { name: 'Search tools', exact: true })
    .fill('playbook_program_edit')
  await page.locator('.pw-tool summary').click()
  await expect(page.locator('.pw-tool')).toContainText('replace-text')
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await page.reload()
  await page
    .getByRole('button', { name: 'Configure later', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Literary writer', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('tab', { name: 'Tools', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Prompts', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'System prompt', exact: true })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/papermoon-writers-view.png', fullPage: true })
  await page.setViewportSize({ width: 700, height: 950 })
  await page.screenshot({
    path: 'test-results/papermoon-writers-narrow.png',
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await expect(
    page.getByRole('button', { name: 'Writer management', exact: true }),
  ).toHaveAttribute('data-wide', 'false')
  await expect(
    page.getByRole('button', { name: 'Writer management', exact: true }),
  ).toHaveText('')
  await expect.poll(async () => {
    const writer = await writerButton.boundingBox(), settings = await settingsButton.boundingBox()
    return Math.abs(writer!.x - settings!.x) + Math.abs(writer!.width - settings!.width)
  }).toBeCloseTo(0, 1)
  await page
    .getByRole('button', { name: 'Writer management', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Writer management', exact: true }),
  ).toBeVisible()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({
    path: 'test-results/papermoon-writers-dark.png',
    fullPage: true,
  })
  expect(errors).toEqual([])
})
test('writer navigation and conflicts retain edits, deletion and authentication use management API', async ({
  page,
}) => {
  await login(page)
  await createWriter(page, 'Navigation writer')
  await page.getByRole('tab', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await page.reload()
  await page.getByRole('button', { name: 'Configure later', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Prompts', exact: true }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'System prompt', exact: true }).fill('pending prompt')
  await page.getByRole('button', { name: 'Exit editing', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Exit editing', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Playbooks', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Save your changes?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(
    page.getByRole('textbox', { name: 'System prompt', exact: true }),
  ).toHaveValue('pending prompt')
  const writer = (await api(page, 'list', {})).find(
    (item: { name: string }) => item.name === 'Navigation writer',
  )
  const {
    id,
    sequence,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...definition
  } = writer
  await api(page, 'update', {
    id,
    expectedSequence: sequence,
    definition: { ...definition, systemPrompt: 'external prompt' },
  })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('changed')
  await expect(
    page.getByRole('textbox', { name: 'System prompt', exact: true }),
  ).toHaveValue('pending prompt')
  await page
    .getByRole('button', { name: 'Reload saved settings', exact: true })
    .click()
  await page.getByRole('button', { name: 'Discard', exact: true }).click()
  await page.locator('[data-prompt-message=system]').click()
  await expect(page.locator('[data-prompt-content]')).toHaveText('external prompt')
  await page.getByRole('tab', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Delete writer', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete writer', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Literary writer', exact: true }),
  ).toBeVisible()
  expect(
    (await api(page, 'list', {})).some(
      (item: { id: string }) => item.id === id,
    ),
  ).toBe(false)
  const unauthenticated = await fetch(
    new URL('/api/papermoon-writers/list', server.url),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: 'anonymous',
        method: 'papermoon-writers/list',
        payload: {},
      }),
    },
  )
  expect(unauthenticated.status).toBe(401)
})

test('tab changes check saves and keep edits on cancel', async ({ page }) => {
  await login(page)
  await createWriter(page, 'Before tab edit')
  await page.getByRole('tab', { name: 'Settings', exact: true }).click()
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Tab writer')
  await page.getByRole('tab', { name: 'Prompts', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Tab writer')
  await page.getByRole('tab', { name: 'Prompts', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Prompts', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'System prompt', exact: true }).fill('discard this')
  await page.getByRole('tab', { name: 'Tools', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Tools', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Prompts', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'System prompt', exact: true })).toHaveCount(0)
  await page.locator('[data-prompt-message=system]').click()
  await expect(page.locator('[data-prompt-content]')).not.toContainText('discard this')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'System prompt', exact: true }).fill('keep this')
  await page.getByRole('tab', { name: 'Settings', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Settings', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Prompts', exact: true }).click()
  await page.locator('[data-prompt-message=system]').click()
  await expect(page.locator('[data-prompt-content]')).toHaveText('keep this')
})


test('copy confirmation preserves prompts and deleting every writer leaves an empty list after reload', async ({ page }) => {
  await login(page)
  await createWriter(page, 'Copy source', 'Source description')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'System prompt', exact: true }).fill('A distinct prompt')
  await page.getByRole('tab', { name: 'Settings', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
  const before = await api(page, 'list', {})
  await page.getByRole('button', { name: 'Duplicate writer', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Duplicate writer', exact: true })
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Copy source (copy)')
  await expect(dialog.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('Source description')
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Cancelled copy')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(await api(page, 'list', {})).toHaveLength(before.length)
  await page.getByRole('button', { name: 'Duplicate writer', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(' ')
  await expect(dialog.getByRole('button', { name: 'Create copy', exact: true })).toBeDisabled()
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Confirmed copy')
  await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill('Copy description')
  expect(await api(page, 'list', {})).toHaveLength(before.length)
  await page.screenshot({ path: 'test-results/papermoon-writer-copy-dialog.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.left >= 0 && bounds.right <= innerWidth
  })).toBe(true)
  await dialog.getByRole('button', { name: 'Create copy', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Confirmed copy', exact: true })).toBeVisible()
  await page.locator('[data-prompt-message=system]').click()
  await expect(page.locator('[data-prompt-content]')).toHaveText('A distinct prompt')
  const writers = await api(page, 'list', {})
  const copied = writers.find((writer: { name: string }) => writer.name === 'Confirmed copy')
  expect(copied.description).toBe('Copy description')
  expect(writers.find((writer: { name: string }) => writer.name === 'Copy source').description).toBe('Source description')
  // Delete only this server's temporary records to exercise the final visible writer.
  for (const writer of writers)
    if (writer.id !== copied.id)
      await api(page, 'delete', { id: writer.id, expectedSequence: writer.sequence })
  await page.reload()
  await page.getByRole('button', { name: 'Configure later', exact: true }).click()
  await page.getByRole('tab', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Delete writer', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete writer', exact: true }).click()
  await expect(page.getByText('No writers yet. Create one to configure its prompts.', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Configure later', exact: true }).click()
  expect(await api(page, 'list', {})).toEqual([])
  await expect(page.getByText('No writers yet. Create one to configure its prompts.', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/papermoon-writers-empty.png', fullPage: true })
})


test('unavailable navigation preference storage does not turn a successful save into an error', async ({ page }) => {
  await login(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) {
      if (key === 'papermoon.writers.position')
        throw new DOMException('Preference quota exhausted', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await createWriter(page, 'Writer without browser preferences')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'System prompt', exact: true }).fill('Persist this prompt')
  await page.getByRole('tab', { name: 'Tools', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Tools', exact: true })).toHaveAttribute('aria-selected', 'true')
  const writer = (await api(page, 'list', {})).find((item: { name: string }) => item.name === 'Writer without browser preferences')
  expect(writer.systemPrompt).toBe('Persist this prompt')
})


test('accepted writer navigation opens the overview and preserves unsaved source', async ({ page }) => {
  await login(page)
  const playbookApi = (method: string, payload: unknown) => api(page, method, payload, 'papermoon')
  const project = await playbookApi('createProject', { name: 'Page navigation' })
  const playbook = await playbookApi('createPlaybook', {
    projectId: project.id, name: 'Unfinished playbook', defaultLanguage: 'en',
  })
  await playbookApi('save', {
    playbookId: playbook.id, expectedSequence: 0,
    operations: [{ kind: 'create-file', path: 'main.js', source: 'saved source' }],
  })
  await page.evaluate((id) => { location.hash = '#papermoon/' + id + '?tab=draft' }, playbook.id)
  await page.getByRole('tab', { name: 'Draft', exact: true }).click()
  await page.getByRole('button', { name: 'main.js', exact: true }).click()
  await page.locator('.cm-content[contenteditable=true]').fill('unsaved source')
  await page.getByRole('button', { name: 'Writer management', exact: true }).click()
  await createWriter(page, 'Page switching writer')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'System prompt', exact: true }).fill('saved writer prompt')
  await page.getByRole('button', { name: 'Playbooks', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Playbooks', exact: true })).toBeVisible()
  await expect.poll(() => new URL(page.url()).hash).toBe('#papermoon')
  await page.locator('.pm-playbook-card').filter({ hasText: 'Unfinished playbook' }).click()
  await page.getByRole('tab', { name: 'Draft', exact: true }).click()
  await page.getByRole('button', { name: 'main.js', exact: true }).click()
  await expect(page.locator('.cm-content[contenteditable=true]')).toContainText('unsaved source')
  await expect.poll(() => new URL(page.url()).hash).toBe('#papermoon/' + playbook.id + '?tab=draft')
  await page.getByRole('button', { name: 'Writer management', exact: true }).click()
  await page.locator('[data-prompt-message=system]').click()
  await expect(page.locator('[data-prompt-content]')).toHaveText('saved writer prompt')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('textbox', { name: 'System prompt', exact: true }).fill('discarded writer prompt')
  await page.getByRole('button', { name: 'Playbooks', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Playbooks', exact: true })).toBeVisible()
  await expect.poll(() => new URL(page.url()).hash).toBe('#papermoon')
  await page.locator('.pm-playbook-card').filter({ hasText: 'Unfinished playbook' }).click()
  await page.getByRole('tab', { name: 'Draft', exact: true }).click()
  await page.getByRole('button', { name: 'main.js', exact: true }).click()
  await expect(page.locator('.cm-content[contenteditable=true]')).toContainText('unsaved source')
  await page.getByRole('button', { name: 'Writer management', exact: true }).click()
  await page.locator('[data-prompt-message=system]').click()
  await expect(page.locator('[data-prompt-content]')).toHaveText('saved writer prompt')
})


test('playbook overview is the destination when writer management was opened from a conversation', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: 'New session', exact: true }).last().click()
  await expect.poll(() => new URL(page.url()).hash).toBe('#conversation')
  await page.getByRole('button', { name: 'Writer management', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Writer management', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Playbooks', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Playbooks', exact: true })).toBeVisible()
  await expect.poll(() => new URL(page.url()).hash).toBe('#papermoon')
  await page.reload()
  await page.getByRole('button', { name: 'Configure later', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Playbooks', exact: true })).toBeVisible()
})

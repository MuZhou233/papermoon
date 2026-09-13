import { test, expect, type Page } from '@playwright/test'
import { startEditorServer } from './server.ts'
let server: Awaited<ReturnType<typeof startEditorServer>>
test.beforeAll(async () => {
  server = await startEditorServer()
})
test.afterAll(async () => {
  await server?.stop()
})
async function rpc(page: Page, method: string, payload: unknown) {
  const response = await page.request.post(
    new URL('/api/papermoon/' + method, server.url).href,
    {
      data: {
        type: 'client-request',
        rpcId: crypto.randomUUID(),
        method: 'papermoon/' + method,
        payload,
      },
    },
  )
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.result.ok, JSON.stringify(body)).toBe(true)
  return body.result.value
}
// The isolated profile has no model configuration. Finish onboarding before editing.
async function goto(page: Page, url: string) {
  const response = await page.goto(url)
  // Hash navigation keeps the existing document and does not reopen onboarding.
  if (response) {
    await page
      .getByRole('button', { name: 'Configure later', exact: true })
      .click()
  }
}
async function reload(page: Page) {
  await page.reload()
  await page
    .getByRole('button', { name: 'Configure later', exact: true })
    .click()
}
async function login(page: Page) {
  await page.addLocatorHandler(
    page.getByRole('button', { name: 'Continue', exact: true }),
    async () => {
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
    },
  )
  await goto(page, server.url)
  await expect(
    page.getByRole('heading', { name: 'Scripts', exact: true }),
  ).toBeVisible()
}
test('explicit compilation saves artifacts and previews exact roles after refresh', async ({ page }) => {
  await login(page)
  const project = await rpc(page, 'createProject', { name: 'Compilation' })
  const script = await rpc(page, 'createScript', { projectId: project.id, name: 'Opening', defaultLanguage: 'en' })
  await goto(page, new URL('/#papermoon/' + script.id + '?tab=draft', server.url).href)
  const panel = page.getByRole('region', { name: 'Compilation', exact: true })
  await expect(panel.getByRole('status')).toHaveText('Not compiled')
  await expect(panel.locator('.pm-diagnostics')).toHaveCount(0)
  await rpc(page, 'save', { scriptId: script.id, expectedSequence: 0, operations: [
    { kind: 'create-file', path: 'story.js', source: 'const {t}=require("@papermoon/story");module.exports={systemPrompt:t("system"),messages:[{name:"Background",role:"user",content:"{{literal}}"},{role:"user",content:""},{role:"assistant",content:"Opening"}]};' },
    { kind: 'create-text', key: 'system' }, { kind: 'set-translation', key: 'system', language: 'en', text: 'Writer system' },
    { kind: 'add-language', language: 'zh-CN' }, { kind: 'set-translation', key: 'system', language: 'zh-CN', text: '起始设定' },
  ] })
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await panel.getByRole('button', { name: 'Compile', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveText('Compiled')
  await expect(panel).toContainText('Writer system')
  await expect(panel).toContainText('{{literal}}')
  await expect(panel).toContainText('Background')
  await panel.screenshot({ path: 'test-results/papermoon-opening-preview.png' })
  await reload(page)
  await expect(panel.getByRole('status')).toHaveText('Compiled')
  await panel.getByRole('button', { name: 'Compilation language', exact: true }).click()
  await page.getByRole('menuitem', { name: 'zh-CN', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('earlier')
  await panel.getByRole('button', { name: 'Compile', exact: true }).click()
  await expect(panel).toContainText('起始设定')
  await page.getByRole('button', { name: 'story.js', exact: true }).click()
  const code = page.locator('.cm-content[contenteditable=true]')
  await code.fill('module.exports={systemPrompt:"Edited",messages:[]};')
  await expect(panel.getByRole('status')).toContainText('earlier')
  await panel.getByRole('button', { name: 'Compile', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Save your local changes')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await rpc(page, 'snapshot', { ref: { kind: 'draft', scriptId: script.id } })).draft.sequence).toBe(1)
  await panel.getByRole('button', { name: 'Compile', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save and compile', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveText('Compiled')
  await expect(panel).toContainText('Edited')
  const committed = await rpc(page, 'commit', { scriptId: script.id, expectedSequence: 2, description: 'Opening context' })
  await goto(page, new URL('/#papermoon/' + script.id + '?tab=history&revision=' + committed.revision.id, server.url).href)
  await expect(page.getByRole('button', { name: 'Compile', exact: true })).toHaveCount(0)
  await expect(page.locator('.pm-compilation')).toContainText('Edited')
  await expect(page.locator('.cm-content[contenteditable=true]')).toHaveCount(0)
  await page.setViewportSize({ width: 520, height: 850 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/papermoon-compiled-opening.png', fullPage: true })
})
test('diagnostics navigate to source and text, and stale results cannot navigate', async ({ page }) => {
  await login(page)
  const project = await rpc(page, 'createProject', { name: 'Diagnostics' })
  const script = await rpc(page, 'createScript', { projectId: project.id, name: 'Broken opening', defaultLanguage: 'en' })
  await rpc(page, 'save', { scriptId: script.id, expectedSequence: 0, operations: [
    { kind: 'create-file', path: 'story.js', source: '\nconst x = ;' },
    { kind: 'create-text', key: 'missing' },
  ] })
  await goto(page, new URL('/#papermoon/' + script.id + '?tab=draft', server.url).href)
  const panel = page.getByRole('region', { name: 'Compilation', exact: true })
  await panel.getByRole('button', { name: 'Compile', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveText('Compilation failed')
  await panel.getByRole('button', { name: 'story.js:2', exact: true }).click()
  await expect(page.locator('.cm-content[contenteditable=true]')).toBeFocused()
  await page.locator('.cm-content[contenteditable=true]').fill('module.exports={systemPrompt:require("@papermoon/story").t("missing"),messages:[]};')
  await expect(panel.getByRole('button', { name: 'story.js:2', exact: true })).toBeDisabled()
  await panel.getByRole('button', { name: 'Compile', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save and compile', exact: true }).click()
  await panel.getByRole('button', { name: 'missing · en', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Text', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Add translation', exact: true })).toBeVisible()
  await rpc(page, 'save', { scriptId: script.id, expectedSequence: 2, operations: [{ kind: 'set-translation', key: 'missing', language: 'en', text: '' }] })
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'missing · en', exact: true })).toBeDisabled()
  await panel.getByRole('button', { name: 'Compile', exact: true }).click()
  await expect(panel.getByRole('status')).toHaveText('Compiled')
})
test('manual program and text edits persist as immutable revisions', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await login(page)
  await page
    .getByRole('button', { name: 'New script', exact: true })
    .first()
    .click()
  await page
    .getByRole('textbox', { name: 'Name', exact: true })
    .pressSequentially('First direction')
  await page.getByRole('button', { name: 'Project', exact: true }).last().click()
  await page.getByRole('menuitem', { name: 'New project', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'New project name', exact: true })
    .fill('Workshop')
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'New file', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'New file', exact: true }).click()
  await page.getByRole('textbox', { name: 'File path' }).fill('src/main.js')
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await page
    .locator('.cm-content[contenteditable=true]')
    .fill('export const greeting = "你好";')
  await page.getByRole('tab', { name: 'Text', exact: true }).click()
  await page
    .getByRole('button', { name: 'New text entry', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Text key' }).fill('opening')
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Usage description', exact: true })
    .fill('Opening greeting')
  await page
    .getByRole('button', { name: 'Add translation', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Translation', exact: true })
    .fill('你好，旅行者。')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.locator('.pm-workbar [role=status]')).toContainText('Saved')
  await page
    .getByRole('button', { name: 'Submit revision', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Revision description', exact: true })
    .fill('First playable idea')
  await page.getByRole('dialog').getByRole('button', { name: 'Submit revision', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Compilation failed')
  await page.getByRole('checkbox', { name: 'Allow submission when compilation fails', exact: true }).check()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit revision', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Revisions', exact: true }).click()
  await page.locator('.pm-history-row').first().click()
  await expect(
    page.getByText('First playable idea', { exact: true }).last(),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Program', exact: true }).click()
  await page.getByRole('button', { name: 'main.js', exact: true }).click()
  await expect(page.locator('.cm-content').first()).toContainText('你好')
  expect(await page.locator('.cm-content[contenteditable=true]').count()).toBe(
    0,
  )
  await reload(page)
  await expect(
    page.getByText('First playable idea', { exact: true }).last(),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Program', exact: true }).click()
  await page.screenshot({
    path: 'test-results/papermoon-revision.png',
    fullPage: true,
  })
  expect(errors).toEqual([])
})
test('RPC authentication and cross-window conflicts preserve pending text', async ({
  page,
  context,
}) => {
  await login(page)
  const project = await rpc(page, 'createProject', {
      name: 'Conflict fixtures',
    }),
    script = await rpc(page, 'createScript', {
      projectId: project.id,
      name: 'Two windows',
      defaultLanguage: 'zh-CN',
    })
  await rpc(page, 'save', {
    scriptId: script.id,
    expectedSequence: 0,
    operations: [{ kind: 'create-file', path: 'test.js', source: 'base' }],
  })
  await goto(page, new URL('/#papermoon/' + script.id + '?tab=draft', server.url).href)
  await page.getByRole('button', { name: 'test.js', exact: true }).click()
  await page.locator('.cm-content[contenteditable=true]').fill('local pending')
  const other = await context.newPage()
  await login(other)
  await goto(other, new URL('/#papermoon/' + script.id + '?tab=draft', server.url).href)
  await other.getByRole('button', { name: 'test.js', exact: true }).click()
  await other.locator('.cm-content[contenteditable=true]').fill('other saved')
  await other.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(other.locator('.pm-workbar [role=status]')).toContainText('Saved')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(
    page.getByText('The server draft changed', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('.cm-content[contenteditable=true]')).toContainText(
    'local pending',
  )
  page.on('dialog', (dialog) => void dialog.accept())
  await reload(page)
  await expect(
    page.getByText('Local drafts available', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Recover a copy', exact: true })
    .first()
    .click()
  await page.getByRole('button', { name: 'test.js', exact: true }).click()
  await expect(page.locator('.cm-content[contenteditable=true]')).toContainText(
    'local pending',
  )
  await expect(
    page.getByText('The server draft changed', { exact: true }),
  ).toBeVisible()
  const unauthenticated = await fetch(
    new URL('/api/papermoon/projects', server.url),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: 'test',
        method: 'papermoon/projects',
        payload: {},
      }),
    },
  )
  expect(unauthenticated.status).toBe(401)
  await other.close()
})
test('responsive overview and independent script copy', async ({ page }) => {
  await login(page)
  const project = await rpc(page, 'createProject', { name: 'Variants' }),
    script = await rpc(page, 'createScript', {
      projectId: project.id,
      name: 'A direction',
      defaultLanguage: 'en',
    })
  const committed = await rpc(page, 'commit', {
    scriptId: script.id,
    expectedSequence: 0,
    description: 'Empty but valid', allowCompilationFailure: true,
  })
  const copied = await rpc(page, 'copy', {
    sourceScriptId: script.id,
    source: { kind: 'revision', revisionId: committed.revision.id },
    targetProjectId: project.id,
    name: 'Another direction',
    history: 'copy',
  })
  await rpc(page, 'deleteScript', { scriptId: script.id })
  const revisions = await rpc(page, 'history', { scriptId: copied.id })
  expect(revisions.items[0].revision.id).toBe(committed.revision.id)
  await reload(page)
  await page
    .getByRole('textbox', { name: 'Search scripts' })
    .fill('Another direction')
  await expect(page.locator('.pm-script-card')).toHaveCount(1)
  await page.setViewportSize({ width: 520, height: 850 })
  await page.screenshot({
    path: 'test-results/papermoon-narrow.png',
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('historical comparison, partial restoration and copy use saved revisions', async ({
  page,
}) => {
  await login(page)
  const project = await rpc(page, 'createProject', { name: 'History' }),
    script = await rpc(page, 'createScript', {
      projectId: project.id,
      name: 'Edit history',
      defaultLanguage: 'en',
    })
  await rpc(page, 'save', {
    scriptId: script.id,
    expectedSequence: 0,
    operations: [
      { kind: 'create-file', path: 'index.js', source: 'first' },
      { kind: 'create-text', key: 'opening' },
      {
        kind: 'set-translation',
        key: 'opening',
        language: 'en',
        text: 'before',
      },
    ],
  })
  const first = await rpc(page, 'commit', {
    scriptId: script.id,
    expectedSequence: 1,
    description: 'Initial text', allowCompilationFailure: true,
  })
  await rpc(page, 'save', {
    scriptId: script.id,
    expectedSequence: 2,
    operations: [
      { kind: 'replace-file', path: 'index.js', source: 'second' },
      {
        kind: 'set-translation',
        key: 'opening',
        language: 'en',
        text: 'after',
      },
    ],
  })
  await rpc(page, 'commit', {
    scriptId: script.id,
    expectedSequence: 3,
    description: 'Revised text', allowCompilationFailure: true,
  })
  await goto(
    page,
    new URL(
      '/#papermoon/' + script.id + '?tab=history&revision=' + first.revision.id,
      server.url,
    ).href,
  )
  await page
    .getByRole('button', { name: 'Compare with draft', exact: true })
    .click()
  await expect(page.locator('.pm-comparison summary')).toHaveCount(2)
  await page
    .locator('.pm-comparison summary')
    .filter({ hasText: 'index.js' })
    .click()
  await expect(page.locator('.cm-mergeView').first()).toContainText('second')
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await page
    .getByRole('menuitem', { name: 'Restore program', exact: true })
    .click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const restored = await rpc(page, 'snapshot', {
    ref: { kind: 'draft', scriptId: script.id },
  })
  expect(restored.content.program.files[0].source).toBe('first')
  expect(restored.content.texts.entries[0].translations[0][1].text).toBe(
    'after',
  )
  await page.getByRole('button', { name: 'Copy script', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('History copy')
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'History copy', exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Revisions', exact: true }).click()
  await expect(page.locator('.pm-history-row')).toHaveCount(1)
})
test('code editing preserves CRLF and undo across program and text panels', async ({
  page,
}) => {
  await login(page)
  const project = await rpc(page, 'createProject', { name: 'Editor states' }),
    script = await rpc(page, 'createScript', {
      projectId: project.id,
      name: 'Raw source',
      defaultLanguage: 'en',
    })
  await rpc(page, 'save', {
    scriptId: script.id,
    expectedSequence: 0,
    operations: [
      { kind: 'create-file', path: 'raw.js', source: 'first\r\nsecond\r\n' },
    ],
  })
  await goto(page, new URL('/#papermoon/' + script.id + '?tab=draft', server.url).href)
  await page.getByRole('button', { name: 'raw.js', exact: true }).click()
  const source = page.locator('.cm-content[contenteditable=true]')
  await source.click()
  await source.press('ControlOrMeta+End')
  await source.pressSequentially('tail')
  await page.getByRole('tab', { name: 'Text', exact: true }).click()
  await page.getByRole('tab', { name: 'Program', exact: true }).click()
  await source.click()
  await source.press('ControlOrMeta+z')
  await expect(source).not.toContainText('tail')
  await source.press('ControlOrMeta+Shift+z')
  await expect(source).toContainText('tail')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.locator('.pm-workbar [role=status]')).toContainText('Saved')
  expect(
    (
      await rpc(page, 'snapshot', {
        ref: { kind: 'draft', scriptId: script.id },
      })
    ).content.program.files[0].source,
  ).toBe('first\r\nsecond\r\ntail')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({
    path: 'test-results/papermoon-program-dark.png',
    fullPage: true,
  })
  await expect(
    page.getByRole('button', { name: 'Return to conversation', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'New session', exact: true }).last(),
  ).toBeVisible()
})

test('language presets, custom codes and input states work without a return button', async ({
  page,
}) => {
  await login(page)
  await expect(
    page.getByRole('button', { name: 'Return to conversation', exact: true }),
  ).toHaveCount(0)
  const search = page.getByRole('textbox', {
    name: 'Search scripts',
    exact: true,
  })
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await page.mouse.move(1190, 895)
    await search.blur()
    const before = await search.evaluate((el) => ({
      width: el.parentElement!.getBoundingClientRect().width,
      height: el.parentElement!.getBoundingClientRect().height,
      border: getComputedStyle(el.parentElement!).borderColor,
    }))
    await search.hover()
    await expect
      .poll(() =>
        search.evaluate(
          (el) => getComputedStyle(el.parentElement!).borderColor,
        ),
      )
      .not.toBe(before.border)
    await search.click()
    await expect(search).toBeFocused()
    await expect(search).toHaveCSS('outline-style', 'none')
    const after = await search.evaluate((el) => ({
      width: el.parentElement!.getBoundingClientRect().width,
      height: el.parentElement!.getBoundingClientRect().height,
    }))
    expect(after).toEqual({ width: before.width, height: before.height })
    await page.screenshot({
      path: 'test-results/papermoon-input-' + colorScheme + '.png',
    })
  }
  await page
    .getByRole('button', { name: 'New script', exact: true })
    .first()
    .click()
  await page
    .getByRole('button', { name: 'Project', exact: true })
    .last()
    .click()
  await page.getByRole('menuitem', { name: 'New project', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'New project name', exact: true })
    .fill('Language editor tests')
  await page
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Language choices')
  await page
    .getByRole('button', { name: 'Default language', exact: true })
    .click()
  await page
    .getByRole('menuitem', { name: 'English (en)', exact: true })
    .click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Language choices', exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Text', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Default language', exact: true }),
  ).toHaveText(/en/)
  await page.getByRole('button', { name: 'Add language', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Language', exact: true })
    .click()
  await page
    .getByRole('menuitem', { name: 'Simplified Chinese (zh-CN)', exact: true })
    .click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Translation language', exact: true }),
  ).toContainText('zh-CN')
  await page.getByRole('button', { name: 'Add language', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Language', exact: true })
    .click()
  await page
    .getByRole('menuitem', { name: 'Enter manually', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Confirm', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('textbox', { name: 'Language code', exact: true })
    .pressSequentially('fr-CA')
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.locator('.pm-workbar [role=status]')).toContainText('Saved')
  await reload(page)
  await page.getByRole('tab', { name: 'Text', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Translation language', exact: true }),
  ).toContainText('fr-CA')
})

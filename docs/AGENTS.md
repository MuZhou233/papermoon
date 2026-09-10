# PaperMoon documentation rules

Write human-facing English and Chinese documents together, using `.md`, `.zh.md` and `.i18n.yaml` files. Exempt machine instructions, licenses and fixtures explicitly in the checker configuration; do not silently exempt a new directory.

Use one physical line per paragraph. Keep equivalent headings, list/table structure, literal technical code and links in both languages. Localized links target the corresponding translated document. The pairing record stores reviewed content hashes; it does not certify translation accuracy. Run the recording command only after reviewing both sides.

Each fact has one owning document. Root instructions provide standing orders and links; the architecture page describes responsibilities; guides own operations and examples; Agent Notes own decisions and alternatives. Describe current behavior. Avoid repeating code, test inventories or implementation chronology. Keep code examples complete enough to check.

Check relative links and fragments, configured word budgets, Mermaid and TypeScript fences. Register `ts type-equiv Name` excerpts with their source declaration. Plain TypeScript examples must compile without fetching DSH. Do not add DSH package-documentation requirements merely because a copied checker supported them.

Use [checker commands](../tooling/checks/README.md) and [Note rules](../.agents/notes/README.md). Archived Note bodies are frozen and excluded from evolving prose and outbound-link checks. Other documents can still link to existing archive targets.

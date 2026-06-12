export const meta = {
  name: 'icon-migrate',
  description: 'Replace emoji-as-icons with the shared <Icon> component on core screens',
  phases: [{ title: 'Migrate', detail: 'one agent per screen file' }],
}

const FILES = [
  'src/app/(tabs)/practice.tsx',
  'src/app/(tabs)/progress.tsx',
  'src/app/(tabs)/profile.tsx',
  'src/app/(tabs)/library.tsx',
  'src/ui/SessionView.tsx',
  'src/ui/QuestStrip.tsx',
  'src/ui/StreakHero.tsx',
]

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['file','converted','keptBrand','neededButMissing','note'],
  properties: {
    file: { type: 'string' },
    converted: { type: 'integer', description: 'count of emoji converted to <Icon>' },
    keptBrand: { type: 'array', items: { type: 'string' }, description: 'emoji deliberately kept + why' },
    neededButMissing: { type: 'array', items: { type: 'string' }, description: 'emoji left as-is because no good MAP name (emoji + intended meaning)' },
    note: { type: 'string' },
  },
}

const PROMPT = (file) => `Replace emoji-used-as-UI-icons with the shared <Icon> component in ONE React Native screen file. Be conservative and PRESERVE layout.

1. Read src/ui/Icon.tsx — note the available semantic names in its MAP and the <Icon name size color style/> API.
2. Read ${file} and edit it in place.

RULES:
- Convert ONLY emoji that act as standalone UI chrome icons rendered in JSX (e.g. <T ...>🔍</T>, <Text>🔒</Text>, an icon inside a button/row). Replace with <Icon name="<semantic>" size={<match old fontSize>} color={<same color expr>} />. Import: add  import { Icon } from '../ui/Icon';  (or '../../ui/Icon' for files under app/(tabs)/) if not present — match the relative depth of the file.
- Use ONLY names that already exist in Icon.tsx MAP. If an emoji has NO good match in MAP, LEAVE IT UNCHANGED and report it in neededButMissing — do NOT invent a name (it would not typecheck) and do NOT edit Icon.tsx.
- KEEP as emoji (do not convert), and list in keptBrand: the Mascot, session vitals (⚡ XP, 🔥 combo, 💔 hearts) inside the player, celebration 🎉, and any emoji that is DATA (e.g. role.emoji / track.emoji rendered from a data field) — those are intentional brand identity.
- Do NOT change box-drawing/typographic glyphs: ─ → ✓ ✗ ▶ ▾ ▸ ↑ ↓ ≥ etc. Leave them.
- Preserve every surrounding style, color, conditional, and spacing. When an emoji+text sat in one <T>, wrap the Icon and the text in a <Row style={{ gap: 3 }}> (Row is exported from ../kit or ../../ui/kit) so layout is preserved.
- Do not touch logic, data, or non-emoji code.

Return the counts and lists per the schema. Correctness over completeness — leaving an emoji is fine; breaking the file is not.`

phase('Migrate')
const results = await parallel(FILES.map((f) => () =>
  agent(PROMPT(f), { label: `icon:${f.split('/').pop()}`, phase: 'Migrate', schema: SCHEMA, model: 'sonnet' })
))
const ok = results.filter(Boolean)
const conv = ok.reduce((s,r)=>s+(r.converted||0),0)
const miss = ok.flatMap((r)=>r.neededButMissing||[])
log(`Migrated ${ok.length}/${FILES.length} files, ${conv} emoji→Icon, ${miss.length} left (no MAP name)`)
return { files: ok.length, converted: conv, missing: miss, results: ok }

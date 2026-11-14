# UI component decision

The V1 interface uses [shadcn/ui](https://ui.shadcn.com/) primitives, composed into
the performance grid and edit view. shadcn distributes component source into the
project; it is not an opaque component package imported wholesale.

The intended source location is `src/renderer/components/ui`. Feature views live
in performance and editing. The component installer, Tailwind integration and
initial Button, Dialog, Input, Progress and Scroll Area components belong to B2's
setup, coordinated with the integrator for dependencies and build configuration.
I1 supplies the shadcn/ui Button composition (Radix Slot, cva and cn), styled with the incumbent shell CSS. B2 owns the remaining component setup and polished interface.

The renderer lint rule rejects raw interactive HTML primitives outside that UI
source directory. Named components are allowed; the rule governs composition,
not proof of a component's upstream origin. Styling, accessibility and whether a
component serves a musician's task still require review.

Runtime assets remain local. Component tooling runs during development, not at
show time. Installation follows the [existing Vite project guide](https://ui.shadcn.com/docs/installation/vite).

[Impeccable](https://impeccable.style/) supplies design guidance and critique for
UI tasks, alongside shadcn/ui primitives. The operator prefers few headings and
no decorative subtitles, repeated eyebrows or explanatory copy below every
control. Labels serve the drummer's next action; the pad names, playback state
and STOP have priority. Readability and useful hierarchy are review judgments,
not an arbitrary heading-count lint rule.

The project-local skill is `.agents/skills/impeccable/SKILL.md`, pinned in
`.pstack/impeccable-lock.json`. Its context/design/critique playbooks guide UI
work; shadcn/ui remains the component source. This installation does not run the
native design detector on app startup or require network access at shows.

B2 adds local shadcn-style Radix compositions for Dialog, Progress and Scroll Area,
plus Input, using the shell's CSS tokens alongside the existing Button. No Tailwind
runtime or remote assets are needed. Radix supplies dialog focus management and
progress/scroll semantics. Feature views compose these primitives; the native
desktop API remains the only catalog boundary. Reorder handles support dragging
and explicit Subir/Descer alternatives. Name changes save on blur; color and order
save immediately. Failed saves stay visible and never display a success message.

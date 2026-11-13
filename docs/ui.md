# UI component decision

The V1 interface uses [shadcn/ui](https://ui.shadcn.com/) primitives, composed into
the performance grid and edit view. shadcn distributes component source into the
project; it is not an opaque component package imported wholesale.

The intended source location is `src/renderer/components/ui`. Feature views live
in performance and editing. The component installer, Tailwind integration and
initial Button, Dialog, Input, Progress and Scroll Area components belong to B2's
setup, coordinated with the integrator for dependencies and build configuration.
They are not installed in the current empty shell.

The renderer lint rule rejects raw interactive HTML primitives outside that UI
source directory. Named components are allowed; the rule governs composition,
not proof of a component's upstream origin. Styling, accessibility and whether a
component serves a musician's task still require review.

Runtime assets remain local. Component tooling runs during development, not at
show time. Installation follows the [existing Vite project guide](https://ui.shadcn.com/docs/installation/vite).

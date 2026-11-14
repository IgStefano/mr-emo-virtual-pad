Read-only B1 review

Snapshot: 6225b1ba1b00bf85aaeddccea09c8b0c136e9819.
Implementation: 320e7cc8c5285a1a2f0611b06705a20e435ce6fa.
Original base: 5525193683d3935e2bd87fcaee35401e350d0209.

ISSUES

P2. Successful disposal retains subscriptions and subscriber-owned objects.
DomAudioExecutor.dispose at src/renderer/playback/dom-audio.ts:107-110 leaves
its public event subscriptions registered. PlaybackController.dispose at
src/renderer/playback/controller.ts:171-178 likewise leaves snapshot subscribers
registered, although it does remove its subscription to the executor.
P0 explicitly requires executor disposal to unsubscribe listeners.

Reproduction uses public subscribe/dispose only. Subscriber closures each own a
1 MiB payload. WeakRefs observe collection, with explicitly unsubscribed
subscriptions as controls. No private property inspection is used. Both disposed
owners remain reachable. Returned unsubscribe functions are not retained by the
probe, so they cannot be the cause of retention.

Command from repository root:
NODE_PATH=/home/igstefano/.t3/projects/mr-emo-virtual-pad/node_modules node --expose-gc reports/b1-review/subscription.cjs

Expected after successful disposal and forced GC: subscriber payloads collectible,
as they are in the explicitly unsubscribed controls.
Observed:
after successful disposal, subscriber payload retained: { audio: true, controller: true }
explicitly unsubscribed controls retained: { audio: false, controller: false }
owners still reachable: DomAudioExecutor false

Impact: a disposed owner retained by application/session ownership continues to
retain the observer's captured resources. The executor violates P0 disposal
ownership. Controller observer retention is the same issue on its own subscription
surface, rather than a separate claimed playback failure.

PASS

Read controller, DOM adapter and both playback test files. Static review found
no additional concrete lifecycle bug under P0 trusted-input and unique-ID
preconditions. Pending grants are awaited before release; invalidated attempts
cannot start after a late grant. Failed stop/release retains the busy gate and
lease for retry. Correlated callbacks are ignored after STOP and across attempts.
Observer exceptions are isolated and failing observers removed. The empty event
handler catches are not themselves evidence of swallowed valid-code rejections:
finish catches executor/release failures and notify catches observer exceptions.
STOP fulfillment communicates completion of the operation, with failure exposed
in snapshot; disposal explicitly rejects when an attempt remains held.

Coordinator-reported full verify and native rejected-media probe were not rerun
here. The local checkout lacks node_modules; the isolated probe used existing
project dependencies through NODE_PATH without modifying the checkout.

External BLOCKED

Successful packaged media playback, actual physical output, supported formats
and Mac/interface start/STOP behavior remain integration/device gates. Rejected
media and unit/mutation results do not establish those outcomes.

# V1 specification

An offline desktop pad for a drummer, operated by mouse/trackpad on Mac.
Development and checks also support Windows. Typical repertoire: 20–30 tracks,
without a hard 30-track limit.

Each pad references one audio file. Clicking while stopped starts at zero;
clicking any pad during acquisition/playback/stopping does nothing. STOP is
required before switching. No pause, loop, autoplay, resume or automatic next.
Natural end returns to stopped. Reopening always starts stopped.

One persistent grid. Editing is available only while stopped. Editing permits
batch import, labels, a small color palette and drag reordering, with automatic
saving. STOP and playback information remain accessible during scrolling.

Import copies and validates audio; original files remain untouched. Deleting a
pad asks for confirmation and deletes its internal copy. File cleanup failures
remain visible/recoverable. A future library will separate audio management from
repertoires; that UI is outside V1.

Audio uses the OS output and file levels; no mixer or volume normalization.
Show active pad, remaining time and progress. Closing during playback asks for
confirmation. Faults never start another track.

Format acceptance and physical start/STOP latency must be validated with the
band's actual files and Mac/audio interface before claiming readiness for shows.

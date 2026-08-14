# Community Pulse Assistant

A manager-facing tool for understanding what a gaming community is discussing from its Discord messages.

## Language

**Community message**:
An individual Discord record in the supplied dataset, with author, channel, timestamp, text, reactions, and an optional reply target.
_Avoid_: Post, chat

**Community conversation**:
A reply tree comprising one root Community message and every Community message that transitively replies to it, ordered by timestamp. A Community message with no reply target begins its own Community conversation; a reply whose target is absent or invalid is not assigned to a conversation.
_Avoid_: Message cluster, time-window thread

**Conversation sentiment profile**:
A per-theme account of a Community conversation's stance: `positive`, `negative`, `mixed`, or `neutral`; it includes a concise rationale plus cited supporting and, where applicable, rebutting turns. It is derived from the ordered reply tree, never by averaging independently classified Community messages.
_Avoid_: Message-score rollup, single dominant thread label

**Sentiment time window**:
The Community messages whose dates determine a Sentiment pulse. Earlier ancestor turns may be included only to interpret an in-window reply; they do not affect the conversation sentiment profile or count as current evidence.
_Avoid_: Whole-thread date filter, context counted as current evidence

**Grounded answer**:
A synthesized response to a manager query whose claims can be inspected through the community messages it cites.
_Avoid_: Unattributed insight, black-box answer

**Manager query**:
A natural-language question a Community & Marketing Manager asks to understand community excitement, frustration, or communication opportunities.
_Avoid_: Search term, prompt

**Sentiment pulse**:
A grounded answer that describes what Community conversations reveal community members are currently excited or frustrated about, rather than a recommendation about what the studio should publish. It synthesizes distinct Conversation sentiment profiles qualitatively and retains material disagreement; it does not claim percentages, a global score, or raw-message counts without a validated aggregation method.
_Avoid_: Content recommendation, marketing plan, message-score average

**Cited excerpt**:
An in-window Community message rendered with its pseudonymous author, channel, date, and text as evidence for a grounded answer. It appears on a compact theme card and opens its ordered Community conversation; any earlier ancestor shown there is context, not current evidence.
_Avoid_: Opaque citation, source identifier, unlabelled historical context

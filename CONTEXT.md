# Community Pulse Assistant

A manager-facing tool for understanding what a gaming community is discussing from its Discord messages.

## Language

**Community message**:
An individual Discord record in the supplied dataset, with author, channel, timestamp, text, reactions, and an optional reply target.
_Avoid_: Post, chat

**Grounded answer**:
A synthesized response to a manager query whose claims can be inspected through the community messages it cites.
_Avoid_: Unattributed insight, black-box answer

**Manager query**:
A natural-language question a Community & Marketing Manager asks to understand community excitement, frustration, or communication opportunities.
_Avoid_: Search term, prompt

**Sentiment pulse**:
A grounded answer that describes what community members are currently excited or frustrated about, rather than a recommendation about what the studio should publish.
_Avoid_: Content recommendation, marketing plan

**Cited excerpt**:
A community message rendered with its pseudonymous author, channel, date, and text as evidence for a grounded answer.
_Avoid_: Opaque citation, source identifier

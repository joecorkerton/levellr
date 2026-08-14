# Profile the corpus for sentiment fixtures

Type: task
Status: resolved
Blocked by: none

## Question

Inspect the supplied messages sufficiently to identify concrete, recurring excitement and frustration themes, then record facts that can ground representative demo prompts and evaluation fixtures.

This task is complete when later decisions can choose three credible fixture questions without inventing themes. It does not implement the application.

## Answer

### Corpus profile

- The export contains **25,555** messages from one community and **795** pseudonymous authors, spanning **2026-07-30T14:14:15Z** through **2026-08-13T14:00:00Z**. The latest timestamp is the reference point for any relative `last N days` filter.
- There are **11** channels. The largest topical slices are `new-release-discussion` (**6,042**), `off-topic` (**6,378**), `game-chat` (**7,071**), and `remaster-discussion` (**2,233**); spoiler channels add **1,725** new-release and **289** remaster messages.
- **9,451** messages are replies, so a relevant evidence pack should retain reply text rather than treating every message as an isolated community message. **1,155** messages have reactions, but reactions are sparse (**1,483** total), so they are supporting context rather than a sentiment metric.
- The two most useful topical slices for this vertical slice are `remaster-*` for the upcoming remaster and `new-release-*` for the final Bushido update. Do not require those channels: cross-topic references occur in both slices.

### Recurring themes grounded in the messages

1. **Anticipation for Tides Remastered and its pirate identity.** The conversation repeatedly looks forward to launch, a first playthrough, sailing, naval gameplay, cutscenes, and soundtrack/voice details. Examples: `msg_000203` (“Can't wait”), `msg_000584` (looking forward to sailing with the crew), `msg_000586` (first playthrough will be amazing), `msg_002845` (counting down until setting sail), and `msg_022334` (repeatedly played the original and is more hyped for Remastered).
2. **Parkour/stealth and legacy-feature fidelity are a high-interest, mixed-sentiment topic.** Some messages are excited about rebuilt traversal and parkour chases (`msg_000855`, `msg_000858`, `msg_000859`), while others worry about no fall damage (`msg_000017`, `msg_000019`), the RPG-derived parkour implementation (`msg_016492`–`msg_016496`), absent wristblade combat (`msg_021472`, `msg_021490`, `msg_023601`), and missing story replay/full-synchronization objectives (`msg_021527`). This is a credible feature-focused fixture, but not evidence of a uniform community consensus.
3. **The final Bushido update is a distinct mixed-reaction event.** The announced content is concrete: the Ebontide story, Domains mode, and Echo projects/rewards (`msg_004930`, `msg_004951`). Players called the update a good send-off and praised the new story/end-game content (`msg_005099`, `msg_005121`, `msg_005158`, `msg_005238`), while others found it underwhelming or too focused on promoting Tides Remastered (`msg_005105`, `msg_005141`, `msg_021948`, `msg_023563`). This mixed event-reception framing is grounded, but it is an alternate view of the final-update scenario rather than a new sentiment category. The selected third fixture below uses the distinct feature-fidelity discussion instead, so the three fixtures cover separate manager questions.
4. **Update reliability/support is a recurring frustration.** Around the final update, messages report launch crashes and crashes while checking memory add-ons (`msg_007472`, `msg_007573`, `msg_007596`), an Echo error (`msg_007494`), missing blacksmith functionality (`msg_007412`), a broken ledge grab (`msg_007722`), and a crash caused by new Ebontide gear (`msg_007766`, `msg_007779`). Later reports include a game-breaking Ebontide quest bug (`msg_015320`) and Domain black-screen hangs (`msg_023838`). These are stronger frustration fixtures than generic “bad game” statements because they name reproducible failures.

### Fixture questions

Use these three manager queries; the proposed windows ensure each exercises a different slice of the corpus:

1. **All messages:** “Across the supplied corpus, what have players been excited about in Tides Remastered?” — tests broad retrieval across launch anticipation, sailing/naval content, cutscenes, and parkour.
2. **Last 7 days:** “What frustrations are still surfacing around Bushido and its final update?” — tests recent bug/support complaints and the lingering concern that the send-off promotes Tides Remastered.
3. **Last 3 days:** “What Tides Remastered features are players hoping will be restored or preserved?” — tests the current feature-fidelity discussion (wristblade combat, replay/full sync, legacy equipment, and soundtrack).

The selected fixtures cover excitement, frustration, and feature preservation. Mixed recent-update reception is a grounded alternate framing, not a fourth sentiment category. The corpus does **not** support claims such as “the majority” or sentiment percentages without an explicit, validated aggregation method. Generic off-topic game comparisons and isolated price comments should not be promoted to primary themes.

## Comments

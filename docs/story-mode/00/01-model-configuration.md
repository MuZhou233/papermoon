# Chapter 0, Section 1: Check model configuration

English | [中文](01-model-configuration.zh.md)

These requirements belong to [hello world](README.md) and follow the [shared interaction requirements](../README.md).

## Experience and UI

Guide the user to inspect the model configuration page, with a button that opens it directly. Any provider is allowed. Users with existing configuration do not need to enter it again, but they must still open the page during the current attempt. Closing configuration returns to this step.

Identify the currently selected model and whether its required configuration is present. This check does not lock the model choice for the later exercise. Read configuration readiness through the existing model and credential mechanisms; do not create a separate API Key form or send a validation request. Configuration readiness does not establish that a real request will succeed; the fourth subsection provides that experience.

## Advancement

Enable Continue only when the model configuration page has actually opened during this attempt and the selected model has all required configuration. Clicking the shortcut without opening the page does not satisfy the viewing requirement. Missing or unreadable configuration keeps Continue unavailable and shows what prevents advancement.

Satisfying both conditions does not advance automatically. Clicking Continue records this step as complete and opens [the conversation example](02-conversation-example.md). Saved progress retains the viewing requirement's result for the current attempt; restarting requires another visit.

## Acceptance scenarios

- Existing model configuration does not bypass the required visit. After the page opens and the configuration is ready, Continue becomes available without asking the user to re-enter credentials.
- Visiting the page without complete configuration does not permit advancement; finishing configuration enables Continue.
- A provider other than DeepSeek can satisfy the requirements. Credential requirements follow that provider's configuration, rather than assuming every provider needs an API Key.
- No model request is sent during this step. Advancement requires an explicit Continue click after both prerequisites are met.

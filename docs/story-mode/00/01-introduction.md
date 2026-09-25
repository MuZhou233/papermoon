# Chapter 0, Section 1: Welcome to Story Mode

English | [中文](01-introduction.zh.md)

These requirements belong to [hello world](README.md) and follow the [shared interaction requirements](../README.md).

## Experience and UI

Display the three-paragraph introduction below in the main content area, with the Open model configuration button always available. Put the short operational guidance, configuration status and Continue in the focused sidebar subsection. Any provider is allowed. Closing model configuration returns to this step without losing progress.

Read model and required credential readiness through existing mechanisms, without a separate API Key form, model picker or validation request. Check whether at least one model has complete configuration, regardless of whether a default is selected or the selected model is valid. Follow each provider’s actual credential requirements; not every provider requires an API Key. Configuration readiness does not guarantee a successful request; the fourth subsection provides that experience.

This check does not select or change a model for the user, either globally or in the exercise. The exercise retains a valid current selection if one exists; otherwise, the user selects a configured model through the native selector before sending.

## Exact text

The main introduction uses these three paragraphs:

> Welcome to PaperMoon’s Story Mode.
>
> Follow the guidance in each chapter to explore PaperMoon’s features. The current step and its instructions appear in the sidebar, so you can work through the chapter at your own pace.
>
> In Chapter 0, hello world, you will first view a conversation example, then talk to a model yourself. You will also explore the trajectory to see the request sent to the model and the reply it returns.

The sidebar guidance is:

> Read the introduction and get ready to begin.

| Configuration state | Exact text |
|---|---|
| Checking | Checking model configuration… |
| At least one model ready | At least one model is configured and ready to use. You can continue, or open model configuration to review or change your settings. |
| No model ready | Open model configuration and finish configuring at least one model before continuing. |
| Cannot read state | Could not read model configuration. Please retry. |

Controls use the [shared text](../README.md#shared-text). The model configuration page reuses DSH’s native Models page and wording.

## Advancement

Enable Continue when at least one model currently has complete configuration. Opening model configuration is optional in that case; a visit during the attempt is not a separate prerequisite. If none is configured, require configuration through the provided entry before continuing. While checking, or if configuration cannot be read, Continue stays unavailable and the sidebar displays the corresponding status.

Recheck current configuration after changes, refresh, re-entry and restart. Completing configuration enables Continue without automatically advancing. Clicking Continue marks this step complete and opens [the conversation example](02-conversation-example.md). Restart does not require another configuration visit if a model is already ready.

## Acceptance scenarios

- The main content shows the confirmed introduction and configuration button; operational guidance, configuration status and Continue stay in the focused sidebar subsection.
- Any configured model enables Continue without a required visit, including when no default is selected or the selected default is invalid. The check does not choose or change the user’s model.
- With no configured model, Continue is unavailable and the user is directed to configuration; merely visiting the page does not suffice. Completing at least one model’s configuration enables Continue.
- Checking or unreadable configuration blocks advancement. Retry, refresh, re-entry and restart use current configuration instead of a saved visit flag.
- Providers other than DeepSeek can satisfy the requirement, with their own credential requirements and without re-entering existing credentials.
- This subsection sends no model request. Even when configuration is ready, advancement requires an explicit Continue click.

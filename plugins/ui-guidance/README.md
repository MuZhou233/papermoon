# Anchored guidance

English | [中文](README.zh.md)

This extension provides the root-scoped `anchored-guidance` UI factory. It highlights a real control identified by a stable DOM selector and places a short hint beside it. Consumers own the target, localized text, dismissal label and `onDismiss` callback. They mount or unmount the factory according to their own workflow; the extension knows no chapter or completion condition.

The overlay follows the target's geometry, scrolling and viewport changes. It waits while the target is missing, hidden or covered. It never clicks, moves focus or replaces the control. The highlight passes pointer input through; the hint's close button and Escape call `onDismiss`. While visible, the hint adds its own `aria-describedby` token to the target and removes only that token on cleanup. Consumers can remount it after dismissal.

The Client also exports `observeVisibleTarget(target, visible)`. It resolves a live DOM target on animation frames and invokes `visible` only when the target has visible geometry within the viewport and passes hit testing there. Hidden documents, clipping, overlays and unmounted virtual rows do not count. The returned disposer stops observation. Consumers must guard repeated callbacks and own any acknowledgement state; the observer does not infer completion from generated data.

The extension has no Host state and remains independent of Story Mode. The hosted Story Mode browser tests exercise target alignment, native keyboard activation, dismissal, restoration and plugin teardown on the actual DSH page.

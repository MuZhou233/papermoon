# Agent Note: Tool argument JSON errors

Status: implemented

English | [中文](2026-09-15-tool-argument-json-errors.zh.md)

## Problem

Passing malformed model arguments through as a string hides the JSON parser failure behind an unrelated parameter-type error. The model cannot reliably distinguish invalid JSON from a valid JSON string rejected by an object schema.

## Decision

The Agent Loop parses each argument string once and retains any syntax error. The registry receives that failure through its existing argument-materialization path, records a normal tool error, and does not dispatch the tool. The diagnostic identifies invalid JSON and preserves the native parser reason, including positions when available. Raw arguments remain in the call record. Valid JSON and empty argument strings retain their existing validation behavior.

## Alternatives considered

**Pass the raw string to parameter validation.** This loses the syntax failure and can misidentify the required correction.

**Repair malformed arguments automatically.** Repair would execute inferred input rather than the model’s recorded call.

## Consequences

The model receives the same error that history exposes and can submit a corrected call. No tool schema, help text, or Session event type changes. The native parser controls the detailed wording and location availability. Unit tests cover malformed and valid inputs, execution suppression, and the following model request; a keyless Session snapshot covers persisted errors and a corrected call.

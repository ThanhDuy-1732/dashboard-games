import { expect, it } from "vitest";
import { fragmentBleMessage, BleReassembler } from "../src/ble-frames.js";
const payload = Uint8Array.from({ length: 1000 }, (_, i) => i % 251);
it("fragments_respect_negotiated_payload_limit", () => {
  for (const limit of [20, 64, 182, 244, 512]) {
    const frames = fragmentBleMessage(payload, 42, limit);
    expect(frames.every((frame) => frame.length <= limit)).toBe(true);
    const decoder = new BleReassembler();
    let result: Uint8Array | null = null;
    for (const frame of frames)
      result = decoder.accept("host", frame) ?? result;
    expect(result).toEqual(payload);
  }
});
it("reassembly_handles_reordered_duplicates_without_delivering_twice", () => {
  const frames = fragmentBleMessage(payload, 42, 64),
    decoder = new BleReassembler();
  const outputs: Uint8Array[] = [];
  for (const frame of [...frames].reverse()) {
    const a = decoder.accept("host", frame),
      b = decoder.accept("host", frame);
    if (a) outputs.push(a);
    if (b) outputs.push(b);
  }
  for (const frame of frames) expect(decoder.accept("host", frame)).toBeNull();
  expect(outputs).toEqual([payload]);
});
it("incomplete_or_oversized_messages_are_rejected", () => {
  const frames = fragmentBleMessage(payload, 1, 64),
    decoder = new BleReassembler();
  for (const frame of frames.slice(0, -1))
    expect(decoder.accept("host", frame)).toBeNull();
  expect(() => fragmentBleMessage(new Uint8Array(32769), 1, 64)).toThrow();
  expect(() => fragmentBleMessage(payload, 1, 13)).toThrow();
  const bad = frames[0]!.slice();
  new DataView(bad.buffer).setUint32(9, 32769);
  expect(() => decoder.accept("host", bad)).toThrow();
});
it("expired_partial_messages_are_discarded_and_only_two_partials_per_peer_are_kept", () => {
  let now = 0;
  const decoder = new BleReassembler(() => now);
  const frames = fragmentBleMessage(payload, 1, 64);
  decoder.accept("host", frames[0]!);
  decoder.accept("host", fragmentBleMessage(payload, 2, 64)[0]!);
  expect(() =>
    decoder.accept("host", fragmentBleMessage(payload, 3, 64)[0]!),
  ).toThrow();
  now = 10000;
  for (const frame of frames.slice(1))
    expect(decoder.accept("host", frame)).toBeNull();
  expect(() =>
    decoder.accept("host", fragmentBleMessage(payload, 3, 64)[0]!),
  ).not.toThrow();
});
it("different_peer_cannot_complete_another_peers_message", () => {
  const frames = fragmentBleMessage(payload, 42, 64),
    decoder = new BleReassembler();
  decoder.accept("one", frames[0]!);
  for (const frame of frames.slice(1))
    expect(decoder.accept("two", frame)).toBeNull();
  expect(decoder.accept("two", frames[0]!)).toEqual(payload);
  for (const frame of frames.slice(1, -1))
    expect(decoder.accept("one", frame)).toBeNull();
  expect(decoder.accept("one", frames.at(-1)!)).toEqual(payload);
});
it("rejects_conflicting_duplicate_chunks_and_invalid_headers", () => {
  const decoder = new BleReassembler(),
    first = fragmentBleMessage(payload, 1, 64)[0]!;
  decoder.accept("host", first);
  const changed = first.slice();
  changed[13] ^= 1;
  expect(() => decoder.accept("host", changed)).toThrow();
  const version = first.slice();
  version[0] = 2;
  expect(() => decoder.accept("host", version)).toThrow();
  const badIndex = first.slice();
  new DataView(badIndex.buffer).setUint16(5, 65535);
  expect(() => decoder.accept("host", badIndex)).toThrow();
  expect(() => decoder.accept("host", new Uint8Array(12))).toThrow();
});
it("bounds_peers_and_releases_resources_on_disconnect_or_stop", () => {
  const decoder = new BleReassembler(),
    frame = fragmentBleMessage(payload, 1, 64)[0]!;
  for (let i = 0; i < 6; i++) decoder.accept(String(i), frame);
  expect(() => decoder.accept("extra", frame)).toThrow();
  decoder.dropPeer("0");
  expect(() => decoder.accept("extra", frame)).not.toThrow();
  decoder.clear();
  expect(() => decoder.accept("new", frame)).not.toThrow();
  decoder.clear();
});

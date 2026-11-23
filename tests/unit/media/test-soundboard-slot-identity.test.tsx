import { expect, test } from "bun:test";
import { isValidElement, type ReactNode } from "react";
import { SoundGrid } from "../../../src/apps/soundboard/components/SoundGrid";
import { SoundSlot } from "../../../src/apps/soundboard/components/SoundSlot";
import type { Soundboard } from "../../../src/types/types";

function slotKeys(board: Soundboard): Array<string | null> {
  const noop = () => {};
  const tree = SoundGrid({
    board,
    playbackStates: Array.from({ length: 9 }, () => ({ isPlaying: false, isRecording: false })),
    isEditingTitle: false,
    onTitleChange: noop,
    onTitleBlur: noop,
    onTitleKeyDown: noop,
    onSlotClick: noop,
    onSlotDelete: noop,
    onSlotEmojiClick: noop,
    onSlotTitleClick: noop,
    setIsEditingTitle: noop,
    showWaveforms: true,
    showEmojis: true,
  });
  const keys: Array<string | null> = [];
  function visit(node: ReactNode): void {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!isValidElement<{ children?: ReactNode }>(node)) return;
    if (node.type === SoundSlot) keys.push(node.key);
    visit(node.props.children);
  }
  visit(tree);
  return keys;
}

test("shared empty slots have unique identities stable through recording updates", () => {
  const board: Soundboard = { id: "first", name: "New", slots: Array(9).fill({ audioData: null }) };
  const before = slotKeys(board);
  expect(before).toHaveLength(9);
  expect(new Set(before).size).toBe(9);
  const edited = { ...board, slots: board.slots.map((slot, index) => index === 0 ? { ...slot, audioData: "recorded" } : slot) };
  expect(slotKeys(edited)).toEqual(before);
  expect(slotKeys({ ...board, id: "second" }).some(key => before.includes(key))).toBe(false);
});

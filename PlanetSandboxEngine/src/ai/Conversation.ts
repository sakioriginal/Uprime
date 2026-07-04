import type { Entity } from '../engine/Entity';

export function talk(npc: Entity): string {
  const mind = npc.mind;
  if (!mind) return `${npc.name}「……」`;

  mind.loyalty = Math.min(100, mind.loyalty + 8);
  mind.faith = Math.min(100, mind.faith + 3);
  mind.memories.unshift('主人公と会話した');
  mind.memories = mind.memories.slice(0, mind.memory);

  if (mind.loyalty >= 90) {
    return `${mind.name}「お帰りなさい。あなたの考えを、私にも教えてください。」\n忠誠:${mind.loyalty} 信仰:${mind.faith}`;
  }
  if (mind.loyalty >= 70) {
    return `${mind.name}「あなたなら、この村をもっと遠くへ導ける気がします。」\n忠誠:${mind.loyalty} 信仰:${mind.faith}`;
  }
  if (mind.loyalty >= 45) {
    return `${mind.name}「こんにちは。今日は空が澄んでいますね。月まで見えそうです。」\n忠誠:${mind.loyalty} 信仰:${mind.faith}`;
  }
  return `${mind.name}「……何の用ですか？」\n忠誠:${mind.loyalty} 信仰:${mind.faith}`;
}

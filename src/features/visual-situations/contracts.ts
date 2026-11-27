/** Future-ready contracts. These types extend, not replace, the Phase 2 textual Scenario model. */
export type NormalizedPoint = { x: number; y: number }; // 0..1 normalized map coordinates
export type TacticalUnit = {
  id: string;
  team: 'ally' | 'enemy' | 'neutral';
  heroId?: number;
  heroName: string;
  position: NormalizedPoint;
  health?: number;
  maxHealth?: number;
  mana?: number;
  maxMana?: number;
  level?: number;
  inventoryItemIds?: number[];
  visible: boolean;
};
export type TacticalVisualBoard = {
  schemaVersion: 1;
  scenarioId: string; // References the existing textual Situational Trainer scenario.
  gameMinute: number;
  mapAssetKey?: string;
  minimapAssetKey?: string;
  units: TacticalUnit[];
  objectivePoints?: Array<{ id: string; label: string; position: NormalizedPoint }>;
  availableActions: Array<{ id: string; label: string; targetUnitId?: string; targetPoint?: NormalizedPoint }>;
};

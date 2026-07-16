import { expect, test } from 'vitest';
import {
  CONVEYOR_TIER_OPTIONS,
  countEditableBlueprintObjects,
  getConveyorLabel,
  getConveyorVariant,
  updateBlueprintObjectTier,
} from './blueprintToolkit';

test('resolves belt and lift tier metadata from blueprint type paths', () => {
  const beltVariant = getConveyorVariant(CONVEYOR_TIER_OPTIONS[0].typePath);
  const liftVariant = getConveyorVariant(CONVEYOR_TIER_OPTIONS[6].typePath);

  expect(beltVariant?.family).toBe('belt');
  expect(beltVariant?.tier).toBe(1);
  expect(getConveyorLabel(beltVariant)).toBe('Belt Mk1');
  expect(liftVariant?.family).toBe('lift');
  expect(liftVariant?.tier).toBe(1);
  expect(getConveyorLabel(liftVariant)).toBe('Lift Mk1');
});

test('updates one conveyor tier without changing unrelated blueprint objects', () => {
  const blueprint = {
    objects: [
      { typePath: CONVEYOR_TIER_OPTIONS[0].typePath },
      { typePath: '/Game/FactoryGame/Buildable/Factory/StorageContainerMk1/Build_StorageContainerMk1.Build_StorageContainerMk1_C' },
    ],
  };

  const updated = updateBlueprintObjectTier(blueprint, 0, CONVEYOR_TIER_OPTIONS[5]);

  expect(updated.objects[0].typePath).toBe(CONVEYOR_TIER_OPTIONS[5].typePath);
  expect(updated.objects[1].typePath).toBe(blueprint.objects[1].typePath);
  expect(countEditableBlueprintObjects(updated)).toBe(1);
});

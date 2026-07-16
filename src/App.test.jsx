import { expect, test } from 'vitest';
import {
  CONVEYOR_TIER_OPTIONS,
  createDefaultBlueprintConfig,
  getConveyorRecipePath,
  getConveyorVariant,
  groupEditableBlueprintObjects,
  updateBlueprintConveyorGroupTier,
} from './blueprintToolkit';

test('resolves belt and lift tier metadata from blueprint type paths', () => {
  const beltVariant = getConveyorVariant(CONVEYOR_TIER_OPTIONS[0].typePath);
  const liftVariant = getConveyorVariant(CONVEYOR_TIER_OPTIONS[6].typePath);

  expect(beltVariant?.family).toBe('belt');
  expect(beltVariant?.tier).toBe(1);
  expect(liftVariant?.family).toBe('lift');
  expect(liftVariant?.tier).toBe(1);
  expect(getConveyorRecipePath(beltVariant)).toContain('Recipe_ConveyorBeltMk1');
  expect(getConveyorRecipePath(liftVariant)).toContain('Recipe_ConveyorLiftMk1');
});

test('groups conveyor objects and rewrites both type and recipe paths when a tier changes', () => {
  const blueprint = {
    objects: [
      {
        typePath: CONVEYOR_TIER_OPTIONS[0].typePath,
        properties: {
          mBuiltWithRecipe: {
            value: {
              pathName: 'old-recipe',
            },
          },
        },
      },
      {
        typePath: CONVEYOR_TIER_OPTIONS[0].typePath,
        properties: {
          mBuiltWithRecipe: {
            value: {
              pathName: 'old-recipe-2',
            },
          },
        },
      },
      {
        typePath: '/Game/FactoryGame/Buildable/Factory/StorageContainerMk1/Build_StorageContainerMk1.Build_StorageContainerMk1_C',
        properties: {},
      },
    ],
  };

  const groups = groupEditableBlueprintObjects(blueprint);
  const updated = updateBlueprintConveyorGroupTier(blueprint, groups[0].family, groups[0].tier, 5);

  expect(groups).toHaveLength(1);
  expect(groups[0].count).toBe(2);
  expect(updated.objects[0].typePath).toBe(CONVEYOR_TIER_OPTIONS[4].typePath);
  expect(updated.objects[0].properties.mBuiltWithRecipe.value.pathName).toContain('Recipe_ConveyorBeltMk5');
  expect(updated.objects[1].typePath).toBe(CONVEYOR_TIER_OPTIONS[4].typePath);
  expect(updated.objects[1].properties.mBuiltWithRecipe.value.pathName).toContain('Recipe_ConveyorBeltMk5');
  expect(updated.objects[2].typePath).toBe(blueprint.objects[2].typePath);
});

test('creates a default blueprint config when no sbpcfg is supplied', () => {
  const config = createDefaultBlueprintConfig('Example description');

  expect(config.configVersion).toBe(5);
  expect(config.description).toBe('Example description');
  expect(config.referencedIconLibrary).toBe('');
});

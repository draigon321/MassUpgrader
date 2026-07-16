const BELT_VARIANTS = [
  {
    family: 'belt',
    tier: 1,
    label: 'Conveyor Belt Mk1',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk1/Build_ConveyorBeltMk1.Build_ConveyorBeltMk1_C',
  },
  {
    family: 'belt',
    tier: 2,
    label: 'Conveyor Belt Mk2',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk2/Build_ConveyorBeltMk2.Build_ConveyorBeltMk2_C',
  },
  {
    family: 'belt',
    tier: 3,
    label: 'Conveyor Belt Mk3',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk3/Build_ConveyorBeltMk3.Build_ConveyorBeltMk3_C',
  },
  {
    family: 'belt',
    tier: 4,
    label: 'Conveyor Belt Mk4',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk4/Build_ConveyorBeltMk4.Build_ConveyorBeltMk4_C',
  },
  {
    family: 'belt',
    tier: 5,
    label: 'Conveyor Belt Mk5',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk5/Build_ConveyorBeltMk5.Build_ConveyorBeltMk5_C',
  },
  {
    family: 'belt',
    tier: 6,
    label: 'Conveyor Belt Mk6',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorBeltMk6/Build_ConveyorBeltMk6.Build_ConveyorBeltMk6_C',
  },
  {
    family: 'lift',
    tier: 1,
    label: 'Conveyor Lift Mk1',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk1/Build_ConveyorLiftMk1.Build_ConveyorLiftMk1_C',
  },
  {
    family: 'lift',
    tier: 2,
    label: 'Conveyor Lift Mk2',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk2/Build_ConveyorLiftMk2.Build_ConveyorLiftMk2_C',
  },
  {
    family: 'lift',
    tier: 3,
    label: 'Conveyor Lift Mk3',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk3/Build_ConveyorLiftMk3.Build_ConveyorLiftMk3_C',
  },
  {
    family: 'lift',
    tier: 4,
    label: 'Conveyor Lift Mk4',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk4/Build_ConveyorLiftMk4.Build_ConveyorLiftMk4_C',
  },
  {
    family: 'lift',
    tier: 5,
    label: 'Conveyor Lift Mk5',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk5/Build_ConveyorLiftMk5.Build_ConveyorLiftMk5_C',
  },
  {
    family: 'lift',
    tier: 6,
    label: 'Conveyor Lift Mk6',
    typePath: '/Game/FactoryGame/Buildable/Factory/ConveyorLiftMk6/Build_ConveyorLiftMk6.Build_ConveyorLiftMk6_C',
  },
];

const CONVEYOR_VARIANT_BY_TYPE_PATH = new Map(BELT_VARIANTS.map((variant) => [variant.typePath, variant]));
const CONVEYOR_RECIPE_BY_TYPE_PATH = new Map(BELT_VARIANTS.map((variant) => [variant.typePath, variant.typePath.replace('/Build_', '/Recipe_').replace('.Build_', '.Recipe_')]));

export const CONVEYOR_TIER_OPTIONS = BELT_VARIANTS;

export const CONVEYOR_TYPE_PATTERN = /^\/Game\/FactoryGame\/Buildable\/Factory\/(Conveyor(Belt|Lift)Mk[1-6])\/Build_(\1)\.Build_(\1)_C$/;

export const getConveyorVariant = (typePath) => CONVEYOR_VARIANT_BY_TYPE_PATH.get(typePath) ?? null;

export const getConveyorRecipePath = (variant) => CONVEYOR_RECIPE_BY_TYPE_PATH.get(variant?.typePath) ?? '';

export const isConveyorBlueprintObject = (object) => Boolean(object && getConveyorVariant(object.typePath));

export const getBlueprintStem = (fileName) => fileName.replace(/\.(sbp|sbpcfg)$/i, '');

export const getConveyorLabel = (variant) => {
  if (!variant) {
    return 'Unknown tier';
  }

  return `${variant.family === 'belt' ? 'Belt' : 'Lift'} Mk${variant.tier}`;
};

const rewriteConveyorObject = (object, targetVariant) => {
  const nextRecipePath = getConveyorRecipePath(targetVariant);

  return {
    ...object,
    typePath: targetVariant.typePath,
    properties: {
      ...object.properties,
      ...(object.properties?.mBuiltWithRecipe
        ? {
            mBuiltWithRecipe: {
              ...object.properties.mBuiltWithRecipe,
              value: {
                ...object.properties.mBuiltWithRecipe.value,
                pathName: nextRecipePath,
              },
            },
          }
        : {}),
    },
  };
};

export const updateBlueprintObjectTier = (blueprint, objectIndex, targetVariant) => ({
  ...blueprint,
  objects: blueprint.objects.map((object, index) => (index === objectIndex ? rewriteConveyorObject(object, targetVariant) : object)),
});

export const updateBlueprintConveyorGroupTier = (blueprint, family, fromTier, targetTier) => {
  const targetVariant = CONVEYOR_TIER_OPTIONS.find((variant) => variant.family === family && variant.tier === targetTier);

  if (!targetVariant) {
    return blueprint;
  }

  return {
    ...blueprint,
    objects: blueprint.objects.map((object) => {
      const currentVariant = getConveyorVariant(object.typePath);

      if (!currentVariant || currentVariant.family !== family || currentVariant.tier !== fromTier) {
        return object;
      }

      return rewriteConveyorObject(object, targetVariant);
    }),
  };
};

export const groupEditableBlueprintObjects = (blueprint) => {
  const groups = new Map();

  for (const [index, object] of blueprint.objects.entries()) {
    const variant = getConveyorVariant(object.typePath);

    if (!variant) {
      continue;
    }

    const key = `${variant.family}:${variant.tier}`;
    const current = groups.get(key) ?? {
      family: variant.family,
      tier: variant.tier,
      variant,
      count: 0,
      indices: [],
    };

    current.count += 1;
    current.indices.push(index);
    groups.set(key, current);
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.family === right.family) {
      return left.tier - right.tier;
    }

    return left.family.localeCompare(right.family);
  });
};

export const countEditableBlueprintObjects = (blueprint) => blueprint.objects.filter(isConveyorBlueprintObject).length;

export const createDefaultBlueprintConfig = (description = '') => ({
  configVersion: 5,
  description,
  color: {
    r: 1,
    g: 1,
    b: 1,
    a: 1,
  },
  iconID: 0,
  referencedIconLibrary: '',
  iconLibraryType: '',
});

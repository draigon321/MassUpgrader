import { useMemo, useState } from 'react';
import './App.css';
import {
  CONVEYOR_TIER_OPTIONS,
  countEditableBlueprintObjects,
  getBlueprintStem,
  getConveyorLabel,
  getConveyorVariant,
  updateBlueprintObjectTier,
} from './blueprintToolkit';

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [workingBlueprint, setWorkingBlueprint] = useState(null);
  const [sourceBlueprint, setSourceBlueprint] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Select an `.sbp` and matching `.sbpcfg` file to begin.');
  const [errorMessage, setErrorMessage] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const mainFile = selectedFiles.find((file) => file.name.toLowerCase().endsWith('.sbp')) ?? null;
  const configFile = selectedFiles.find((file) => file.name.toLowerCase().endsWith('.sbpcfg')) ?? null;
  const canParse = Boolean(mainFile && configFile);

  const editableObjects = useMemo(() => {
    if (!workingBlueprint) {
      return [];
    }

    return workingBlueprint.objects
      .map((object, index) => {
        const variant = getConveyorVariant(object.typePath);

        if (!variant) {
          return null;
        }

        return {
          index,
          object,
          variant,
        };
      })
      .filter(Boolean);
  }, [workingBlueprint]);

  const beltCount = editableObjects.filter((entry) => entry.variant.family === 'belt').length;
  const liftCount = editableObjects.filter((entry) => entry.variant.family === 'lift').length;
  const changedCount = useMemo(() => {
    if (!workingBlueprint || !sourceBlueprint) {
      return 0;
    }

    return editableObjects.filter(({ index, object }) => sourceBlueprint.objects[index]?.typePath !== object.typePath).length;
  }, [editableObjects, sourceBlueprint, workingBlueprint]);

  const handleFileSelection = (event) => {
    const nextFiles = Array.from(event.target.files ?? []);
    setSelectedFiles(nextFiles);
    setErrorMessage('');
    setStatusMessage(nextFiles.length ? 'Files selected. Parse to inspect editable conveyor tiers.' : 'Select an `.sbp` and matching `.sbpcfg` file to begin.');
  };

  const handleParse = async () => {
    if (!canParse || !mainFile || !configFile) {
      setErrorMessage('Choose both the `.sbp` blueprint file and the paired `.sbpcfg` config file.');
      return;
    }

    const mainStem = getBlueprintStem(mainFile.name);
    const configStem = getBlueprintStem(configFile.name);

    if (mainStem !== configStem) {
      setErrorMessage('The `.sbp` and `.sbpcfg` filenames must share the same base name.');
      return;
    }

    setIsParsing(true);
    setErrorMessage('');

    try {
      const [mainBuffer, configBuffer, parserModule] = await Promise.all([
        mainFile.arrayBuffer(),
        configFile.arrayBuffer(),
        import('@etothepii/satisfactory-file-parser'),
      ]);

      const { Parser } = parserModule;
      const parsedBlueprint = Parser.ParseBlueprintFiles(mainStem, mainBuffer, configBuffer, {
        throwErrors: true,
      });

      setSourceBlueprint(parsedBlueprint);
      setWorkingBlueprint(parsedBlueprint);
      setStatusMessage(`Loaded ${parsedBlueprint.name}. ${countEditableBlueprintObjects(parsedBlueprint)} conveyor and lift objects are editable.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setStatusMessage('Parse failed. Fix the file pair or try a different blueprint.');
      setWorkingBlueprint(null);
      setSourceBlueprint(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleTierChange = (objectIndex, family, nextTierValue) => {
    const nextTier = Number(nextTierValue);
    const nextVariant = CONVEYOR_TIER_OPTIONS.find((variant) => variant.family === family && variant.tier === nextTier);

    if (!nextVariant) {
      return;
    }

    setWorkingBlueprint((currentBlueprint) => {
      if (!currentBlueprint) {
        return currentBlueprint;
      }

      return updateBlueprintObjectTier(currentBlueprint, objectIndex, nextVariant);
    });
  };

  const handleExport = async () => {
    if (!workingBlueprint) {
      setErrorMessage('Parse a blueprint before exporting changes.');
      return;
    }

    setIsExporting(true);
    setErrorMessage('');

    try {
      const parserModule = await import('@etothepii/satisfactory-file-parser');
      const { Parser } = parserModule;
      let mainHeader = null;
      const mainChunks = [];

      const { configFileBinary } = Parser.WriteBlueprintFiles(
        workingBlueprint,
        (header) => {
          mainHeader = header;
        },
        (chunk) => {
          mainChunks.push(chunk);
        }
      );

      if (!mainHeader) {
        throw new Error('The parser did not produce a blueprint file header.');
      }

      const exportStem = `${workingBlueprint.name || 'blueprint'}-tiered`;
      const mainBlob = new Blob([mainHeader, ...mainChunks], { type: 'application/octet-stream' });
      const configBlob = new Blob([configFileBinary], { type: 'application/octet-stream' });

      downloadBlob(mainBlob, `${exportStem}.sbp`);
      downloadBlob(configBlob, `${exportStem}.sbpcfg`);
      setStatusMessage(`Exported ${exportStem}.sbp and ${exportStem}.sbpcfg with ${changedCount} edited conveyor tiers.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setStatusMessage('Export failed. The blueprint may contain data the parser cannot write back.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="hero card">
        <div className="hero-copy">
          <p className="eyebrow">Satisfactory blueprint tier editor</p>
          <h1>Import `.sbp` and `.sbpcfg`, retier conveyors and lifts, then export the pair.</h1>
          <p className="lede">
            Load a blueprint, inspect every conveyor belt and conveyor lift in the file, change the tier from a dropdown, and write the modified binary files back out.
          </p>
        </div>

        <div className="hero-stats" aria-label="Current blueprint summary">
          <div>
            <span>Editable objects</span>
            <strong>{editableObjects.length}</strong>
          </div>
          <div>
            <span>Belt tiers</span>
            <strong>{beltCount}</strong>
          </div>
          <div>
            <span>Lift tiers</span>
            <strong>{liftCount}</strong>
          </div>
          <div>
            <span>Pending changes</span>
            <strong>{changedCount}</strong>
          </div>
        </div>
      </section>

      <section className="card upload-panel">
        <div className="panel-copy">
          <h2>1. Choose the blueprint files</h2>
          <p>Pick the main `.sbp` file and the matching `.sbpcfg` file from the same blueprint export.</p>
        </div>

        <p className="attribution-copy">
          Blueprint parsing is powered by <a href="https://github.com/etothepii4/satisfactory-file-parser" target="_blank" rel="noreferrer">etothepii4/satisfactory-file-parser</a> by etothepii4.
        </p>

        <label className="file-dropzone">
          <input
            type="file"
            accept=".sbp,.sbpcfg"
            multiple
            onChange={handleFileSelection}
          />
          <span className="dropzone-title">Drop files here or browse</span>
          <span className="dropzone-subtitle">The app expects exactly one `.sbp` and one `.sbpcfg` file.</span>
        </label>

        <div className="file-lineup" aria-live="polite">
          <div>
            <span>Main file</span>
            <strong>{mainFile ? mainFile.name : 'Not selected'}</strong>
          </div>
          <div>
            <span>Config file</span>
            <strong>{configFile ? configFile.name : 'Not selected'}</strong>
          </div>
        </div>

        <div className="action-row">
          <button type="button" onClick={handleParse} disabled={!canParse || isParsing}>
            {isParsing ? 'Parsing blueprint…' : 'Parse blueprint'}
          </button>
          <button type="button" className="secondary" onClick={handleExport} disabled={!workingBlueprint || isExporting}>
            {isExporting ? 'Exporting…' : 'Export modified files'}
          </button>
        </div>

        <p className="status-copy">{statusMessage}</p>
        {errorMessage ? <p className="error-copy">{errorMessage}</p> : null}
      </section>

      {workingBlueprint ? (
        <section className="card editor-panel">
          <div className="panel-copy panel-copy-spaced">
            <div>
              <h2>2. Edit conveyor and lift tiers</h2>
              <p>
                {workingBlueprint.config.description || 'No blueprint description was stored in the config file.'}
              </p>
            </div>
            <div className="blueprint-meta">
              <span>Blueprint name</span>
              <strong>{workingBlueprint.name}</strong>
              <span>Total objects</span>
              <strong>{workingBlueprint.objects.length}</strong>
            </div>
          </div>

          {editableObjects.length > 0 ? (
            <div className="object-list">
              {editableObjects.map(({ index, object, variant }) => {
                const originalVariant = sourceBlueprint ? getConveyorVariant(sourceBlueprint.objects[index]?.typePath) : variant;
                const selectedTier = variant.tier;

                return (
                  <article className="object-row" key={`${index}-${object.instanceName}`}>
                    <div className="object-row__copy">
                      <div className="object-row__heading">
                        <strong>{getConveyorLabel(variant)}</strong>
                        <span>{object.instanceName}</span>
                      </div>
                      <p>
                        {object.typePath}
                      </p>
                      <div className="object-row__tags">
                        <span className="tag">{variant.family === 'belt' ? 'Conveyor Belt' : 'Conveyor Lift'}</span>
                        {originalVariant && originalVariant.tier !== variant.tier ? (
                          <span className="tag tag--muted">Was Mk{originalVariant.tier}</span>
                        ) : (
                          <span className="tag tag--muted">No change yet</span>
                        )}
                      </div>
                    </div>

                    <label className="tier-picker">
                      <span>Tier</span>
                      <select value={selectedTier} onChange={(event) => handleTierChange(index, variant.family, event.target.value)}>
                        {CONVEYOR_TIER_OPTIONS.filter((option) => option.family === variant.family).map((option) => (
                          <option key={option.typePath} value={option.tier}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No conveyor belts or lifts found</h3>
              <p>The blueprint loaded correctly, but it does not contain any buildable conveyor objects the parser knows how to retier.</p>
            </div>
          )}
        </section>
      ) : (
        <section className="card empty-panel">
          <h2>3. Inspect the parsed result</h2>
          <p>
            Once a blueprint is parsed, the editor lists every conveyor belt and conveyor lift it finds and lets you change the tier directly.
          </p>
        </section>
      )}
    </main>
  );
}

export default App;

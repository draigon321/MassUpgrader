import { useMemo, useState } from 'react';
import './App.css';
import {
  CONVEYOR_TIER_OPTIONS,
  countEditableBlueprintObjects,
  createDefaultBlueprintConfig,
  getBlueprintStem,
  groupEditableBlueprintObjects,
  updateBlueprintConveyorGroupTier,
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
  const [selectedFile, setSelectedFile] = useState(null);
  const [workingBlueprint, setWorkingBlueprint] = useState(null);
  const [sourceBlueprint, setSourceBlueprint] = useState(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [statusMessage, setStatusMessage] = useState('Select an `.sbp` file to begin.');
  const [errorMessage, setErrorMessage] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const canParse = Boolean(selectedFile);

  const groupedObjects = useMemo(() => {
    if (!workingBlueprint) {
      return [];
    }

    return groupEditableBlueprintObjects(workingBlueprint);
  }, [workingBlueprint]);

  const beltCount = groupedObjects.filter((entry) => entry.family === 'belt').reduce((total, entry) => total + entry.count, 0);
  const liftCount = groupedObjects.filter((entry) => entry.family === 'lift').reduce((total, entry) => total + entry.count, 0);
  const changedCount = useMemo(() => {
    if (!workingBlueprint || !sourceBlueprint) {
      return 0;
    }

    return workingBlueprint.objects.filter((object, index) => sourceBlueprint.objects[index]?.typePath !== object.typePath).length;
  }, [sourceBlueprint, workingBlueprint]);

  const handleFileSelection = (event) => {
    const nextFile = Array.from(event.target.files ?? []).find((file) => file.name.toLowerCase().endsWith('.sbp')) ?? null;
    setSelectedFile(nextFile);
    setErrorMessage('');
    setStatusMessage(nextFile ? 'Blueprint selected. Parse to inspect editable conveyor tiers.' : 'Select an `.sbp` file to begin.');
  };

  const handleParse = async () => {
    if (!canParse || !selectedFile) {
      setErrorMessage('Choose a `.sbp` blueprint file first.');
      return;
    }

    setIsParsing(true);
    setErrorMessage('');

    try {
      const [mainBuffer, parserModule] = await Promise.all([
        selectedFile.arrayBuffer(),
        import('@etothepii/satisfactory-file-parser'),
      ]);

      const { BlueprintConfig, BlueprintConfigWriter, Parser } = parserModule;
      const configWriter = new BlueprintConfigWriter();
      BlueprintConfig.Serialize(configWriter, createDefaultBlueprintConfig(descriptionDraft));
      const configBuffer = configWriter.endWriting();
      const parsedBlueprint = Parser.ParseBlueprintFiles(getBlueprintStem(selectedFile.name), mainBuffer, configBuffer, {
        throwErrors: true,
      });

      setSourceBlueprint(parsedBlueprint);
      setWorkingBlueprint(parsedBlueprint);
      setDescriptionDraft(parsedBlueprint.config.description ?? '');
      setStatusMessage(`Loaded ${parsedBlueprint.name}. ${countEditableBlueprintObjects(parsedBlueprint)} conveyor and lift objects are editable.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setStatusMessage('Parse failed. Try a different blueprint file.');
      setWorkingBlueprint(null);
      setSourceBlueprint(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDescriptionChange = (event) => {
    const nextDescription = event.target.value;
    setDescriptionDraft(nextDescription);

    setWorkingBlueprint((currentBlueprint) => {
      if (!currentBlueprint) {
        return currentBlueprint;
      }

      return {
        ...currentBlueprint,
        config: {
          ...currentBlueprint.config,
          description: nextDescription,
        },
      };
    });
  };

  const handleTierChange = (family, currentTier, nextTierValue) => {
    const nextTier = Number(nextTierValue);

    setWorkingBlueprint((currentBlueprint) => {
      if (!currentBlueprint) {
        return currentBlueprint;
      }

      return updateBlueprintConveyorGroupTier(currentBlueprint, family, currentTier, nextTier);
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
          <p className="eyebrow">Mass Upgrader</p>
          <h1>Mass Upgrader retiers Satisfactory conveyors and lifts in a single blueprint export pass.</h1>
          <p className="lede">
            Load a blueprint, inspect grouped conveyor and lift counts, change the tier from a dropdown, and write the modified binary files back out.
          </p>
        </div>

        <div className="hero-stats" aria-label="Current blueprint summary">
          <div>
            <span>Editable groups</span>
            <strong>{groupedObjects.length}</strong>
          </div>
          <div>
            <span>Belts</span>
            <strong>{beltCount}</strong>
          </div>
          <div>
            <span>Lifts</span>
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
          <h2>1. Choose the blueprint file</h2>
          <p>Pick the main `.sbp` file. The app will generate a minimal companion config and let you edit the description in the browser.</p>
        </div>

        <p className="attribution-copy">
          Blueprint parsing is powered by <a href="https://github.com/etothepii4/satisfactory-file-parser" target="_blank" rel="noreferrer">etothepii4/satisfactory-file-parser</a> by etothepii4.
        </p>

        <label className="file-dropzone">
          <input
            type="file"
            accept=".sbp"
            onChange={handleFileSelection}
          />
          <span className="dropzone-title">Drop the blueprint here or browse</span>
          <span className="dropzone-subtitle">Only the `.sbp` file is required.</span>
        </label>

        <div className="file-lineup" aria-live="polite">
          <div>
            <span>Blueprint file</span>
            <strong>{selectedFile ? selectedFile.name : 'Not selected'}</strong>
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
              <h2>2. Edit the description</h2>
              <p>This value will be written back into the exported companion config file.</p>
            </div>
            <div className="blueprint-meta">
              <span>Blueprint name</span>
              <strong>{workingBlueprint.name}</strong>
              <span>Total objects</span>
              <strong>{workingBlueprint.objects.length}</strong>
            </div>
          </div>

          <label className="description-field">
            <span>Description</span>
            <textarea
              rows="4"
              value={descriptionDraft}
              onChange={handleDescriptionChange}
              placeholder="Write a blueprint description"
            />
          </label>

          <div className="summary-grid">
            {groupedObjects.length > 0 ? (
              groupedObjects.map((group) => (
                <article className="summary-row" key={`${group.family}-${group.tier}`}>
                  <div className="summary-row__copy">
                    <div className="summary-row__headline">
                      <strong>{group.count} {group.family === 'belt' ? 'Conveyors' : 'Lifts'}</strong>
                      <span>Tier {group.tier}</span>
                    </div>
                    <div className="summary-row__tags">
                      <span className="tag">{group.family === 'belt' ? 'Conveyor Belt' : 'Conveyor Lift'}</span>
                      {changedCount > 0 ? <span className="tag tag--muted">Edited in app</span> : <span className="tag tag--muted">No change yet</span>}
                    </div>
                  </div>

                  <label className="tier-picker">
                    <span>Tier</span>
                    <select value={group.tier} onChange={(event) => handleTierChange(group.family, group.tier, event.target.value)}>
                      {CONVEYOR_TIER_OPTIONS.filter((option) => option.family === group.family).map((option) => (
                        <option key={option.typePath} value={option.tier}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <h3>No conveyor belts or lifts found</h3>
                <p>The blueprint loaded correctly, but it does not contain any conveyor objects the app knows how to group.</p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="card empty-panel">
          <h2>3. Inspect the parsed result</h2>
          <p>
            Once a blueprint is parsed, the editor shows grouped conveyor and lift counts with dropdowns for changing each tier.
          </p>
        </section>
      )}
    </main>
  );
}

export default App;

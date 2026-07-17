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
  const blueprintName = workingBlueprint?.name ?? (selectedFile ? getBlueprintStem(selectedFile.name) : 'Awaiting blueprint');
  const objectCount = workingBlueprint?.objects.length ?? 0;
  const statusTone = errorMessage ? 'error' : workingBlueprint ? 'loaded' : selectedFile ? 'ready' : 'idle';
  const statusLabel = errorMessage ? 'Error' : workingBlueprint ? 'Loaded' : selectedFile ? 'Ready' : 'Idle';

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
      <section className="card hero hero--status">
        <div className="hero-topline">
          <div>
            <p className="eyebrow">Blueprint Status</p>
            <h1>Mass Upgrader</h1>
          </div>
          <span className={`status-pill status-pill--${statusTone}`}>{statusLabel}</span>
        </div>

        <div className="status-grid" aria-label="Current blueprint summary">
          <article className="status-cell status-cell--file">
            <span>File</span>
            <strong>{blueprintName}</strong>
          </article>
          <article className="status-cell">
            <span>Groups</span>
            <strong>{groupedObjects.length}</strong>
          </article>
          <article className="status-cell">
            <span>Belts</span>
            <strong>{beltCount}</strong>
          </article>
          <article className="status-cell">
            <span>Lifts</span>
            <strong>{liftCount}</strong>
          </article>
          <article className="status-cell">
            <span>Objects</span>
            <strong>{objectCount}</strong>
          </article>
          <article className="status-cell">
            <span>Pending</span>
            <strong>{changedCount}</strong>
          </article>
        </div>

        <p className="lede hero-lede">
          Import one blueprint, inspect grouped conveyor tiers, retier belts and lifts, then export the modified files in a single pass.
        </p>
      </section>

      <section className="card upload-panel">
        <div className="panel-copy panel-copy-spaced panel-copy-spaced--tight">
          <div>
            <p className="section-kicker">Operator Console</p>
            <h2>Load blueprint data and stage the export workflow.</h2>
            <p>Pick the main `.sbp` file. Mass Upgrader generates a minimal companion config, preserves the description draft, and exposes each editable conveyor family as a grouped tier control.</p>
          </div>
          <div className="callout-chip">
            <span>Workflow</span>
            <strong>Import / Parse / Retier / Export</strong>
          </div>
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
          <div>
            <span>Parser state</span>
            <strong>{isParsing ? 'Parsing' : workingBlueprint ? 'Parsed' : selectedFile ? 'Selected' : 'Waiting'}</strong>
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
              <p className="section-kicker">Blueprint Editor</p>
              <h2>Retier grouped conveyors and write the description back into the export.</h2>
              <p>This description is serialized into the companion config file, while each group selector rewrites every matching belt or lift instance in the parsed blueprint.</p>
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
                      <span>Current tier Mk.{group.tier}</span>
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
          <p className="section-kicker">Awaiting Parse</p>
          <h2>Grouped tier controls appear here after a successful parse.</h2>
          <p>
            Once a blueprint is parsed, the editor shows grouped conveyor and lift counts with dropdowns for changing each tier.
          </p>
        </section>
      )}
    </main>
  );
}

export default App;

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { ActionMessage as ActionMessageType, ActionParamSchema } from '../../lib/types';

interface ActionCardProps {
  message: ActionMessageType;
  onExecute: (instanceId: string, params: Record<string, unknown>, originalParams: Record<string, unknown>) => void;
  onCancel?: (instanceId: string) => void;
  isExecuting?: boolean;
}

export function ActionCard({ message, onExecute, onCancel, isExecuting = false }: ActionCardProps) {
  const { instance, template, result, awaitingContinuation } = message;

  // Form state - start with params from instance
  const [formParams, setFormParams] = useState<Record<string, unknown>>(() => {
    // Initialize with instance params or template defaults
    const initial: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(template.parameters)) {
      initial[key] = instance.params[key] ?? schema.default ?? '';
    }
    return initial;
  });

  // Track original params for diff
  const originalParams = useMemo(() => ({ ...instance.params }), [instance.params]);

  // Check if params have been modified
  const hasModifications = useMemo(() => {
    for (const key of Object.keys(formParams)) {
      if (JSON.stringify(formParams[key]) !== JSON.stringify(originalParams[key])) {
        return true;
      }
    }
    return false;
  }, [formParams, originalParams]);

  // Reset to original params
  const handleReset = useCallback(() => {
    setFormParams({ ...originalParams });
  }, [originalParams]);

  // Execute action
  const handleExecute = useCallback(() => {
    onExecute(instance.instanceId, formParams, originalParams);
  }, [instance.instanceId, formParams, originalParams, onExecute]);

  // Update a single param
  const updateParam = useCallback((key: string, value: unknown) => {
    setFormParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Render form field based on schema type
  const renderField = (key: string, schema: ActionParamSchema) => {
    const value = formParams[key];
    const isModified = JSON.stringify(value) !== JSON.stringify(originalParams[key]);

    switch (schema.type) {
      case 'enum':
        return (
          <div key={key} className="space-y-1.5">
            <label className="block text-xs font-medium text-text-secondary">
              {schema.label}
              {schema.required && <span className="text-accent ml-1">*</span>}
              {isModified && <span className="text-accent/60 ml-2 text-[10px]">(modified)</span>}
            </label>
            <select
              value={String(value ?? '')}
              onChange={(e) => updateParam(key, e.target.value)}
              disabled={schema.locked || isExecuting}
              className="w-full bg-surface-elevated border border-border/50 rounded-lg px-3 py-2 text-sm text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {schema.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {schema.description && (
              <p className="text-[10px] text-text-muted">{schema.description}</p>
            )}
          </div>
        );

      case 'text':
        return (
          <div key={key} className="space-y-1.5">
            <label className="block text-xs font-medium text-text-secondary">
              {schema.label}
              {schema.required && <span className="text-accent ml-1">*</span>}
              {isModified && <span className="text-accent/60 ml-2 text-[10px]">(modified)</span>}
            </label>
            {schema.multiline ? (
              <textarea
                value={String(value ?? '')}
                onChange={(e) => updateParam(key, e.target.value)}
                placeholder={schema.placeholder}
                disabled={schema.locked || isExecuting}
                rows={4}
                className="w-full bg-surface-elevated border border-border/50 rounded-lg px-3 py-2 text-sm text-text-primary
                           focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50
                           disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            ) : (
              <input
                type="text"
                value={String(value ?? '')}
                onChange={(e) => updateParam(key, e.target.value)}
                placeholder={schema.placeholder}
                disabled={schema.locked || isExecuting}
                className="w-full bg-surface-elevated border border-border/50 rounded-lg px-3 py-2 text-sm text-text-primary
                           focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50
                           disabled:opacity-50 disabled:cursor-not-allowed"
              />
            )}
            {schema.description && (
              <p className="text-[10px] text-text-muted">{schema.description}</p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={key} className="flex items-center gap-3">
            <input
              type="checkbox"
              id={`action-${instance.instanceId}-${key}`}
              checked={Boolean(value)}
              onChange={(e) => updateParam(key, e.target.checked)}
              disabled={schema.locked || isExecuting}
              className="w-4 h-4 rounded border-border bg-surface-elevated text-accent
                         focus:ring-2 focus:ring-accent/50 focus:ring-offset-0
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label
              htmlFor={`action-${instance.instanceId}-${key}`}
              className="text-sm text-text-primary cursor-pointer"
            >
              {schema.label}
              {isModified && <span className="text-accent/60 ml-2 text-[10px]">(modified)</span>}
            </label>
          </div>
        );

      case 'number':
        return (
          <div key={key} className="space-y-1.5">
            <label className="block text-xs font-medium text-text-secondary">
              {schema.label}
              {schema.required && <span className="text-accent ml-1">*</span>}
              {isModified && <span className="text-accent/60 ml-2 text-[10px]">(modified)</span>}
            </label>
            <input
              type="number"
              value={Number(value) || 0}
              onChange={(e) => updateParam(key, Number(e.target.value))}
              min={schema.min}
              max={schema.max}
              step={schema.step}
              disabled={schema.locked || isExecuting}
              className="w-full bg-surface-elevated border border-border/50 rounded-lg px-3 py-2 text-sm text-text-primary
                         focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {schema.description && (
              <p className="text-[10px] text-text-muted">{schema.description}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Separate basic and advanced parameters
  const basicParams = Object.entries(template.parameters).filter(([_, schema]) => !schema.advanced);
  const advancedParams = Object.entries(template.parameters).filter(([_, schema]) => schema.advanced);

  // Helper to check if path is a video
  const isVideo = (path: string) => /\.(mp4|webm|mov|avi)$/i.test(path);

  // Helper to convert artifact path to URL
  const getArtifactUrl = (path: string) => {
    // If path starts with outputs/, it's a relative path that needs /outputs/ prefix
    if (path.startsWith('outputs/')) {
      return '/' + path;
    }
    // If path already starts with /, use as-is
    if (path.startsWith('/')) {
      return path;
    }
    // Otherwise, assume it needs /outputs/ prefix
    return '/outputs/' + path;
  };

  // Show result summary if completed
  if (result) {
    // Get all artifacts to display
    const artifacts: string[] = [];
    if (result.artifact) {
      artifacts.push(result.artifact);
    }
    if (result.artifacts && result.artifacts.length > 0) {
      artifacts.push(...result.artifacts);
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{template.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-text-primary">{instance.label}</h3>
            <p className="text-xs text-text-secondary mt-0.5">{template.name}</p>

            <div className={`mt-3 flex items-center gap-2 text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              <span>{result.success ? '✓' : '✗'}</span>
              <span>{result.success ? 'Completed' : 'Failed'}</span>
              {result.duration && (
                <span className="text-text-muted">({(result.duration / 1000).toFixed(1)}s)</span>
              )}
            </div>

            {result.message && (
              <p className="mt-2 text-xs text-text-secondary">
                {result.message}
              </p>
            )}

            {result.error && (
              <p className="mt-2 text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded">
                {result.error}
              </p>
            )}

            {/* Render artifacts */}
            {artifacts.length > 0 && (
              <div className="mt-4 space-y-3">
                {artifacts.length === 1 ? (
                  // Single artifact - render full size
                  isVideo(artifacts[0]) ? (
                    <video
                      src={getArtifactUrl(artifacts[0])}
                      controls
                      autoPlay
                      loop
                      muted
                      className="w-full rounded-lg"
                    />
                  ) : (
                    <img
                      src={getArtifactUrl(artifacts[0])}
                      alt={instance.label}
                      className="w-full rounded-lg"
                    />
                  )
                ) : (
                  // Multiple artifacts - render as grid
                  <div className="grid grid-cols-3 gap-2">
                    {artifacts.slice(0, 6).map((artifact, idx) => (
                      <div key={idx} className="relative aspect-square">
                        {isVideo(artifact) ? (
                          <video
                            src={getArtifactUrl(artifact)}
                            className="w-full h-full object-cover rounded-lg"
                            muted
                            loop
                            onMouseEnter={(e) => e.currentTarget.play()}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                          />
                        ) : (
                          <img
                            src={getArtifactUrl(artifact)}
                            alt={`${instance.label} ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        )}
                        <span className="absolute bottom-1 right-1 text-[10px] bg-black/50 px-1.5 py-0.5 rounded text-white">
                          {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {awaitingContinuation && (
              <p className="mt-3 text-xs text-accent">
                Ready to continue. Click the Continue button below or type a message.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Show executing state
  if (isExecuting || instance.status === 'executing') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface/80 backdrop-blur-sm border border-accent/30 rounded-2xl p-4"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl animate-pulse">{template.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-text-primary">{instance.label}</h3>
            <p className="text-xs text-text-secondary mt-0.5">{template.name}</p>

            <div className="mt-3 flex items-center gap-2">
              <div className="thinking-dots">
                <div className="thinking-dot" />
                <div className="thinking-dot" />
                <div className="thinking-dot" />
              </div>
              <span className="text-sm text-text-secondary">Executing...</span>
            </div>

            {onCancel && (
              <button
                onClick={() => onCancel(instance.instanceId)}
                className="mt-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Pending state - show form
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">{template.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-text-primary">{instance.label}</h3>
          <p className="text-xs text-text-secondary mt-0.5">{template.description}</p>
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        {basicParams.map(([key, schema]) => renderField(key, schema))}

        {advancedParams.length > 0 && (
          <details className="group">
            <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary transition-colors">
              Advanced options ({advancedParams.length})
            </summary>
            <div className="mt-3 space-y-4 pl-2 border-l border-border/30">
              {advancedParams.map(([key, schema]) => renderField(key, schema))}
            </div>
          </details>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleExecute}
          disabled={isExecuting}
          className="flex-1 bg-accent hover:bg-accent/90 text-background font-medium py-2.5 px-4 rounded-lg
                     transition-all duration-200 active:scale-[0.98]
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate
        </button>

        {hasModifications && (
          <button
            onClick={handleReset}
            disabled={isExecuting}
            className="text-sm text-text-muted hover:text-text-secondary transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        )}
      </div>
    </motion.div>
  );
}

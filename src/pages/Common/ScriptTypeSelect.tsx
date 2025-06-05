import React, { useEffect, useState } from 'react';
import { ScriptType } from '../types';

export default function ScriptTypeSelect({
  value,
  onChange,
  color,
  fontSize,
  shortDescription,
}: {
  value: ScriptType;
  onChange: (val: ScriptType) => void;
  color?: string;
  fontSize?: number;
  shortDescription?: boolean;
}) {
  return (
    <select
      className="link-button mr-4"
      style={{
        backgroundColor: '#080a0b',
        color: color ?? 'white',
        border: 'none',
        outline: 'none',
        fontSize,
      }}
      onChange={(e) => onChange(e.target.value as ScriptType)}
      value={value}
      data-testid="script-type-select"
    >
      <option value={ScriptType.PlaywrightPython}>
        Playwright-Python{!shortDescription ? ' Library' : ''}
      </option>
      <option value={ScriptType.PlaywrightJS}>
        Playwright-JS{!shortDescription ? ' Library' : ''}
      </option>
      <option value={ScriptType.PlaywrightJava}>
        Playwright-Java{!shortDescription ? ' Library' : ''}
      </option>
      <option value={ScriptType.Eventstream}>
        Eventstream-JS{!shortDescription ? ' Library' : ''}
      </option>
      <option value={ScriptType.Puppeteer}>
        Puppeteer-JS{!shortDescription ? ' Library' : ''}
      </option>
      <option value={ScriptType.Cypress}>
        Cypress-JS{!shortDescription ? ' Library' : ''}
      </option>
    </select>
  );
}

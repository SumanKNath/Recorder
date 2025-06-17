import { getBestSelectorForAction } from './selector';

import { Action, ActionsMode, ScriptLanguage } from '../types';
import {
  ActionType,
  BaseAction,
  ScriptType,
  TagName,
  isSupportedActionType,
} from '../types';
import { config } from '@fortawesome/fontawesome-svg-core';

const FILLABLE_INPUT_TYPES = [
  '',
  'date',
  'datetime',
  'datetime-local',
  'email',
  'month',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'time',
  'url',
  'week',
];

// only used in ActionContext
export const truncateText = (str: string, maxLen: number) => {
  return `${str.substring(0, maxLen)}${str.length > maxLen ? '...' : ''}`;
};

export const isActionStateful = (action: Action) => {
  return action.tagName === TagName.TextArea;
};

type ActionState = {
  causesNavigation: boolean;
  isStateful: boolean;
};

export class ActionContext extends BaseAction {
  private readonly action: Action;

  private readonly scriptType: ScriptType;

  private readonly actionState: ActionState;

  constructor(
    action: Action,
    scriptType: ScriptType,
    actionState: ActionState
  ) {
    super();
    this.action = action;
    this.actionState = actionState;
    this.scriptType = scriptType;
  }

  getType() {
    return this.action.type;
  }

  getTagName() {
    return this.action.tagName;
  }

  getValue() {
    return this.action.value;
  }

  getInputType() {
    return this.action.inputType;
  }

  // (FIXME: shouldn't expose action)
  getAction() {
    return this.action;
  }

  getActionState() {
    return this.actionState;
  }

  getText() {
    const { type, selectors, tagName, value } = this.action;
    return `<${tagName.toLowerCase()}> ${
      selectors.text != null && selectors.text.length > 0
        ? `"${truncateText(selectors.text.replace(/\s/g, ' '), 25)}"`
        : '' //getBestSelectorForAction(this.action, this.scriptType)
    }`;
  }

  getDescription() {
    const { type, selectors, tagName, value } = this.action;

    switch (type) {
      case ActionType.Click:
        return `Click on ${this.getText()}`;
      case ActionType.DblClick:
        return `DblClick on ${this.getText()}`;
      case ActionType.Hover:
        return `Hover over ${this.getText()}`;
      case ActionType.Input:
        return `Fill ${truncateText(
          JSON.stringify(value ?? ''),
          16
        )} on ${this.getText()}`;
      case ActionType.Keydown:
        return `Press ${this.action.key} on ${tagName.toLowerCase()}`;
      case ActionType.Load:
        return `Load "${this.action.url}"`;
      case ActionType.Resize:
        return `Resize window to ${this.action.width} x ${this.action.height}`;
      case ActionType.Wheel:
        return `Scroll wheel by X:${this.action.deltaX}, Y:${this.action.deltaY}`;
      case ActionType.FullScreenshot:
        return `Take full page screenshot`;
      case ActionType.AwaitText:
        return `Wait for text ${truncateText(
          JSON.stringify(this.action.text),
          25
        )} to appear`;
      case ActionType.DragAndDrop:
        return `Drag n drop ${this.getText()} from (${this.action.sourceX}, ${
          this.action.sourceY
        }) to (${this.action.targetX}, ${this.action.targetY})`;
      case ActionType.Voice:
        return 'Voice: ' + this.action.value;
      default:
        return '';
    }
  }

  getBestSelector(): string | null {
    return getBestSelectorForAction(this.action, this.scriptType);
  }
}

export class ScriptConfig {
  showComments: boolean;
  scriptType: ScriptType;
  scriptLanguage: ScriptLanguage;
  padding: string;
  commentPrefix: string;
  lineEnding: string;

  constructor(
    scriptType: ScriptType,
    scriptLanguage: ScriptLanguage,
    showComments: boolean
  ) {
    this.scriptType = scriptType;
    this.showComments = showComments;
    this.scriptLanguage = scriptLanguage;

    if (scriptLanguage == ScriptLanguage.JS) {
      this.padding = '  ';
      this.commentPrefix = '//';
      this.lineEnding = ';';
    } else if (scriptLanguage == ScriptLanguage.Python) {
      this.padding = '\t';
      this.commentPrefix = '#';
      this.lineEnding = '';
    } else if (scriptLanguage == ScriptLanguage.Java) {
      this.padding = '\t';
      this.commentPrefix = '//';
      this.lineEnding = ';';
    }
  }
}

export abstract class ScriptBuilder {
  protected readonly codes: string[];

  protected readonly actionContexts: ActionContext[];

  protected readonly config: ScriptConfig;

  constructor(config: ScriptConfig) {
    this.codes = [];
    this.actionContexts = [];
    this.config = config;
  }

  abstract click: (selector: string, causesNavigation: boolean) => this;

  abstract dblClick: (selector: string, causesNavigation: boolean) => this;

  abstract hover: (selector: string, causesNavigation: boolean) => this;

  abstract load: (url: string) => this;

  abstract resize: (width: number, height: number) => this;

  abstract fill: (
    selector: string,
    value: string,
    causesNavigation: boolean
  ) => this;

  abstract type: (
    selector: string,
    value: string,
    causesNavigation: boolean
  ) => this;

  abstract keydown: (
    selector: string,
    key: string,
    causesNavigation: boolean
  ) => this;

  abstract select: (
    selector: string,
    key: string,
    causesNavigation: boolean
  ) => this;

  abstract wheel: (
    deltaX: number,
    deltaY: number,
    pageXOffset?: number,
    pageYOffset?: number
  ) => this;

  abstract dragAndDrop: (
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number
  ) => this;

  abstract fullScreenshot: () => this;

  abstract awaitText: (test: string) => this;

  abstract buildScript: () => string;

  private transformActionIntoCodes = (actionContext: ActionContext) => {
    if (this.config.showComments) {
      const actionDescription = actionContext.getDescription();
      this.pushComments(`${this.config.commentPrefix} ${actionDescription}`);
    }

    const bestSelector = actionContext.getBestSelector();
    const tagName = actionContext.getTagName();
    const value = actionContext.getValue();
    const inputType = actionContext.getInputType();
    const { causesNavigation } = actionContext.getActionState();
    // (FIXME: getters for special fields)
    const action: any = actionContext.getAction();

    switch (actionContext.getType()) {
      case ActionType.Click:
        this.click(bestSelector as string, causesNavigation);
        break;
      case ActionType.DblClick:
        this.dblClick(bestSelector as string, causesNavigation);
        break;
      case ActionType.Hover:
        this.hover(bestSelector as string, causesNavigation);
        break;
      case ActionType.Keydown:
        this.keydown(
          bestSelector as string,
          action.key ?? '',
          causesNavigation
        );
        break;
      case ActionType.Input: {
        if (tagName === TagName.Select) {
          this.select(bestSelector as string, value ?? '', causesNavigation);
        } else if (
          // If the input is "fillable" or a text area
          tagName === TagName.Input &&
          inputType != null &&
          FILLABLE_INPUT_TYPES.includes(inputType)
        ) {
          // Do more actionability checks
          this.fill(bestSelector as string, value ?? '', causesNavigation);
        } else if (tagName === TagName.TextArea) {
          this.fill(bestSelector as string, value ?? '', causesNavigation);
        } else {
          this.type(bestSelector as string, value ?? '', causesNavigation);
        }
        break;
      }
      case ActionType.Load:
        this.load(action.url);
        break;
      case ActionType.Resize:
        this.resize(action.width, action.height);
        break;
      case ActionType.Wheel:
        this.wheel(
          action.deltaX,
          action.deltaY,
          action.pageXOffset,
          action.pageYOffset
        );
        break;
      case ActionType.FullScreenshot:
        this.fullScreenshot();
        break;
      case ActionType.AwaitText:
        this.awaitText(action.text);
        break;
      case ActionType.DragAndDrop:
        this.dragAndDrop(
          action.sourceX,
          action.sourceY,
          action.targetX,
          action.targetY
        );
        break;
      default:
        break;
    }
  };

  protected pushComments = (comments: string) => {
    this.codes.push('\n');
    this.codes.push(`${this.config.padding}${comments}\n`);
    return this;
  };

  protected pushCodes = (codes: string) => {
    let arr = codes.split('\n');
    for (let i = 0; i < arr.length; i++) {
      this.codes.push(`${this.config.padding}${arr[i]}\n`);
    }
    return this;
  };

  pushActionContext = (actionContext: ActionContext) => {
    this.actionContexts.push(actionContext);
  };

  buildCodes = () => {
    let prevActionContext: ActionContext | undefined;

    for (const actionContext of this.actionContexts) {
      if (!actionContext.getActionState().isStateful) {
        if (
          prevActionContext !== undefined &&
          prevActionContext.getActionState().isStateful
        ) {
          this.transformActionIntoCodes(prevActionContext);
        }
        this.transformActionIntoCodes(actionContext);
      }
      prevActionContext = actionContext;
    }

    // edge case
    if (
      prevActionContext !== undefined &&
      prevActionContext.getActionState().isStateful
    ) {
      this.transformActionIntoCodes(prevActionContext);
    }
    return this;
  };

  // for test
  getLatestCode = () => this.codes[this.codes.length - 1];
}

export class PlaywrightJSScriptBuilder extends ScriptBuilder {
  private waitForNavigation() {
    return `page.waitForNavigation()`;
  }

  private waitForActionAndNavigation(action: string) {
    return `await Promise.all([\n    ${action},\n    ${this.waitForNavigation()}\n  ]);`;
  }

  click = (selector: string, causesNavigation: boolean) => {
    const actionStr = `page.click('${selector}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `await ${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  dblClick = (selector: string, causesNavigation: boolean) => {
    const actionStr = `page.dblclick('${selector}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `await ${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  hover = (selector: string, causesNavigation: boolean) => {
    const actionStr = `page.hover('${selector}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `await ${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  load = (url: string) => {
    this.pushCodes(`await page.goto('${url}');`);
    return this;
  };

  resize = (width: number, height: number) => {
    this.pushCodes(
      `await page.setViewportSize({ width: ${width}, height: ${height} });`
    );
    return this;
  };

  fill = (selector: string, value: string, causesNavigation: boolean) => {
    const actionStr = `page.fill('${selector}', '${JSON.stringify(value)}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `await ${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  type = (selector: string, value: string, causesNavigation: boolean) => {
    const actionStr = `page.type('${selector}', '${JSON.stringify(value)}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `await ${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  select = (selector: string, option: string, causesNavigation: boolean) => {
    const actionStr = `page.selectOption('${selector}', '${option}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `await ${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  keydown = (selector: string, key: string, causesNavigation: boolean) => {
    const actionStr = `page.press('${selector}', '${key}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `await ${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  wheel = (deltaX: number, deltaY: number) => {
    this.pushCodes(
      `await page.mouse.wheel(${Math.floor(deltaX)}, ${Math.floor(deltaY)});`
    );
    return this;
  };

  fullScreenshot = () => {
    this.pushCodes(
      `await page.screenshot({ path: 'screenshot.png', fullPage: true });`
    );
    return this;
  };

  awaitText = (text: string) => {
    this.pushCodes(`await page.waitForSelector('text=${text}');`);
    return this;
  };

  dragAndDrop = (
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number
  ) => {
    this.pushCodes(
      [
        `await page.mouse.move(${sourceX}, ${sourceY});`,
        '  await page.mouse.down();',
        `  await page.mouse.move(${targetX}, ${targetY});`,
        '  await page.mouse.up();',
      ].join('\n')
    );
    return this;
  };

  buildScript = () => {
    return `import { test, expect } from '@playwright/test';

test('Written with Web UI Recorder', async ({ page }) => {${this.codes.join(
      ''
    )}});`;
  };
}

export class PlaywrightPythonScriptBuilder extends ScriptBuilder {
  private waitForActionAndNavigation(action: string, wait: boolean) {
    return wait ? `${action}\nawait asyncio.sleep(2)` : action;
  }

  click = (selectorStr: string, causesNavigation: boolean) => {
    const actionStr = `await interact(page, '${selectorStr}', "click")`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  dblClick = (selectorStr: string, causesNavigation: boolean) => {
    const actionStr = `await interact(page, '${selectorStr}', "dblclick")`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  hover = (selectorStr: string, causesNavigation: boolean) => {
    const actionStr = `await interact(page, '${selectorStr}', "hover")`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  load = (url: string) => {
    this.pushCodes(`await page.goto('${url}')`);
    return this;
  };

  resize = (width: number, height: number) => {
    this.pushCodes(
      `await page.set_viewport_size({ "width": ${width}, "height": ${height} })`
    );
    return this;
  };

  fill = (selectorStr: string, value: string, causesNavigation: boolean) => {
    const actionStr = `await interact(page, '${selectorStr}', "fill", '${value}');`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  type = (selectorStr: string, value: string, causesNavigation: boolean) => {
    const actionStr = `await interact(page, '${selectorStr}', "type", '${value}');`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  select = (selectorStr: string, option: string, causesNavigation: boolean) => {
    const actionStr = `await interact(page, '${selectorStr}', "select_option", '${option}');`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  keydown = (selectorStr: string, key: string, causesNavigation: boolean) => {
    const actionStr = ['r', 'R'].includes(key)
      ? `v = await read_inner_text(page, '${selectorStr}')\nprint(v)`
      : `interact(page, '${selectorStr}', "press", '${key}');`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  wheel = (deltaX: number, deltaY: number) => {
    this.pushCodes(
      `await page.mouse.wheel(${Math.floor(deltaX)}, ${Math.floor(deltaY)})`
    );
    return this;
  };

  fullScreenshot = () => {
    this.pushCodes(
      `await page.screenshot({ path: 'screenshot.png', fullPage: true })`
    );
    return this;
  };

  awaitText = (text: string) => {
    this.pushCodes(`await page.wait_for_selector('text=${text}')`);
    return this;
  };

  dragAndDrop = (
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number
  ) => {
    this.pushCodes(
      [
        `await page.mouse.move(${sourceX}, ${sourceY})`,
        'await page.mouse.down()',
        `await page.mouse.move(${targetX}, ${targetY})`,
        'await page.mouse.up()',
      ].join('\n')
    );
    return this;
  };

  scriptPrefix = () => {
    return `from playwright.async_api import async_playwright
import asyncio

async def read_inner_text(page, selectors):
  for s in set(selectors.split('|')):
    if s:
      element = await page.query_selector(s)
      if element:
        return await element.inner_text()

async def interact(page, selectors, action, value=None):
  for s in set(selectors.split('|')):
    if s and await page.query_selector(s):
      await getattr(page, action)(s, value) if value else await getattr(page, action)(s)
      break

async def execute(page):`;
  };

  buildScript = () => {
    return `${this.scriptPrefix()}\n${this.codes.join('')}`;
  };
}

export class PlaywrightJavaScriptBuilder extends ScriptBuilder {
  protected varCreated: boolean = false;

  private waitForActionAndNavigation(action: string, wait: boolean) {
    return wait ? `${action};\npage.waitForTimeout(2000);` : action;
  }

  private escapeQuotes(input: string): string {
    return input.replace(/"/g, '\\"');
  }

  click = (selectorStr: string, causesNavigation: boolean) => {
    const actionStr = `interact(page, "${this.escapeQuotes(
      selectorStr
    )}", "click", null);`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  dblClick = (selectorStr: string, causesNavigation: boolean) => {
    const actionStr = `interact(page, "${this.escapeQuotes(
      selectorStr
    )}", "dblclick", null);`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  hover = (selectorStr: string, causesNavigation: boolean) => {
    const actionStr = `interact(page, "${this.escapeQuotes(
      selectorStr
    )}", "hover", null);`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  load = (url: string) => {
    this.pushCodes(`page.navigate('${url}');`);
    return this;
  };

  resize = (width: number, height: number) => {
    this.pushCodes(`page.setViewportSize(${width}, ${height});`);
    return this;
  };

  fill = (selectorStr: string, value: string, causesNavigation: boolean) => {
    const actionStr = `interact(page, "${this.escapeQuotes(
      selectorStr
    )}", "fill", value);`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  type = (selectorStr: string, value: string, causesNavigation: boolean) => {
    const actionStr = `interact(page, "${this.escapeQuotes(
      selectorStr
    )}", "type", value);`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  select = (selectorStr: string, option: string, causesNavigation: boolean) => {
    const actionStr = `interact(page, "${this.escapeQuotes(
      selectorStr
    )}", "selectOption", option);`;
    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  keydown = (selectorStr: string, key: string, causesNavigation: boolean) => {
    selectorStr = this.escapeQuotes(selectorStr);

    const actionStr = ['r', 'R'].includes(key)
      ? `v = readInnerText(page, '${selectorStr}')\nprint(v)`
      : `interact(page, '${selectorStr}', "press", '${key}');`;

    this.pushCodes(
      this.waitForActionAndNavigation(actionStr, causesNavigation)
    );
    return this;
  };

  wheel = (deltaX: number, deltaY: number) => {
    this.pushCodes(
      `page.mouse().wheel(${Math.floor(deltaX)}, ${Math.floor(deltaY)});`
    );
    return this;
  };

  fullScreenshot = () => {
    this.pushCodes(
      `page.screenshot(new Page.ScreenshotOptions().setPath("screenshot.png").setFullPage(true));`
    );
    return this;
  };

  awaitText = (text: string) => {
    this.pushCodes(`await page.waitForSelector('text=${text}');`);
    return this;
  };

  dragAndDrop = (
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number
  ) => {
    this.pushCodes(
      [
        `page.mouse().move(${sourceX}, ${sourceY});`,
        'page.mouse().down();',
        `page.mouse().move(${targetX}, ${targetY});`,
        'page.mouse().up();',
      ].join('\n')
    );
    return this;
  };

  scriptPrefix = () => {
    return `import com.microsoft.playwright.*;
import java.util.Arrays;
import java.util.LinkedHashSet;

public class AutomationScript {
  public static void execute(Page page) {`;
  };

  scriptSuffix = () => {
    return `
  }
    
  private static String readInnerText(Page page, String selectors) {
    for (String selector : new LinkedHashSet<>(Arrays.asList(selectors.split("\\|")))) {
      if (!selector.isEmpty()) {
        ElementHandle element = page.querySelector(selector);
        if (element != null) {
          return element.innerText();
        }
      }
    }
    return null;
  }

  private static void interact(Page page, String selectorString, String action, String value) {
    for (String selector : selectorString.split("\\|")) {
      if (!selector.isEmpty() && page.querySelector(selector) != null) {
        if ("click".equals(action)) page.click(selector);
        else if ("fill".equals(action)) page.fill(selector, value);
        else if ("press".equals(action)) page.press(selector, value);
        else if ("hover".equals(action)) page.hover(selector);
        else if ("selectOption".equals(action)) page.selectOption(selector, value);
        break;
      }
    }
  }`;
  };

  buildScript = () => {
    return `${this.scriptPrefix()}
${this.codes.join('')}
${this.scriptSuffix()}
`;
  };
}

export class PuppeteerScriptBuilder extends ScriptBuilder {
  private waitForSelector(selector: string) {
    return `page.waitForSelector('${selector}')`;
  }
  private waitForNavigation() {
    return `page.waitForNavigation()`;
  }
  private waitForSelectorAndNavigation(selector: string, action: string) {
    return `await ${this.waitForSelector(
      selector
    )};\n  await Promise.all([\n    ${action},\n    ${this.waitForNavigation()}\n  ]);`;
  }

  click = (selector: string, causesNavigation: boolean) => {
    const pageClick = `page.click('${selector}')`;
    if (causesNavigation) {
      this.pushCodes(this.waitForSelectorAndNavigation(selector, pageClick));
    } else {
      this.pushCodes(
        `await ${this.waitForSelector(selector)};\n  await ${pageClick};`
      );
    }
    return this;
  };

  dblClick = (selector: string, causesNavigation: boolean) => {
    const pageClick = `page.dblclick('${selector}')`;
    if (causesNavigation) {
      this.pushCodes(this.waitForSelectorAndNavigation(selector, pageClick));
    } else {
      this.pushCodes(
        `await ${this.waitForSelector(selector)};\n  await ${pageClick};`
      );
    }
    return this;
  };

  hover = (selector: string, causesNavigation: boolean) => {
    const pageHover = `page.hover('${selector}')`;
    if (causesNavigation) {
      this.pushCodes(this.waitForSelectorAndNavigation(selector, pageHover));
    } else {
      this.pushCodes(
        `await ${this.waitForSelector(selector)};\n  await ${pageHover};`
      );
    }
    return this;
  };

  load = (url: string) => {
    this.pushCodes(`await page.goto('${url}');`);
    return this;
  };

  resize = (width: number, height: number) => {
    this.pushCodes(
      `await page.setViewport({ width: ${width}, height: ${height} });`
    );
    return this;
  };

  type = (selector: string, value: string, causesNavigation: boolean) => {
    const pageType = `page.type('${selector}', ${JSON.stringify(value)})`;
    if (causesNavigation) {
      this.pushCodes(this.waitForSelectorAndNavigation(selector, pageType));
    } else {
      this.pushCodes(
        `await ${this.waitForSelector(selector)};\n  await ${pageType};`
      );
    }
    return this;
  };

  // Puppeteer doesn't support `fill` so we'll do our own actionability checks
  // but still type
  fill = (selector: string, value: string, causesNavigation: boolean) => {
    const pageType = `page.type('${selector}', ${JSON.stringify(value)})`;
    if (causesNavigation) {
      this.pushCodes(
        this.waitForSelectorAndNavigation(
          `${selector}:not([disabled])`,
          pageType
        )
      );
    } else {
      // Do more actionability checks
      this.pushCodes(
        `await ${this.waitForSelector(
          `${selector}:not([disabled])`
        )};\n  await ${pageType};`
      );
    }
    return this;
  };

  select = (selector: string, option: string, causesNavigation: boolean) => {
    const pageSelectOption = `page.select('${selector}', '${option}')`;
    if (causesNavigation) {
      this.pushCodes(
        this.waitForSelectorAndNavigation(selector, pageSelectOption)
      );
    } else {
      this.pushCodes(
        `await ${this.waitForSelector(selector)};\n  await ${pageSelectOption};`
      );
    }
    return this;
  };

  keydown = (selector: string, key: string, causesNavigation: boolean) => {
    const pagePress = `page.keyboard.press('${key}')`;
    if (causesNavigation) {
      this.pushCodes(this.waitForSelectorAndNavigation(selector, pagePress));
    } else {
      this.pushCodes(
        `await page.waitForSelector('${selector}');\n  await page.keyboard.press('${key}');`
      );
    }
    return this;
  };

  wheel = (deltaX: number, deltaY: number) => {
    this.pushCodes(
      `await page.evaluate(() => window.scrollBy(${deltaX}, ${deltaY}));`
    );
    return this;
  };

  fullScreenshot = () => {
    this.pushCodes(
      `await page.screenshot({ path: 'screenshot.png', fullPage: true });`
    );
    return this;
  };

  awaitText = (text: string) => {
    this.pushCodes(
      `await page.waitForFunction("document.body.innerText.includes('${text}')");`
    );
    return this;
  };

  dragAndDrop = (
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number
  ) => {
    this.pushCodes(
      [
        `await page.mouse.move(${sourceX}, ${sourceY});`,
        '  await page.mouse.down();',
        `  await page.mouse.move(${targetX}, ${targetY});`,
        '  await page.mouse.up();',
      ].join('\n')
    );
    return this;
  };

  buildScript = () => {
    return `const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    // headless: false, slowMo: 100, // Uncomment to visualize test
  });
  const page = await browser.newPage();
${this.codes.join('')}
  await browser.close();
})();`;
  };
}

export class CypressScriptBuilder extends ScriptBuilder {
  // Cypress automatically detects and waits for the page to finish loading
  click = (selector: string, causesNavigation: boolean) => {
    this.pushCodes(`cy.get('${selector}').click();`);
    return this;
  };

  dblClick = (selector: string, causesNavigation: boolean) => {
    this.pushCodes(`cy.get('${selector}').dblclick();`);
    return this;
  };

  hover = (selector: string, causesNavigation: boolean) => {
    this.pushCodes(`cy.get('${selector}').trigger('mouseover');`);
    return this;
  };

  load = (url: string) => {
    this.pushCodes(`cy.visit('${url}');`);
    return this;
  };

  resize = (width: number, height: number) => {
    this.pushCodes(`cy.viewport(${width}, ${height});`);
    return this;
  };

  fill = (selector: string, value: string, causesNavigation: boolean) => {
    this.pushCodes(`cy.get('${selector}').type(${JSON.stringify(value)});`);
    return this;
  };

  type = (selector: string, value: string, causesNavigation: boolean) => {
    this.pushCodes(`cy.get('${selector}').type(${JSON.stringify(value)});`);
    return this;
  };

  select = (selector: string, option: string, causesNavigation: boolean) => {
    this.pushCodes(`cy.get('${selector}').select('${option}');`);
    return this;
  };

  keydown = (selector: string, key: string, causesNavigation: boolean) => {
    this.pushCodes(`cy.get('${selector}').type('{${key}}');`);
    return this;
  };

  wheel = (
    deltaX: number,
    deltaY: number,
    pageXOffset?: number,
    pageYOffset?: number
  ) => {
    this.pushCodes(
      `cy.scrollTo(${Math.floor(pageXOffset ?? 0)}, ${Math.floor(
        pageYOffset ?? 0
      )});`
    );
    return this;
  };

  fullScreenshot = () => {
    this.pushCodes(`cy.screenshot();`);
    return this;
  };

  awaitText = (text: string) => {
    this.pushCodes(`cy.contains('${text}');`);
    return this;
  };

  dragAndDrop = (
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number
  ) => {
    // TODO -> IMPLEMENT ME
    this.pushCodes('');
    return this;
  };

  buildScript = () => {
    return `it('Written with Web UI Recorder', () => {${this.codes.join(
      ''
    )}});`;
  };
}

export class EventstreamScriptBuilder extends ScriptBuilder {
  private waitForNavigation() {
    return `WaitForNavigation()`;
  }

  private waitForActionAndNavigation(action: string) {
    return `PromiseAll([\n    ${action},\n    ${this.waitForNavigation()}\n  ]);`;
  }

  click = (selector: string, causesNavigation: boolean) => {
    const actionStr = `Click('${selector}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  dblClick = (selector: string, causesNavigation: boolean) => {
    const actionStr = `DblClick('${selector}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  hover = (selector: string, causesNavigation: boolean) => {
    const actionStr = `Hover('${selector}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  load = (url: string) => {
    this.pushCodes(`Goto('${url}');`);
    return this;
  };

  resize = (width: number, height: number) => {
    this.pushCodes(`SetViewportSize({ width: ${width}, height: ${height} });`);
    return this;
  };

  fill = (selector: string, value: string, causesNavigation: boolean) => {
    const actionStr = `Fill('${selector}', ${JSON.stringify(value)})`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  type = (selector: string, value: string, causesNavigation: boolean) => {
    const actionStr = `Type('${selector}', ${JSON.stringify(value)})`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  select = (selector: string, option: string, causesNavigation: boolean) => {
    const actionStr = `SelectOption('${selector}', '${option}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  keydown = (selector: string, key: string, causesNavigation: boolean) => {
    const actionStr = `Press('${selector}', '${key}')`;
    const action = causesNavigation
      ? this.waitForActionAndNavigation(actionStr)
      : `${actionStr};`;
    this.pushCodes(action);
    return this;
  };

  wheel = (deltaX: number, deltaY: number) => {
    this.pushCodes(`MouseWheel(${Math.floor(deltaX)}, ${Math.floor(deltaY)});`);
    return this;
  };

  fullScreenshot = () => {
    this.pushCodes(`Screenshot({ path: 'screenshot.png', fullPage: true });`);
    return this;
  };

  awaitText = (text: string) => {
    this.pushCodes(`WaitForSelector('text=${text}');`);
    return this;
  };

  dragAndDrop = (
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number
  ) => {
    this.pushCodes(
      [
        `MouseMove(${sourceX}, ${sourceY});`,
        '  MouseDown();',
        `  MouseMove(${targetX}, ${targetY});`,
        '  MouseUp();',
      ].join('\n')
    );
    return this;
  };

  buildScript = () => {
    return `test('Written with Web UI Recorder', async ({ page }) => {${this.codes.join(
      ''
    )}});`;
  };
}

export const genCode = (
  actions: Action[],
  showComments: boolean,
  scriptType: ScriptType
): string => {
  let scriptBuilder: ScriptBuilder;
  let config: ScriptConfig;

  switch (scriptType) {
    case ScriptType.PlaywrightPython:
      config = new ScriptConfig(
        ScriptType.PlaywrightPython,
        ScriptLanguage.Python,
        showComments
      );
      scriptBuilder = new PlaywrightPythonScriptBuilder(config);
      break;
    case ScriptType.PlaywrightJS:
      config = new ScriptConfig(
        ScriptType.PlaywrightJS,
        ScriptLanguage.JS,
        showComments
      );
      scriptBuilder = new PlaywrightJSScriptBuilder(config);
      break;
    case ScriptType.PlaywrightJava:
      config = new ScriptConfig(
        ScriptType.PlaywrightJava,
        ScriptLanguage.Java,
        showComments
      );
      scriptBuilder = new PlaywrightJavaScriptBuilder(config);
      break;
    case ScriptType.Puppeteer:
      config = new ScriptConfig(
        ScriptType.Puppeteer,
        ScriptLanguage.JS,
        showComments
      );
      scriptBuilder = new PuppeteerScriptBuilder(config);
      break;
    case ScriptType.Cypress:
      config = new ScriptConfig(
        ScriptType.Cypress,
        ScriptLanguage.JS,
        showComments
      );
      scriptBuilder = new CypressScriptBuilder(config);
      break;
    case ScriptType.Eventstream:
      config = new ScriptConfig(
        ScriptType.Eventstream,
        ScriptLanguage.JS,
        showComments
      );
      scriptBuilder = new EventstreamScriptBuilder(config);
      break;
    default:
      throw new Error('Unsupported script type');
  }

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    if (!isSupportedActionType(action.type)) {
      continue;
    }

    const nextAction = actions[i + 1];
    const causesNavigation = nextAction?.type === ActionType.Navigate;

    scriptBuilder.pushActionContext(
      new ActionContext(action, config.scriptType, {
        causesNavigation,
        isStateful: isActionStateful(action),
      })
    );
  }

  return scriptBuilder.buildCodes().buildScript();
};

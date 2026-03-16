/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Shared route handlers for browser automation services (Scraper & Tab)
 *
 * This module provides common route registration for operations that are
 * identical between WebScraper and TabManager services.
 */

import type {
  NamespaceBuilder,
  Context as RouterContext,
} from "../router.sys.mts";
import type {
  ErrorResponse,
  OkResponse,
} from "../_os-plugin/api-spec/types.ts";
import type { BrowserAutomationService, ScreenshotRect, WaitForElementState } from "./types.ts";

const FINGERPRINT_REGEX = /^[a-z0-9]{8}([a-z0-9]{8})?$/;

/**
 * Resolves a CSS selector from either a direct selector or element fingerprint.
 * Priority: selector > fingerprint
 *
 * @param service - The browser automation service
 * @param instanceId - The instance ID
 * @param selector - Optional CSS selector (takes priority)
 * @param fingerprint - Optional element fingerprint (8 or 16 lowercase alphanumeric chars)
 * @returns Resolved CSS selector string (empty string if neither provided)
 */
async function resolveSelector(
  service: BrowserAutomationService,
  instanceId: string,
  selector?: string | null,
  fingerprint?: string | null,
): Promise<string> {
  if (selector) return selector;
  if (fingerprint && FINGERPRINT_REGEX.test(fingerprint) && service.resolveFingerprint) {
    return (await service.resolveFingerprint(instanceId, fingerprint)) ?? "";
  }
  return "";
}

/**
 * Registers common automation routes that are shared between Scraper and Tab services.
 *
 * @param ns - The namespace builder to register routes on (already scoped to /scraper or /tabs)
 * @param getService - Function to lazily obtain the service instance
 * @param options - Configuration options for route behavior
 */
export function registerCommonAutomationRoutes(
  ns: NamespaceBuilder,
  getService: () => BrowserAutomationService,
  options: {
    /** Whether to include getElement route (Tab has it, Scraper does not expose it separately) */
    includeGetElement?: boolean;
  } = {},
): void {
  // Navigate to a URL
  ns.post<{ url: string }, OkResponse | ErrorResponse>(
    "/instances/:id/navigate",
    async (ctx: RouterContext<{ url: string }>) => {
      const json = ctx.json();
      if (!json?.url) {
        return { status: 400, body: { error: "url required" } };
      }
      const service = getService();
      await service.navigate(ctx.params.id, json.url);
      return { status: 200, body: { ok: true } };
    },
  );

  // Get current URI
  ns.get("/instances/:id/uri", async (ctx: RouterContext) => {
    const service = getService();
    const uri = await service.getURI(ctx.params.id);
    return { status: 200, body: uri != null ? { uri } : { uri: null } };
  });

  // Get page HTML
  ns.get("/instances/:id/html", async (ctx: RouterContext) => {
    const service = getService();
    const html = await service.getHTML(ctx.params.id);
    return { status: 200, body: html != null ? { html } : {} };
  });

  // Get visible text content (as Markdown)
  ns.get("/instances/:id/text", async (ctx: RouterContext) => {
    const service = getService();
    const text = await service.getText(ctx.params.id);
    return { status: 200, body: text != null ? { text } : {} };
  });

  // Get element by selector (optional - only Tab exposes this)
  if (options.includeGetElement) {
    ns.get("/instances/:id/element", async (ctx: RouterContext) => {
      const service = getService();
      const sel = await resolveSelector(
        service, ctx.params.id,
        ctx.searchParams.get("selector"), ctx.searchParams.get("fingerprint"),
      );
      if (!service.getElement) {
        return { status: 200, body: {} };
      }
      const element = await service.getElement(ctx.params.id, sel);
      return { status: 200, body: element != null ? { element } : {} };
    });
  }

  // Get element text by selector (supports selector OR fingerprint)
  ns.get("/instances/:id/elementText", async (ctx: RouterContext) => {
    const service = getService();
    const sel = await resolveSelector(
      service, ctx.params.id,
      ctx.searchParams.get("selector"), ctx.searchParams.get("fingerprint"),
    );
    const text = await service.getElementText(ctx.params.id, sel);
    return { status: 200, body: text != null ? { text } : {} };
  });

  // Get all matching elements (outerHTML array) - supports selector OR fingerprint
  ns.get("/instances/:id/elements", async (ctx: RouterContext) => {
    const service = getService();
    const sel = await resolveSelector(
      service, ctx.params.id,
      ctx.searchParams.get("selector"), ctx.searchParams.get("fingerprint"),
    );
    const elems = await service.getElements(ctx.params.id, sel);
    return { status: 200, body: { elements: elems } };
  });

  // Get element by text content
  ns.get("/instances/:id/elementByText", async (ctx: RouterContext) => {
    const txt = ctx.searchParams.get("text") ?? "";
    const service = getService();
    const elem = await service.getElementByText(ctx.params.id, txt);
    return { status: 200, body: { element: elem } };
  });

  // Get element text content by selector - supports selector OR fingerprint
  ns.get("/instances/:id/elementTextContent", async (ctx: RouterContext) => {
    const service = getService();
    const sel = await resolveSelector(
      service, ctx.params.id,
      ctx.searchParams.get("selector"), ctx.searchParams.get("fingerprint"),
    );
    const text = await service.getElementTextContent(ctx.params.id, sel);
    return { status: 200, body: text != null ? { text } : {} };
  });

  // Resolve fingerprint to CSS selector
  ns.get("/instances/:id/resolveFingerprint", async (ctx: RouterContext) => {
    const fingerprint = ctx.searchParams.get("fingerprint") ?? "";

    // Validate fingerprint format (8 or 16 alphanumeric lowercase chars)
    if (!fingerprint || !/^[a-z0-9]{8}([a-z0-9]{8})?$/.test(fingerprint)) {
      return { status: 400, body: { error: "Invalid fingerprint format. Expected 8 or 16 lowercase alphanumeric characters." } };
    }

    const service = getService();
    if (!service.resolveFingerprint) {
      return { status: 501, body: { error: "fingerprint resolution not supported" } };
    }
    const selector = await service.resolveFingerprint(ctx.params.id, fingerprint);
    return { status: 200, body: selector != null ? { selector } : {} };
  });

  // Clear all visual effects (highlights, overlays, info panels)
  ns.post("/instances/:id/clearEffects", async (ctx: RouterContext) => {
    const service = getService();
    if (!service.clearEffects) {
      return { status: 501, body: { error: "clearEffects not supported" } };
    }
    const ok = await service.clearEffects(ctx.params.id);
    return { status: 200, body: { ok } };
  });

  // Click element (supports selector OR fingerprint)
  ns.post("/instances/:id/click", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    const okClicked = await service.clickElement(ctx.params.id, sel);
    return { status: 200, body: { ok: okClicked ?? false } };
  });

  // Wait for element to appear - supports selector OR fingerprint
  ns.post("/instances/:id/waitForElement", async (ctx: RouterContext) => {
    const json = ctx.json() as {
      selector?: string;
      fingerprint?: string;
      timeout?: number;
      state?: WaitForElementState;
    } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    const to = json?.timeout ?? 5000;
    const state = json?.state ?? "attached";
    const found = await service.waitForElement(ctx.params.id, sel, to, state);
    return { status: 200, body: { ok: found ?? false } };
  });

  // Take viewport screenshot
  ns.get("/instances/:id/screenshot", async (ctx: RouterContext) => {
    const service = getService();
    const image = await service.takeScreenshot(ctx.params.id);
    return { status: 200, body: image != null ? { image } : {} };
  });

  // Take element screenshot - supports selector OR fingerprint
  ns.get("/instances/:id/elementScreenshot", async (ctx: RouterContext) => {
    const selParam = ctx.searchParams.get("selector");
    const fpParam = ctx.searchParams.get("fingerprint");
    const service = getService();

    let sel = selParam ?? "";
    if (!sel && fpParam && /^[a-z0-9]{8}([a-z0-9]{8})?$/.test(fpParam) && service.resolveFingerprint) {
      sel = (await service.resolveFingerprint(ctx.params.id, fpParam)) ?? "";
    }

    const image = await service.takeElementScreenshot(ctx.params.id, sel);
    return { status: 200, body: image != null ? { image } : {} };
  });

  // Take full page screenshot
  ns.get("/instances/:id/fullPageScreenshot", async (ctx: RouterContext) => {
    const service = getService();
    const image = await service.takeFullPageScreenshot(ctx.params.id);
    return { status: 200, body: image != null ? { image } : {} };
  });

  // Take region screenshot
  ns.post("/instances/:id/regionScreenshot", async (ctx: RouterContext) => {
    const json = ctx.json() as { rect?: ScreenshotRect } | null;
    const service = getService();
    const image = await service.takeRegionScreenshot(ctx.params.id, json?.rect);
    return { status: 200, body: image != null ? { image } : {} };
  });

  // Fill form fields
  ns.post("/instances/:id/fillForm", async (ctx: RouterContext) => {
    const json = ctx.json() as {
      formData?: { [selector: string]: string };
      typingMode?: boolean;
      typingDelayMs?: number;
    } | null;
    const service = getService();
    const okFilled = await service.fillForm(
      ctx.params.id,
      json?.formData ?? {},
      { typingMode: json?.typingMode, typingDelayMs: json?.typingDelayMs },
    );
    return { status: 200, body: { ok: okFilled } };
  });

  // Get input value - supports selector OR fingerprint
  ns.get("/instances/:id/value", async (ctx: RouterContext) => {
    const selParam = ctx.searchParams.get("selector");
    const fpParam = ctx.searchParams.get("fingerprint");
    const service = getService();

    let sel = selParam ?? "";
    if (!sel && fpParam && /^[a-z0-9]{8}([a-z0-9]{8})?$/.test(fpParam) && service.resolveFingerprint) {
      sel = (await service.resolveFingerprint(ctx.params.id, fpParam)) ?? "";
    }

    const value = await service.getValue(ctx.params.id, sel);
    return { status: 200, body: value != null ? { value } : {} };
  });

  // Submit form - supports selector OR fingerprint
  ns.post("/instances/:id/submit", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    const submitted = await service.submit(ctx.params.id, sel);
    return { status: 200, body: { ok: submitted } };
  });

  // Clear input field - supports selector OR fingerprint
  ns.post("/instances/:id/clearInput", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    const cleared = await service.clearInput(ctx.params.id, sel);
    return { status: 200, body: { ok: cleared } };
  });

  // Get element attribute - supports selector OR fingerprint
  ns.get("/instances/:id/attribute", async (ctx: RouterContext) => {
    const attr = ctx.searchParams.get("name") ?? "";
    const service = getService();
    const sel = await resolveSelector(
      service, ctx.params.id,
      ctx.searchParams.get("selector"), ctx.searchParams.get("fingerprint"),
    );
    const value = await service.getAttribute(ctx.params.id, sel, attr);
    return { status: 200, body: value != null ? { value } : { value: null } };
  });

  // Check if element is visible - supports selector OR fingerprint
  ns.get("/instances/:id/isVisible", async (ctx: RouterContext) => {
    const service = getService();
    const sel = await resolveSelector(
      service, ctx.params.id,
      ctx.searchParams.get("selector"), ctx.searchParams.get("fingerprint"),
    );
    const visible = await service.isVisible(ctx.params.id, sel);
    return { status: 200, body: { visible } };
  });

  // Check if element is enabled - supports selector OR fingerprint
  ns.get("/instances/:id/isEnabled", async (ctx: RouterContext) => {
    const service = getService();
    const sel = await resolveSelector(
      service, ctx.params.id,
      ctx.searchParams.get("selector"), ctx.searchParams.get("fingerprint"),
    );
    const enabled = await service.isEnabled(ctx.params.id, sel);
    return { status: 200, body: { enabled } };
  });

  // Select option in a select element - supports selector OR fingerprint
  ns.post("/instances/:id/selectOption", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string; value?: string } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    const value = json?.value ?? "";
    const ok = await service.selectOption(ctx.params.id, sel, value);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Set checked state of checkbox/radio - supports selector OR fingerprint
  ns.post("/instances/:id/setChecked", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string; checked?: boolean } | null;
    const service = getService();

    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    const checked = json?.checked ?? false;
    const ok = await service.setChecked(ctx.params.id, sel, checked);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Hover over element - supports selector OR fingerprint
  ns.post("/instances/:id/hover", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    const ok = await service.hoverElement(ctx.params.id, sel);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Scroll to element - supports selector OR fingerprint
  ns.post("/instances/:id/scrollTo", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    const ok = await service.scrollToElement(ctx.params.id, sel);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Get page title
  ns.get("/instances/:id/title", async (ctx: RouterContext) => {
    const service = getService();
    const title = await service.getPageTitle(ctx.params.id);
    return { status: 200, body: title != null ? { title } : { title: null } };
  });

  // Double click element - supports selector OR fingerprint
  ns.post("/instances/:id/doubleClick", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    if (!service.doubleClick) {
      return { status: 501, body: { error: "doubleClick not supported" } };
    }
    const ok = await service.doubleClick(ctx.params.id, sel);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Right click element - supports selector OR fingerprint
  ns.post("/instances/:id/rightClick", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    if (!service.rightClick) {
      return { status: 501, body: { error: "rightClick not supported" } };
    }
    const ok = await service.rightClick(ctx.params.id, sel);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Focus element - supports selector OR fingerprint
  ns.post("/instances/:id/focus", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    if (!service.focusElement) {
      return { status: 501, body: { error: "focusElement not supported" } };
    }
    const ok = await service.focusElement(ctx.params.id, sel);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Drag and drop - supports selectors OR fingerprints for both source and target
  ns.post("/instances/:id/dragAndDrop", async (ctx: RouterContext) => {
    const json = ctx.json() as {
      sourceSelector?: string;
      sourceFingerprint?: string;
      targetSelector?: string;
      targetFingerprint?: string;
    } | null;
    const service = getService();
    const source = await resolveSelector(service, ctx.params.id, json?.sourceSelector, json?.sourceFingerprint);
    const target = await resolveSelector(service, ctx.params.id, json?.targetSelector, json?.targetFingerprint);
    const ok = await service.dragAndDrop(ctx.params.id, source, target);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Get cookies
  ns.get("/instances/:id/cookies", async (ctx: RouterContext) => {
    const service = getService();
    const cookies = await service.getCookies(ctx.params.id);
    return { status: 200, body: { cookies } };
  });

  // Set cookie
  ns.post<
    {
      name?: string;
      value?: string;
      domain?: string;
      path?: string;
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: "Strict" | "Lax" | "None";
      expirationDate?: number;
    },
    OkResponse | ErrorResponse
  >("/instances/:id/cookie", async (ctx: RouterContext) => {
    const json = ctx.json() as {
      name?: string;
      value?: string;
      domain?: string;
      path?: string;
      secure?: boolean;
      httpOnly?: boolean;
      sameSite?: "Strict" | "Lax" | "None";
      expirationDate?: number;
    } | null;
    if (!json?.name || !json?.value) {
      return { status: 400, body: { error: "name and value required" } };
    }
    const service = getService();
    const ok = await service.setCookie(ctx.params.id, {
      name: json.name,
      value: json.value,
      domain: json.domain,
      path: json.path,
      secure: json.secure,
      httpOnly: json.httpOnly,
      sameSite: json.sameSite,
      expirationDate: json.expirationDate,
    });
    if (!ok) {
      return { status: 500, body: { error: "failed to set cookie" } };
    }
    return { status: 200, body: { ok: true } };
  });

  // Accept alert
  ns.post("/instances/:id/acceptAlert", async (ctx: RouterContext) => {
    const service = getService();
    const ok = await service.acceptAlert(ctx.params.id);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Dismiss alert
  ns.post("/instances/:id/dismissAlert", async (ctx: RouterContext) => {
    const service = getService();
    const ok = await service.dismissAlert(ctx.params.id);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Wait for network idle
  ns.post("/instances/:id/waitForNetworkIdle", async (ctx: RouterContext) => {
    const json = ctx.json() as { timeout?: number } | null;
    const timeout = json?.timeout ?? 5000;
    const service = getService();
    const ok = await service.waitForNetworkIdle(ctx.params.id, timeout);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Wait for document ready (DOMContentLoaded)
  ns.post("/instances/:id/waitForReady", async (ctx: RouterContext) => {
    const json = ctx.json() as { timeout?: number } | null;
    const timeout = json?.timeout ?? 15000;
    const service = getService();
    const ok = await service.waitForReady(ctx.params.id, timeout);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Set innerHTML (for contenteditable elements) - supports selector OR fingerprint
  ns.post("/instances/:id/setInnerHTML", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string; html?: string } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    const html = json?.html ?? "";
    const ok = await service.setInnerHTML(ctx.params.id, sel, html);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Set textContent (for contenteditable elements) - supports selector OR fingerprint
  ns.post("/instances/:id/setTextContent", async (ctx: RouterContext) => {
    const json = ctx.json() as { selector?: string; fingerprint?: string; text?: string } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    const text = json?.text ?? "";
    const ok = await service.setTextContent(ctx.params.id, sel, text);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Dispatch event on element - supports selector OR fingerprint
  ns.post("/instances/:id/dispatchEvent", async (ctx: RouterContext) => {
    const json = ctx.json() as {
      selector?: string;
      fingerprint?: string;
      eventType?: string;
      options?: { bubbles?: boolean; cancelable?: boolean };
    } | null;
    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);
    const eventType = json?.eventType ?? "";
    const options = json?.options;
    const ok = await service.dispatchEvent(ctx.params.id, sel, eventType, options);
    return { status: 200, body: { ok: ok ?? false } };
  });

  // Type into an element (optional typing mode) - supports selector OR fingerprint
  ns.post<
    {
      selector?: string;
      fingerprint?: string;
      value?: string;
      typingMode?: boolean;
      typingDelayMs?: number;
    },
    OkResponse | ErrorResponse
  >("/instances/:id/input", async (ctx: RouterContext) => {
    const json = ctx.json() as {
      selector?: string;
      fingerprint?: string;
      value?: string;
      typingMode?: boolean;
      typingDelayMs?: number;
    } | null;

    const service = getService();
    const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);

    if (!sel || json?.value === undefined) {
      return { status: 400, body: { error: "selector (or fingerprint) and value required" } };
    }
    if (!service.inputElement) {
      return { status: 501, body: { error: "inputElement not supported" } };
    }
    const ok = await service.inputElement(ctx.params.id, sel, json.value, {
      typingMode: json.typingMode,
      typingDelayMs: json.typingDelayMs,
    });
    return { status: 200, body: { ok: !!ok } };
  });

  // Press key or key combination
  ns.post<{ key?: string }, OkResponse | ErrorResponse>(
    "/instances/:id/pressKey",
    async (ctx: RouterContext) => {
      const json = ctx.json() as { key?: string } | null;
      if (!json?.key) {
        return { status: 400, body: { error: "key required" } };
      }
      const service = getService();
      if (!service.pressKey) {
        return { status: 501, body: { error: "pressKey not supported" } };
      }
      const ok = await service.pressKey(ctx.params.id, json.key);
      return { status: 200, body: { ok: !!ok } };
    },
  );

  // Upload file via input[type=file] - supports selector OR fingerprint
  ns.post<{ selector?: string; fingerprint?: string; filePath?: string }, OkResponse | ErrorResponse>(
    "/instances/:id/uploadFile",
    async (ctx: RouterContext) => {
      const json = ctx.json() as {
        selector?: string;
        fingerprint?: string;
        filePath?: string;
      } | null;
      const service = getService();
      const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);

      if (!sel || !json?.filePath) {
        return { status: 400, body: { error: "selector (or fingerprint) and filePath required" } };
      }
      if (!service.uploadFile) {
        return { status: 501, body: { error: "uploadFile not supported" } };
      }
      const ok = await service.uploadFile(ctx.params.id, sel, json.filePath);
      return { status: 200, body: { ok: !!ok } };
    },
  );


  // Dispatch text input event (for rich text editors like Draft.js)
  // Dispatch text input event (for rich text editors) - supports selector OR fingerprint
  ns.post<{ selector?: string; fingerprint?: string; text?: string }, OkResponse | ErrorResponse>(
    "/instances/:id/dispatchTextInput",
    async (ctx: RouterContext) => {
      const json = ctx.json() as { selector?: string; fingerprint?: string; text?: string } | null;
      const service = getService();
      const sel = await resolveSelector(service, ctx.params.id, json?.selector, json?.fingerprint);

      if (!sel || json?.text === undefined) {
        return { status: 400, body: { error: "selector (or fingerprint) and text required" } };
      }
      const ok = await service.dispatchTextInput(ctx.params.id, sel, json.text);
      return { status: 200, body: { ok: !!ok } };
    },
  );
}

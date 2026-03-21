/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { onCleanup } from "solid-js";
import { splitViewConfig } from "../data/config.js";
import {
  getGBrowser,
  PREF_SPLIT_VIEW_SESSION_STATE,
  SPLIT_VIEW_GROUP_ATTRIBUTE,
  type SplitViewLayout,
  type SplitViewTab,
} from "../data/types.js";

type SessionStoreWin = {
  promiseInitialized: Promise<void>;
  promiseAllWindowsRestored: Promise<void>;
  persistTabAttribute(name: string): void;
};

function getSessionStore(): SessionStoreWin | null {
  return (
    (globalThis as { SessionStore?: SessionStoreWin }).SessionStore ?? null
  );
}

function newGroupId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

function tabEl(tab: SplitViewTab): XULElement {
  return tab as unknown as XULElement;
}

function isEligibleRestoreTab(tab: SplitViewTab): boolean {
  const browser = tab.linkedBrowser as
    | { currentURI?: { spec?: string } }
    | null;
  if (!browser) {
    return false;
  }
  const spec = browser.currentURI?.spec ?? "";
  if (spec === "about:opentabs") {
    return false;
  }
  return true;
}

function persistGroupLayout(groupId: string, layout: SplitViewLayout): void {
  type GroupEntry = { groupId: string; layout: SplitViewLayout };
  type Store = { groups: GroupEntry[] };
  const empty: Store = { groups: [] };
  try {
    const raw = Services.prefs.getStringPref(
      PREF_SPLIT_VIEW_SESSION_STATE,
      "{}",
    );
    const parsed = JSON.parse(raw) as unknown;
    const store: Store =
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as Store).groups)
        ? (parsed as Store)
        : empty;
    if (!Array.isArray(store.groups)) {
      store.groups = [];
    }
    const idx = store.groups.findIndex((g) => g.groupId === groupId);
    if (idx >= 0) {
      store.groups[idx]!.layout = layout;
    } else {
      store.groups.push({ groupId, layout });
    }
    Services.prefs.setStringPref(
      PREF_SPLIT_VIEW_SESSION_STATE,
      JSON.stringify(store),
    );
  } catch (e) {
    console.error("[session-restore] persistGroupLayout failed", e);
  }
}

type TabSplitViewActivateDetail = { tabs?: SplitViewTab[] };

function onTabSplitViewActivate(logger: ConsoleInstance, e: Event): void {
  const detail = (e as CustomEvent).detail as
    | TabSplitViewActivateDetail
    | undefined;
  const tabs = detail?.tabs;
  if (!Array.isArray(tabs) || tabs.length < 2) {
    return;
  }

  let groupId: string | null = null;
  for (const tab of tabs) {
    const existing = tabEl(tab).getAttribute(SPLIT_VIEW_GROUP_ATTRIBUTE);
    if (existing) {
      groupId = existing;
      break;
    }
  }
  if (!groupId) {
    groupId = newGroupId();
  }

  for (const tab of tabs) {
    if (!tabEl(tab).getAttribute(SPLIT_VIEW_GROUP_ATTRIBUTE)) {
      tabEl(tab).setAttribute(SPLIT_VIEW_GROUP_ATTRIBUTE, groupId);
    }
  }

  const layout = splitViewConfig().layout;
  persistGroupLayout(groupId, layout);

  logger.debug(
    `[session-restore:activate] groupId=${groupId}, tabs=${tabs.length}, layout=${layout}`,
  );
}

function onTabSplitViewDeactivate(logger: ConsoleInstance): void {
  const gBrowser = getGBrowser();
  if (!gBrowser?.tabs) {
    return;
  }
  for (const tab of gBrowser.tabs) {
    if (!tab.splitview) {
      tabEl(tab).removeAttribute(SPLIT_VIEW_GROUP_ATTRIBUTE);
    }
  }
  logger.debug(
    "[session-restore:deactivate] cleared group id from non-split tabs",
  );
}

function clearGroupAttributesExcept(
  allTabs: SplitViewTab[],
  keep: SplitViewTab[],
): void {
  const keepSet = new Set(keep);
  for (const tab of allTabs) {
    if (!keepSet.has(tab)) {
      tabEl(tab).removeAttribute(SPLIT_VIEW_GROUP_ATTRIBUTE);
    }
  }
}

function restoreSplitViewFromSession(logger: ConsoleInstance): void {
  const gBrowser = getGBrowser();
  if (!gBrowser?.tabs) {
    return;
  }

  const splitEnabled = Services.prefs.getBoolPref(
    "browser.tabs.splitView.enabled",
    false,
  );
  if (!splitEnabled) {
    return;
  }

  const allTabs = gBrowser.tabs;
  const groupBuckets = new Map<string, SplitViewTab[]>();

  for (const tab of allTabs) {
    const gid = tabEl(tab).getAttribute(SPLIT_VIEW_GROUP_ATTRIBUTE);
    if (!gid || !isEligibleRestoreTab(tab)) {
      continue;
    }
    const arr = groupBuckets.get(gid) ?? [];
    arr.push(tab);
    groupBuckets.set(gid, arr);
  }

  let chosen: SplitViewTab[] | null = null;
  for (const tab of allTabs) {
    const gid = tabEl(tab).getAttribute(SPLIT_VIEW_GROUP_ATTRIBUTE);
    if (!gid) {
      continue;
    }
    const arr = groupBuckets.get(gid);
    if (arr && arr.length >= 2) {
      chosen = arr;
      break;
    }
  }

  if (!chosen || chosen.length < 2) {
    clearGroupAttributesExcept(allTabs, []);
    return;
  }

  const maxPanes = splitViewConfig().maxPanes;
  const toRestore = chosen.slice(0, maxPanes);

  try {
    gBrowser.selectedTab = toRestore[0]!;
    gBrowser.showSplitViewPanels(toRestore);
    logger.debug(
      `[session-restore:restore] restored ${toRestore.length} pane(s)`,
    );
  } catch (e) {
    logger.error(`[session-restore:restore] failed: ${e}`);
  }

  clearGroupAttributesExcept(allTabs, toRestore);
}

export function initSessionRestore(logger: ConsoleInstance): void {
  const tabContainer = getGBrowser()?.tabContainer;
  if (!tabContainer) {
    return;
  }

  const ss = getSessionStore();
  if (ss?.promiseInitialized) {
    ss.promiseInitialized.then(() => {
      try {
        ss.persistTabAttribute(SPLIT_VIEW_GROUP_ATTRIBUTE);
        logger.debug("[session-restore] persistTabAttribute registered");
      } catch (e) {
        logger.error(`[session-restore] persistTabAttribute: ${e}`);
      }
    });
  }

  const onActivate = (e: Event): void => {
    onTabSplitViewActivate(logger, e);
  };
  const onDeactivate = (): void => {
    onTabSplitViewDeactivate(logger);
  };

  tabContainer.addEventListener("TabSplitViewActivate", onActivate);
  tabContainer.addEventListener("TabSplitViewDeactivate", onDeactivate);

  const pRestore = ss?.promiseAllWindowsRestored;
  if (pRestore) {
    pRestore
      .then(() => {
        restoreSplitViewFromSession(logger);
      })
      .catch((err: Error) => {
        logger.error(`[session-restore] promiseAllWindowsRestored: ${err}`);
        restoreSplitViewFromSession(logger);
      });
  }

  onCleanup(() => {
    tabContainer.removeEventListener("TabSplitViewActivate", onActivate);
    tabContainer.removeEventListener("TabSplitViewDeactivate", onDeactivate);
  });

  logger.debug("[session-restore] listeners attached");
}

/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { onCleanup } from "solid-js";
import { getGBrowser } from "../data/types.js";

/**
 * Tracks which pane is active (contains gBrowser.selectedTab) and sets
 * a `data-floorp-active-pane` attribute on the corresponding panel element.
 * This attribute drives a CSS inset box-shadow highlight.
 */
export function initActivePaneTracker(
  logger: ConsoleInstance,
): void {
  const tabContainer = getGBrowser()?.tabContainer;
  if (!tabContainer) return;

  const updateActivePaneIndicator = (): void => {
    const gBrowser = getGBrowser();
    const activeSplitView = gBrowser?.activeSplitView;

    if (!activeSplitView) {
      clearActivePaneIndicator();
      return;
    }

    const selectedTab = gBrowser.selectedTab;
    const splitTabs = activeSplitView.tabs;
    const activeIndex = splitTabs.indexOf(selectedTab);

    if (activeIndex === -1) {
      clearActivePaneIndicator();
      return;
    }

    for (let i = 0; i < splitTabs.length; i++) {
      const panel = document?.getElementById(
        splitTabs[i].linkedPanel,
      );
      if (!panel) continue;

      if (i === activeIndex) {
        panel.setAttribute("data-floorp-active-pane", "true");
      } else {
        panel.removeAttribute("data-floorp-active-pane");
      }
    }
  };

  const onDeactivate = (): void => {
    clearActivePaneIndicator();
  };

  tabContainer.addEventListener("TabSelect", updateActivePaneIndicator);
  tabContainer.addEventListener(
    "TabSplitViewActivate",
    updateActivePaneIndicator,
  );
  tabContainer.addEventListener(
    "TabSplitViewDeactivate",
    onDeactivate,
  );

  onCleanup(() => {
    tabContainer.removeEventListener(
      "TabSelect",
      updateActivePaneIndicator,
    );
    tabContainer.removeEventListener(
      "TabSplitViewActivate",
      updateActivePaneIndicator,
    );
    tabContainer.removeEventListener(
      "TabSplitViewDeactivate",
      onDeactivate,
    );
  });

  logger.debug(
    "[active-pane-tracker] listeners attached",
  );
}

function clearActivePaneIndicator(): void {
  const tabpanels = document?.getElementById(
    "tabbrowser-tabpanels",
  );
  if (!tabpanels) return;

  for (const el of tabpanels.querySelectorAll(
    "[data-floorp-active-pane]",
  )) {
    el.removeAttribute("data-floorp-active-pane");
  }
}

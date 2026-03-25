/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { getOwner, runWithOwner, createRoot } from "solid-js";
import { SplitViewManager } from "./split-view-manager.js";
import { noraComponent, NoraComponentBase } from "#features-chrome/utils/base";

const SPLIT_VIEW_EXPERIMENT = "split_view_advanced";
const SPLIT_VIEW_EXPERIMENT_OVERRIDE_PREF =
  "floorp.splitView.experiment.override";

const isSplitViewExperimentEnabled = (): boolean => {
  try {
    const { Experiments } = ChromeUtils.importESModule(
      "resource://noraneko/modules/experiments/Experiments.sys.mjs",
    );
    const variant = Experiments.getVariant(SPLIT_VIEW_EXPERIMENT);
    return variant !== null && variant !== "control";
  } catch (error) {
    console.error(
      "[SplitView] Failed to check split_view_advanced experiment:",
      error,
    );
    return false;
  }
};

@noraComponent(import.meta.hot)
export default class SplitView extends NoraComponentBase {
  init(): void {
    const splitViewEnabled = Services.prefs.getBoolPref(
      "browser.tabs.splitView.enabled",
      false,
    );

    if (!splitViewEnabled) {
      this.logger.debug("Split view is disabled upstream, skipping init");
      return;
    }

    const experimentOverride = Services.prefs.getBoolPref(
      SPLIT_VIEW_EXPERIMENT_OVERRIDE_PREF,
      false,
    );

    if (!experimentOverride && !isSplitViewExperimentEnabled()) {
      this.logger.debug(
        "Split view experiment not enrolled or assigned control, skipping init",
      );
      return;
    }

    this.logger.debug("Initializing advanced split view feature");
    const manager = new SplitViewManager(this.logger);

    // Explicitly pass the reactive owner so createEffect/onCleanup
    // inside SplitViewManager.init() are properly tracked
    const owner = getOwner();
    if (owner) {
      runWithOwner(owner, () => manager.init());
    } else {
      createRoot(() => manager.init());
    }
  }
}

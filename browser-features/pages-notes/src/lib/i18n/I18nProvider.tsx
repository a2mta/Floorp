import { PropsWithChildren, useEffect, useState } from "react";
import { initializeI18n } from "@/lib/i18n/init.ts";

export function I18nProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const i18nInstance = await initializeI18n();

        document.documentElement.lang = i18nInstance.language;
        document.title = i18nInstance.t("title.default");

        i18nInstance.on("languageChanged", (lng: string) => {
          document.documentElement.lang = lng;
          document.title = i18nInstance.t("title.default");
        });
      } catch (e) {
        console.error("[I18nProvider] initialization failed:", e);
      }
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return <div />;

  return <>{children}</>;
}

import type { Metadata, Viewport } from "next";
import { SiteHeader, THEME_COLOR } from "@/shared/design-system";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ASTRA Health · Crew wellness", template: "ASTRA Health · %s" },
  description: "ASTRA Health is a fictional astronaut wellness dashboard prototype.",
  icons: { icon: "data:," },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto w-full max-w-460 min-w-0 px-[clamp(14px,2.8vw,40px)] pb-7 max-md:px-6.5 max-sm:px-4.5 max-sm:pb-5.5 max-xs:px-3.5">
          <SiteHeader />
          <main id="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}

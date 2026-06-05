import { GuideView } from "./guide-view";
import { GUIDE_SECTIONS } from "./guide-data";

export const metadata = { title: "User Guide" };

export default function GuidePage() {
  return <GuideView sections={GUIDE_SECTIONS} />;
}

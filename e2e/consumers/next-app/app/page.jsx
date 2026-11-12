// A Server Component (no "use client" in this file). Rendering the slider directly only
// works when the package marks its own entry as a client module.
import MultiRangeSlider from "react-multi-input-rangeslider";

export default function Page() {
  return (
    <main>
      <MultiRangeSlider min={0} max={1000} step={10} ariaLabel="Price" />
    </main>
  );
}

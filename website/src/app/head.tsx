export default function Head() {
  return (
    <>
      {/* NeoLine wallet script */}
      <script src="https://cdn.jsdelivr.net/npm/neoline@latest/dist/neoline.min.js" defer />

      {/* O3 wallet script - hypothetical path, adjust based on actual availability */}
      <script src="https://cdn.jsdelivr.net/npm/@o3labs/o3-dapi@latest/lib/o3-dapi.min.js" defer />

      {/* Favicon and other metadata are handled by next.js app router metadata */}
    </>
  );
} 
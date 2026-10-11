/** Fixed ambient layer: localized red light orbs + fine grain give the glass something to refract. */
export function AppBackground() {
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="app-bg__orb app-bg__orb--1" />
      <div className="app-bg__orb app-bg__orb--2" />
      <div className="app-bg__orb app-bg__orb--3" />
      <div className="app-bg__vignette" />
      <div className="app-bg__grain" />
    </div>
  );
}

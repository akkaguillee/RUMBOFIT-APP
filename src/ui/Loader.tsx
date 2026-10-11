export function Loader({ label = 'Cargando' }: { label?: string }) {
  return (
    <div className="page-loading" role="status">
      <span className="loader" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

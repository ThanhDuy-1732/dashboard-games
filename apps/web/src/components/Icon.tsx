export function Icon({ name }: { name: string }) {
  return (
    <svg aria-hidden="true">
      <use href={`/icons.svg#i-${name}`} />
    </svg>
  );
}

/**
 * What goes inside an avatar: the user's own photo when they added one
 * (stored only on this device), otherwise the initial of their name.
 */
export function AvatarContent({ name, photo }: { name: string; photo?: string }) {
  if (photo) return <img className="avatar-img" src={photo} alt="" draggable={false} />;
  return <>{name.charAt(0).toUpperCase()}</>;
}

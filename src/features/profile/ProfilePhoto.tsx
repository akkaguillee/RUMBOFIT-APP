import { Camera, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { setProfilePhoto } from '@/db/repos/profile';
import type { Profile } from '@/domain/types';
import { AvatarContent } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { toast, toastError } from '@/ui/toast';
import { photoFromFile } from './photo';

/** A hidden file input and the action that opens it; the picked image is prepared and saved on the device. */
function usePhotoPicker() {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      hidden
      onChange={async (e) => {
        const file = e.target.files?.[0];
        // Picking the same file again must still fire a change.
        e.target.value = '';
        if (!file) return;
        setBusy(true);
        try {
          await setProfilePhoto(await photoFromFile(file));
          toast('Foto de perfil actualizada');
        } catch (err) {
          toastError(err);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
  return { input, pick: () => ref.current?.click(), busy };
}

/** The big avatar at the top of Perfil: tap it to add or change the photo. */
export function HeroAvatar({ profile }: { profile: Profile }) {
  const { input, pick, busy } = usePhotoPicker();
  return (
    <>
      <button
        type="button"
        className="profile-hero__avatar"
        data-photo={profile.photo ? '' : undefined}
        onClick={pick}
        aria-busy={busy || undefined}
        aria-label={profile.photo ? 'Cambiar foto de perfil' : 'Añadir foto de perfil'}
      >
        <AvatarContent name={profile.name} photo={profile.photo} />
        <span className="profile-hero__cam" aria-hidden="true">
          <Camera />
        </span>
      </button>
      {input}
    </>
  );
}

/** «Datos personales» › Foto de perfil: change or remove it, with where it is kept. */
export function PhotoField({ profile }: { profile: Profile }) {
  const { input, pick, busy } = usePhotoPicker();
  return (
    <div className="field">
      <span className="field__label">Foto de perfil</span>
      <div className="photo-field">
        <span className="avatar-btn photo-field__preview" data-photo={profile.photo ? '' : undefined} aria-hidden="true">
          <AvatarContent name={profile.name} photo={profile.photo} />
        </span>
        <div className="photo-field__actions">
          <Button size="sm" variant="secondary" icon={<Camera />} onClick={pick} loading={busy}>
            {profile.photo ? 'Cambiar foto' : 'Elegir foto'}
          </Button>
          {profile.photo && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 />}
              onClick={async () => {
                const previous = profile.photo;
                try {
                  await setProfilePhoto(undefined);
                  toast('Foto de perfil quitada', {
                    tone: 'info',
                    action: { label: 'Deshacer', onClick: () => void setProfilePhoto(previous).catch(toastError) },
                  });
                } catch (err) {
                  toastError(err);
                }
              }}
            >
              Quitar
            </Button>
          )}
        </div>
      </div>
      <span className="field__hint">Se guarda solo en este dispositivo (y en las copias que exportes). No se envía a ningún servidor.</span>
      {input}
    </div>
  );
}

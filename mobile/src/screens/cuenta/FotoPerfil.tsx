import { useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { PerfilPropio } from '../../domain/models/Perfil';
import { hogarRepository } from '../../infrastructure/di';
import { urlApi } from '../../infrastructure/http/HogarApiRepository';
import { Texto } from '../../ui/Texto';
import { Aviso } from '../../ui/Aviso';
import { BotonPrimario } from '../../ui/BotonPrimario';

export function FotoPerfil({ cuenta, onCambio, onInteraccion }: {
  cuenta: PerfilPropio; onCambio: (p: PerfilPropio) => void; onInteraccion?: (ocupado: boolean) => void;
}) {
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [falloImagen, setFalloImagen] = useState(false);
  const bloqueo = useRef(false);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  useEffect(() => {
    onInteraccion?.(ocupado);
    return () => onInteraccion?.(false);
  }, [ocupado, onInteraccion]);
  async function cambiar(quitar = false) {
    if (bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try {
      if (quitar) onCambio(await hogarRepository.quitarFoto());
      else {
        const r = await DocumentPicker.getDocumentAsync({
          type: ['image/jpeg', 'image/png'], multiple: false, copyToCacheDirectory: true, base64: false,
        });
        if (r.canceled || !montado.current) return;
        const a = r.assets[0];
        if ((a.size ?? 0) > 2 * 1024 * 1024) throw new Error('La foto puede pesar hasta 2 MB.');
        onCambio(await hogarRepository.foto({ nombre: a.name, uri: a.uri, tipo: a.mimeType ?? 'image/jpeg',
          tamano: a.size, contenidoWeb: a.file }));
      }
      setFalloImagen(false); setConfirmar(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos cambiar la foto.'); }
    finally { bloqueo.current = false; setOcupado(false); }
  }
  return <View style={{ gap: 12 }}>
    {cuenta.fotoUrl && !falloImagen
      ? <Image source={{ uri: urlApi(cuenta.fotoUrl) }} accessibilityLabel="Tu foto de perfil"
        style={{ width: 88, height: 88, borderRadius: 44 }} onError={() => setFalloImagen(true)} />
      : <Texto variante="titulo">{cuenta.nombre.slice(0, 1)}{cuenta.apellido.slice(0, 1)}</Texto>}
    <Texto variante="caption">Foto opcional JPG o PNG, hasta 2 MB. Se recorta al centro.
      La foto de perfil puede ser vista por quien tenga su enlace; no subas documentos personales.</Texto>
    {error ? <Aviso tono="peligro">{error}</Aviso> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <BotonPrimario titulo={cuenta.fotoUrl ? 'Cambiar foto' : 'Agregar foto'} variante="secundario"
        cargando={ocupado} onPress={() => void cambiar()} />
      {cuenta.fotoUrl ? <BotonPrimario titulo={confirmar ? 'Confirmar quitar foto' : 'Quitar foto'}
        variante="secundario" deshabilitado={ocupado}
        onPress={() => confirmar ? void cambiar(true) : setConfirmar(true)} /> : null}
      {confirmar ? <BotonPrimario titulo="Conservar foto" variante="secundario"
        deshabilitado={ocupado} onPress={() => setConfirmar(false)} /> : null}
    </View>
  </View>;
}

import type { Messages } from '../messages.ts'

export const pwa: Messages['pwa'] = {
  app: 'Aplicación',
  installQuorum: 'Instalar Quorum',
  installDetail: 'Juega desde tu pantalla de inicio o tu escritorio, en su propia ventana.',
  installPrompt: 'Instala Quorum para jugar en su propia ventana.',
  notNow: 'Ahora no',
  updateReady: 'Actualización lista',
  updateReadyDetail: 'Reinicia Quorum para cargar la nueva versión.',
  offline: 'Sin conexión',
  offlineStatus: 'Sin conexión. El juego sigue en este navegador.',
  offlineNote: 'Las salas y las claves de función necesitan conexión.',
  moveNote:
    'iPhone y iPad guardan un almacenamiento aparte para la app instalada. Abre una Empresa, copia su archivo en Ajustes › Guardar y pégalo en la app instalada.',
  installHelp: {
    iosSafari: 'Toca Compartir y luego Añadir a pantalla de inicio.',
    iosOther: 'Abre esta página en Safari, toca Compartir y luego Añadir a pantalla de inicio.',
    android: 'Abre el menú del navegador y toca Instalar app.',
    chromium: 'Haz clic en el icono de instalar de la barra de direcciones.',
    safariMac: 'Elige Archivo > Añadir al Dock.',
    other: 'Este navegador no puede instalar Quorum. Sigue jugando en esta pestaña.',
  },
}

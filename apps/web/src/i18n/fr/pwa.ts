import type { Messages } from '../messages.ts'

export const pwa: Messages['pwa'] = {
  app: 'Application',
  installQuorum: 'Installer Quorum',
  installDetail: 'Jouez depuis votre écran d’accueil ou votre bureau, dans sa propre fenêtre.',
  installPrompt: 'Installez Quorum pour jouer dans sa propre fenêtre.',
  notNow: 'Plus tard',
  updateReady: 'Mise à jour prête',
  updateReadyDetail: 'Redémarrez Quorum pour charger la nouvelle version.',
  offline: 'Hors ligne',
  offlineStatus: 'Hors ligne. Le jeu continue dans ce navigateur.',
  offlineNote: 'Les salons et les clés de fonctionnalité ont besoin d’une connexion.',
  moveNote:
    'iPhone et iPad gardent un stockage séparé pour l’app installée. Ouvrez une Entreprise, copiez son fichier dans Réglages › Sauvegarde, puis collez-le dans l’app installée.',
  installHelp: {
    iosSafari: 'Touchez Partager, puis Ajouter à l’écran d’accueil.',
    iosOther: 'Ouvrez cette page dans Safari, touchez Partager, puis Ajouter à l’écran d’accueil.',
    android: 'Ouvrez le menu du navigateur et touchez Installer l’application.',
    chromium: 'Cliquez sur l’icône d’installation dans la barre d’adresse.',
    safariMac: 'Choisissez Fichier > Ajouter au Dock.',
    other: 'Ce navigateur ne peut pas installer Quorum. Continuez dans cet onglet.',
  },
}

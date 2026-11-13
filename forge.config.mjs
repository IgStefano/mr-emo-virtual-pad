import { FuseV1Options, FuseVersion } from '@electron/fuses';

export default {
  packagerConfig: { asar: true },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32', 'linux'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main/main.ts',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload/preload.ts',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [{ name: 'main_window', config: 'vite.renderer.config.mjs' }],
      },
    },
    {
      name: '@electron-forge/plugin-fuses',
      config: {
        version: FuseVersion.V1,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
      },
    },
  ],
};

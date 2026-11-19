/* babel-preset-expo resolves the worklets plugin itself under npm layouts,
   but under pnpm's strict layout that auto-resolution is unreliable
   (spike #192, landmine 4) — the plugin is declared explicitly, or
   worklet callbacks fail at runtime. */
module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};

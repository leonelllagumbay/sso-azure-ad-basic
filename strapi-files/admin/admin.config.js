module.exports = {
  webpack: (config, webpack) => {
    // Add your variable using the DefinePlugin
    config.plugins.push(
      new webpack.DefinePlugin({
        //All your custom ENVs that you want to use in frontend
        FE_CUSTOM_VARIABLES: {
          AZURE_AD_CLIENT_ID: JSON.stringify(process.env.AZURE_AD_CLIENT_ID),
          AZURE_AD_REDIRECT_URL: JSON.stringify(process.env.AZURE_AD_REDIRECT_URL),
        },
      })
    );
    // Important: return the modified config
    return config;
  },
};
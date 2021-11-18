import React from 'react';
import AzureLogin from './AzureLogin';
import { msalConfig } from './authConfig';
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
// MSAL configuration
const configuration = {
  auth: {
    clientId: msalConfig.auth.clientId
  }
};

const pca = new PublicClientApplication(configuration);

const AuthPage = () => {
  return (
    <MsalProvider instance={pca}>
      <AzureLogin />
    </MsalProvider>
  );
  // End custom
};

export default AuthPage;

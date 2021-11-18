'use strict';

/**
 * sso-azure-ad-basic.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

// Dependencies
// const msal = require('@azure/msal-node');
const https = require('https');

const azureService = {};

azureService.getMyRoles = async (azureToken, profileId) => {
  return new Promise(async (resolve, reject) => {
    const req = https.request({
      'method': 'GET',
      'hostname': 'graph.microsoft.com',
      'path': `/v1.0/me/memberOf`,
      'headers': {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + azureToken
      },
      'maxRedirects': 20
    }, function (resp) {
      let data = '';
      // A chunk of data has been received.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received.
      resp.on('end', () => {
        resolve(JSON.parse(data));
      });
    }).on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

azureService.getProfileData = async (azureToken) => {
  return new Promise(async (resolve, reject) => {
    const req = https.request({
      'method': 'GET',
      'hostname': 'graph.microsoft.com',
      'path': '/v1.0/me',
      'headers': {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + azureToken
      },
      'maxRedirects': 20
    }, function (resp) {
      let data = '';
      // A chunk of data has been received.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        resolve(JSON.parse(data));
      });
    }).on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

azureService.mapRoles = async (rolesToAdd, roles) => {
  const roleMap = process.env.AZURE_AD_ROLE_MAPPING ? JSON.parse(process.env.AZURE_AD_ROLE_MAPPING) : [];
  for (let role of roleMap) {
    if (roles.indexOf(role.azureRole) > -1) {
      const correspondingRoleInStapi = await strapi.query('role', 'admin').findOne({
        name: role.strapiRole
      }, ['name']);
      rolesToAdd.push(correspondingRoleInStapi.id);
    }
  }
  return rolesToAdd;
}

azureService.mapRolesAPIUsers = async (rolesToAdd, roles) => {
  const roleMap = process.env.AZURE_AD_ROLE_MAPPING_API_USERS ? JSON.parse(process.env.AZURE_AD_ROLE_MAPPING_API_USERS) : [];
  for (let role of roleMap) {
    if (roles.indexOf(role.azureRole) > -1) {
      const correspondingRoleInStapi = await strapi.query('role', 'users-permissions').findOne({
        name: role.strapiRole
      }, ['name']);
      rolesToAdd.push(correspondingRoleInStapi.id);
    }
  }
  return rolesToAdd;
}

azureService.getUserData = (userProfile, rolesToAdd) => {
  return {
    roles: rolesToAdd,
    firstname: userProfile.givenName,
    lastname: userProfile.surname,
    username: userProfile.displayName,
    email: userProfile.userPrincipalName ? userProfile.userPrincipalName : userProfile.mail,
    isActive: true,
    blocked: false,
  }
}

azureService.getAPIUserData = (userProfile, rolesToAdd) => {
  return {
    role: rolesToAdd[0],
    username: userProfile.displayName,
    email: userProfile.userPrincipalName ? userProfile.userPrincipalName : userProfile.mail,
    blocked: false,
    confirmed: true,
    provider: 'local'
  }
}

azureService.verifyTokenAzureActiveDirectory = async (ctx) => {
  const { azureToken } = ctx.request.body;

  try {
    // Get profile data
    let profileData = await azureService.getProfileData(azureToken);
    let roleList = await azureService.getMyRoles(azureToken, profileData.id);
    const roles = roleList.value.map(role => role.displayName);
    const mail = profileData.userPrincipalName ? profileData.userPrincipalName : profileData.mail;

    // Query user by email
    const userModel = await strapi.query('user', 'admin').findOne({
      email: mail
    });
    let rolesToAdd = [];

    if (userModel) {
      // Update user role
      rolesToAdd = await azureService.mapRoles(rolesToAdd, roles);

      await strapi.query('user', 'admin').update({
        id: userModel.id
      }, await azureService.getUserData(profileData, rolesToAdd));
    } else {
      rolesToAdd = await azureService.mapRoles(rolesToAdd, roles);
      await strapi.query('user', 'admin').create(await azureService.getUserData(profileData, rolesToAdd))
    }

    const processedUser = await strapi.query('user', 'admin').findOne({ email: mail });
    ctx.state.user = processedUser;

    const { user } = ctx.state;

    strapi.eventHub.emit('admin.auth.success', { user, provider: 'local' });

    ctx.body = {
      data: {
        token: strapi.admin.services.token.createJwtToken(user),
        user: strapi.admin.services.user.sanitizeUser(ctx.state.user), // TODO: fetch more detailed info
      },
    };
  } catch (error) {
    console.log('error', error);
    return ctx.badRequest(error);
  }
}

/**
* Handle API users login using Azure identity token
* The token will be passed by the frontend
* @param {*} ctx 
* @returns 
*/
azureService.verifyTokenAPIUser = async (ctx) => {
  const { azureToken } = ctx.request.body;

  try {
    // Get profile data
    let profileData = await azureService.getProfileData(azureToken);
    let roleList = await azureService.getMyRoles(azureToken, profileData.id);
    const roles = roleList.value.map(role => role.displayName);
    const mail = profileData.userPrincipalName ? profileData.userPrincipalName : profileData.mail;

    // Query user by email
    const userModel = await strapi.query('user', 'users-permissions').findOne({
      email: mail
    });
    let rolesToAdd = [];
    if (userModel) {
      // Update user role
      rolesToAdd = await azureService.mapRolesAPIUsers(rolesToAdd, roles);

      await strapi.query('user', 'users-permissions').update({
        id: userModel.id
      }, await azureService.getAPIUserData(profileData, rolesToAdd));
    } else {
      rolesToAdd = await azureService.mapRolesAPIUsers(rolesToAdd, roles);
      await strapi.query('user', 'users-permissions').create(await azureService.getAPIUserData(profileData, rolesToAdd))
    }

    const user = await strapi.query('user', 'users-permissions').findOne({
      email: mail
    });

    ctx.send({
      jwt: strapi.plugins['users-permissions'].services.jwt.issue({
        id: user.id,
      }),
      user: sanitizeEntity(user.toJSON ? user.toJSON() : user, {
        model: strapi.query('user', 'users-permissions').model,
      }),
    });
  } catch (error) {
    console.log('error', error)
    return ctx.badRequest(error.toString());
  }
}

module.exports = azureService;

